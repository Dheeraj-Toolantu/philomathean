// Opens the PapaCambridge IGCSE listing in a real browser, searches for a subject (default
// "Accounting"), walks the matching subject pages and downloads every PDF one at a time.
// Advertisements are blocked, and any that still appear are closed (see ads.js).
// Files are validated (HTTP 200, %PDF header, size limit), de-duplicated by name and recorded in
// manifest.json so re-runs only fetch new papers.
//
// Configuration (environment variables):
//   SEARCH_TERM     subject to search for                 default "Accounting"
//   START_URL       listing page to search on             default PapaCambridge IGCSE listing
//   OUT_DIR         where PDFs are written                default <repo>/past-papers/igcse/<subject-slug>
//   MAX_FILES       stop after this many new downloads    default 0 (no limit)
//   MAX_DEPTH       how many link levels below a subject  default 3
//   DELAY_MS        pause between requests                default 1500
//   FILE_FILTER     regex a PDF's file name or link text  default "" (all)
//                   must match; "solved" is a shortcut for mark schemes / solved papers
//   BLOCK_ADS       "false" to let ads load (they are     default true
//                   still closed when they appear)
//   HEADLESS        "false" to watch the browser          default true
//   CHROMIUM_PATH   use a pre-installed Chromium binary   optional
import { chromium } from 'playwright'
import { blockAds, dismissAds, watchForAds } from './ads.js'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_PDF_BYTES = 50 * 1024 * 1024
// Mark schemes are CAIE's worked answers ("_ms_" in the file name); also accept links labelled solved.
export const SOLVED_FILTER = /_ms_|solved|mark\s*scheme|answers?\b/i
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const slugify = (value) =>
  String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'subject'

// Derives a safe local file name from a PDF link, including links of the form
// download_file.php?files=https://.../0452_s23_qp_12.pdf
export const pdfFileName = (href) => {
  const url = new URL(href)
  const candidates = [...url.searchParams.values(), url.pathname]
  const pdfPart = candidates.map((value) => decodeURIComponent(value)).find((value) => /\.pdf$/i.test(value))
  const base = path.posix.basename(pdfPart || url.pathname)
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '_')
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`
}

export const isPdfLink = (href) => {
  try {
    const url = new URL(href)
    return /\.pdf$/i.test(url.pathname) || [...url.searchParams.values()].some((value) => /\.pdf$/i.test(value))
  } catch {
    return false
  }
}

// A subject link matches when every word of the search term appears in its text or URL,
// so "Mathematics 0444" matches "Mathematics - US (0444)" and /igcse-mathematics-us-0444.
export const matchesSearch = (searchTerm, text, href) => {
  const haystack = `${text} ${decodeURIComponent(new URL(href).pathname)}`.toLowerCase()
  return searchTerm.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).every((word) => haystack.includes(word))
}

export const parseFileFilter = (value) => {
  if (!value) return null
  return value.trim().toLowerCase() === 'solved' ? SOLVED_FILTER : new RegExp(value, 'i')
}

export const isPdfBuffer = (buffer) => buffer.length > 4 && buffer.subarray(0, 5).toString('latin1') === '%PDF-'

const readConfig = () => {
  const searchTerm = (process.env.SEARCH_TERM || 'Accounting').trim()
  return {
    searchTerm,
    startUrl: (process.env.START_URL || 'https://pastpapers.papacambridge.com/papers/caie/igcse?theme=lightTheme').split('#')[0],
    outDir: path.resolve(repoRoot, process.env.OUT_DIR || path.join('past-papers', 'igcse', slugify(searchTerm))),
    maxFiles: Number(process.env.MAX_FILES || 0),
    maxDepth: Number(process.env.MAX_DEPTH || 3),
    delayMs: Number(process.env.DELAY_MS ?? 1500),
    fileFilter: parseFileFilter(process.env.FILE_FILTER),
    blockAds: process.env.BLOCK_ADS !== 'false',
    headless: process.env.HEADLESS !== 'false',
    chromiumPath: process.env.CHROMIUM_PATH || undefined,
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const collectLinks = (page) =>
  page.$$eval('a[href]', (anchors) => anchors.map((anchor) => ({ href: anchor.href, text: anchor.textContent.trim() })))

// Types the term into the site's search box and returns links to the subjects it matches.
// Falls back to filtering the listing's own links when no search box is found.
const findSubjectLinks = async (page, searchTerm) => {
  await dismissAds(page)
  const search = page
    .locator('input[type="search"], input[placeholder*="search" i], input[name*="search" i], input[aria-label*="search" i]')
    .first()
  if (await search.count()) {
    await search.fill(searchTerm)
    await search.press('Enter').catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(1000)
  } else {
    console.warn('No search box found; filtering the listing links instead.')
  }

  const startHost = new URL(page.url()).host
  const seen = new Set()
  return (await collectLinks(page)).filter(({ href, text }) => {
    if (seen.has(href) || isPdfLink(href)) return false
    if (new URL(href).host !== startHost || !matchesSearch(searchTerm, text, href)) return false
    seen.add(href)
    return true
  })
}

// Breadth-first walk of the pages below a subject page, collecting PDF links and their link text.
const crawlSubject = async (page, subjectUrl, { maxDepth, delayMs }) => {
  const root = new URL(subjectUrl)
  const prefix = root.pathname.replace(/\/$/, '')
  const visited = new Set()
  const pdfs = new Map()
  let frontier = [subjectUrl]

  for (let depth = 0; depth <= maxDepth && frontier.length; depth += 1) {
    const next = []
    for (const pageUrl of frontier) {
      const key = pageUrl.split('#')[0]
      if (visited.has(key)) continue
      visited.add(key)
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
        await dismissAds(page)
      } catch (error) {
        console.warn(`  ! could not open ${pageUrl}: ${error.message}`)
        continue
      }
      for (const { href, text } of await collectLinks(page)) {
        if (isPdfLink(href)) {
          if (!pdfs.has(href)) pdfs.set(href, { name: pdfFileName(href), text })
          continue
        }
        const url = new URL(href)
        if (url.host === root.host && url.pathname.startsWith(prefix) && !visited.has(href.split('#')[0])) next.push(href)
      }
      await sleep(delayMs)
    }
    frontier = next
  }
  return pdfs
}

const loadManifest = async (file) => {
  if (!existsSync(file)) return { files: {} }
  return JSON.parse(await readFile(file, 'utf8'))
}

export const run = async (config = readConfig()) => {
  await mkdir(config.outDir, { recursive: true })
  const manifestPath = path.join(config.outDir, 'manifest.json')
  const manifest = await loadManifest(manifestPath)
  const summary = { downloaded: 0, skipped: 0, failed: 0 }

  const browser = await chromium.launch({ headless: config.headless, executablePath: config.chromiumPath })
  try {
    const context = await browser.newContext({ acceptDownloads: true })
    if (config.blockAds) await blockAds(context)
    const page = await context.newPage()
    await watchForAds(page)
    console.log(`Opening ${config.startUrl}`)
    await page.goto(config.startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await dismissAds(page)

    const subjects = await findSubjectLinks(page, config.searchTerm)
    if (!subjects.length) throw new Error(`No subject matching "${config.searchTerm}" was found on ${config.startUrl}`)
    console.log(`Found ${subjects.length} subject link(s) for "${config.searchTerm}":`)
    subjects.forEach(({ href, text }) => console.log(`  - ${text || href}`))

    const allPdfs = new Map()
    for (const { href } of subjects) {
      console.log(`Crawling ${href}`)
      for (const [pdfUrl, link] of await crawlSubject(page, href, config)) allPdfs.set(pdfUrl, link)
    }
    console.log(`Found ${allPdfs.size} PDF link(s).`)

    for (const [pdfUrl, { name, text }] of allPdfs) {
      if (config.maxFiles && summary.downloaded >= config.maxFiles) break
      if (config.fileFilter && !config.fileFilter.test(`${name} ${text}`)) continue
      const target = path.join(config.outDir, name)
      if (existsSync(target) || manifest.files[name]) {
        summary.skipped += 1
        continue
      }
      try {
        const response = await context.request.get(pdfUrl, { timeout: 120_000 })
        if (!response.ok()) throw new Error(`HTTP ${response.status()}`)
        const body = await response.body()
        if (!isPdfBuffer(body)) throw new Error('response is not a PDF')
        if (body.length > MAX_PDF_BYTES) throw new Error(`file is larger than ${MAX_PDF_BYTES} bytes`)
        await writeFile(target, body)
        manifest.files[name] = {
          source: pdfUrl,
          bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex'),
          downloadedAt: new Date().toISOString(),
        }
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        summary.downloaded += 1
        console.log(`  ✓ ${name} (${body.length} bytes)`)
      } catch (error) {
        summary.failed += 1
        console.warn(`  ✗ ${name}: ${error.message}`)
      }
      await sleep(config.delayMs)
    }
  } finally {
    await browser.close()
  }

  console.log(`Done: ${summary.downloaded} downloaded, ${summary.skipped} already present, ${summary.failed} failed.`)
  console.log(`Output: ${path.relative(repoRoot, config.outDir) || '.'}`)
  return summary
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
