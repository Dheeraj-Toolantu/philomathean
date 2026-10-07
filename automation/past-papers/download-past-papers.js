// Opens the PapaCambridge IGCSE listing in a real browser, searches for a subject (default
// "Accounting") and opens the subject's folders, and every subfolder inside them, until it reaches
// the PDFs, downloading each folder's PDFs one at a time as soon as that folder is opened.
// Advertisements are blocked, and any that still appear are closed (see ads.js).
// Files are validated (HTTP 200, %PDF header, size limit), de-duplicated by name and recorded in
// manifest.json so re-runs only fetch new papers.
//
// Configuration (environment variables):
//   SEARCH_TERM     subject to search for                 default "Accounting"
//   START_URL       listing page to search on             default PapaCambridge IGCSE listing
//   OUT_DIR         where PDFs are written                default <repo>/past-papers/igcse/<subject-slug>
//   MAX_FILES       stop after this many new downloads    default 0 (no limit)
//   MAX_DEPTH       how many subfolder levels to open     default 0 (no limit: keep opening
//                   below a subject                       subfolders until there are none left)
//   MAX_PAGES       safety cap on folders opened per run  default 5000
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
    maxDepth: Number(process.env.MAX_DEPTH || 0),
    maxPages: Number(process.env.MAX_PAGES || 5000),
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

// Identifies a folder page regardless of #fragments, trailing slashes or the site's theme switch,
// so the same folder is never opened twice.
export const folderKey = (href) => {
  const url = new URL(href)
  url.hash = ''
  url.searchParams.delete('theme')
  url.searchParams.sort()
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url.href
}

// A subfolder is any link on the same site whose path continues the subject's path,
// e.g. /papers/caie/igcse-mathematics-0444 → /papers/caie/igcse-mathematics-0444-2024-may-june.
export const isSubfolderLink = (href, subjectUrl) => {
  if (isPdfLink(href)) return false
  const url = new URL(href)
  const root = new URL(subjectUrl)
  const prefix = root.pathname.replace(/\/+$/, '')
  return url.host === root.host && url.pathname.startsWith(prefix) && folderKey(href) !== folderKey(subjectUrl)
}

// Depth-first walk of a subject: opens a folder, hands back the PDFs in it, then opens each of its
// subfolders the same way, for as many levels as the site has (or MAX_DEPTH when set).
// `visited` is shared across subjects so a folder is opened at most once per run.
async function* walkFolders(page, subjectUrl, { maxDepth, maxPages, delayMs }, visited) {
  const lastSegment = (href) => new URL(href).pathname.replace(/\/+$/, '').split('/').pop()
  const stack = [{ url: subjectUrl, depth: 0, trail: [lastSegment(subjectUrl)] }]
  while (stack.length) {
    const { url, depth, trail } = stack.pop()
    const key = folderKey(url)
    if (visited.has(key)) continue
    if (visited.size >= maxPages) {
      console.warn(`  ! stopped after opening ${maxPages} folders (MAX_PAGES)`)
      return
    }
    visited.add(key)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await dismissAds(page)
    } catch (error) {
      console.warn(`  ! could not open ${url}: ${error.message}`)
      continue
    }

    const pdfs = new Map()
    const subfolders = new Map()
    for (const { href, text } of await collectLinks(page)) {
      if (isPdfLink(href)) {
        if (!pdfs.has(href)) pdfs.set(href, { url: href, name: pdfFileName(href), text })
      } else if (isSubfolderLink(href, subjectUrl) && !visited.has(folderKey(href)) && !subfolders.has(folderKey(href))) {
        subfolders.set(folderKey(href), href)
      }
    }
    const folder = trail.join(' › ')
    console.log(`${'  '.repeat(depth)}▸ ${folder}: ${pdfs.size} PDF(s), ${subfolders.size} subfolder(s)`)
    await sleep(delayMs)

    yield* pdfs.values()
    if (maxDepth && depth >= maxDepth) continue
    // Pushed in reverse so subfolders are opened in the order they appear on the page.
    for (const child of [...subfolders.values()].reverse()) stack.push({ url: child, depth: depth + 1, trail: [...trail, lastSegment(child)] })
  }
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

    const visited = new Set()
    const seenPdfs = new Set()
    let found = 0
    subjects: for (const { href } of subjects) {
      console.log(`Opening ${href}`)
      for await (const { url: pdfUrl, name, text } of walkFolders(page, href, config, visited)) {
        if (seenPdfs.has(pdfUrl)) continue
        seenPdfs.add(pdfUrl)
        found += 1
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
          console.log(`    ✓ ${name} (${body.length} bytes)`)
        } catch (error) {
          summary.failed += 1
          console.warn(`    ✗ ${name}: ${error.message}`)
        }
        await sleep(config.delayMs)
        if (config.maxFiles && summary.downloaded >= config.maxFiles) {
          console.log(`Reached MAX_FILES=${config.maxFiles}; not opening further folders.`)
          break subjects
        }
      }
    }
    console.log(`Opened ${visited.size} folder(s) and found ${found} PDF link(s).`)
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
