// Opens the PapaCambridge IGCSE listing in a real browser and, for each search term listed in
// search-terms.txt (one per line), searches for the subject and opens the subject's folders, and every subfolder inside them, until it reaches
// the PDFs, downloading each folder's PDFs one at a time as soon as that folder is opened.
// Advertisements are blocked, and any that still appear are closed (see ads.js).
// Files are validated (HTTP 200, %PDF header, size limit), de-duplicated by name and recorded in
// manifest.json so re-runs only fetch new papers.
// Each PDF is then rebranded (rebrand-pdf.js): the PapaCambridge watermark is removed, the
// Philomathean logo watermark is added and the file is named after its year and content, e.g.
// 0452_s23_ms_12.pdf → "2023 May-June - Accounting 0452 - Mark Scheme - Paper 12.pdf".
//
// Configuration (environment variables):
//   SEARCH_TERMS_FILE  text file with one search term     default search-terms.txt next to
//                   per line (# starts a comment)         this script
//   SEARCH_TERM     search for just this term instead of the file
//   START_URL       listing page to search on             default PapaCambridge IGCSE listing
//   OUT_DIR         where PDFs are written; with several  default <repo>/past-papers/igcse/<term-slug>
//                   terms, each gets a subfolder of it
//   MAX_FILES       per search term: stop after this many default 0 (no limit)
//                   new downloads
//   MAX_DEPTH       how many subfolder levels to open     default 0 (no limit: keep opening
//                   below a subject                       subfolders until there are none left)
//   MAX_PAGES       safety cap on folders opened per run  default 5000
//   DELAY_MS        pause between requests                default 1500
//   FILE_FILTER     regex a PDF's file name or link text  default "" (all)
//                   must match; "solved" is a shortcut for mark schemes / solved papers
//   BLOCK_ADS       "false" to let ads load (they are     default true
//                   still closed when they appear)
//   REBRAND         "false" to keep PDFs exactly as        default true
//                   downloaded, under their original names
//   WATERMARK_LOGO  logo stamped on every page            default <repo>/logo.png
//   HEADLESS        "false" to watch the browser          default true
//   CHROMIUM_PATH   use a pre-installed Chromium binary   optional
import { chromium } from 'playwright'
import { blockAds, dismissAds, watchForAds } from './ads.js'
import { DEFAULT_LOGO, loadWatermarkLogo, rebrandPdf } from './rebrand-pdf.js'
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

// One search term per line; blank lines and lines starting with # are ignored, duplicates dropped.
export const parseSearchTerms = (text) => {
  const seen = new Set()
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !line.startsWith('#'))
    .filter((line) => !seen.has(line.toLowerCase()) && seen.add(line.toLowerCase()))
}

export const readSearchTerms = async (file) => {
  if (!existsSync(file)) throw new Error(`Search terms file not found: ${file}`)
  const terms = parseSearchTerms(await readFile(file, 'utf8'))
  if (!terms.length) throw new Error(`${file} has no search terms; add one subject per line, e.g. "Mathematics 0444"`)
  return terms
}

const readConfig = async () => {
  const termsFile = path.resolve(process.env.SEARCH_TERMS_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'search-terms.txt'))
  const searchTerms = process.env.SEARCH_TERM?.trim() ? [process.env.SEARCH_TERM.trim()] : await readSearchTerms(termsFile)
  return {
    searchTerms,
    startUrl: (process.env.START_URL || 'https://pastpapers.papacambridge.com/papers/caie/igcse?theme=lightTheme').split('#')[0],
    outDir: process.env.OUT_DIR ? path.resolve(repoRoot, process.env.OUT_DIR) : null,
    maxFiles: Number(process.env.MAX_FILES || 0),
    maxDepth: Number(process.env.MAX_DEPTH || 0),
    maxPages: Number(process.env.MAX_PAGES || 5000),
    delayMs: Number(process.env.DELAY_MS ?? 1500),
    fileFilter: parseFileFilter(process.env.FILE_FILTER),
    blockAds: process.env.BLOCK_ADS !== 'false',
    rebrand: process.env.REBRAND !== 'false',
    logoPath: path.resolve(process.env.WATERMARK_LOGO || DEFAULT_LOGO),
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

// Where one term's PDFs go: OUT_DIR itself for a single term, a subfolder of it per term when there
// are several, and past-papers/igcse/<term-slug> by default.
export const outDirFor = (config, term, termCount) => {
  if (!config.outDir) return path.join(repoRoot, 'past-papers', 'igcse', slugify(term))
  return termCount > 1 ? path.join(config.outDir, slugify(term)) : config.outDir
}

// Downloads one PDF and, unless rebranding is off, swaps the PapaCambridge watermark for the
// Philomathean one and saves it under a name built from its year and content. The manifest stays
// keyed by the original name so re-runs recognise papers already saved under their new names.
const downloadPdf = async (context, { pdfUrl, name }, outDir, manifest, { rebrand, logoPath, term }) => {
  const response = await context.request.get(pdfUrl, { timeout: 120_000 })
  if (!response.ok()) throw new Error(`HTTP ${response.status()}`)
  const body = await response.body()
  if (!isPdfBuffer(body)) throw new Error('response is not a PDF')
  if (body.length > MAX_PDF_BYTES) throw new Error(`file is larger than ${MAX_PDF_BYTES} bytes`)
  const entry = {
    source: pdfUrl,
    bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    downloadedAt: new Date().toISOString(),
  }
  let saved = { bytes: body, name }
  if (rebrand) {
    try {
      saved = await rebrandPdf(body, { fileName: name, subject: term, logoPath })
    } catch (error) {
      throw new Error(`could not rebrand: ${error.message}`)
    }
    Object.assign(entry, { savedAs: saved.name, watermarkRemoved: saved.removed > 0, savedBytes: saved.bytes.length })
    if (!saved.removed) console.warn(`    ! ${name}: no PapaCambridge watermark found; added the Philomathean one anyway`)
  }
  await writeFile(path.join(outDir, saved.name), saved.bytes)
  manifest.files[name] = entry
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return { bytes: saved.bytes.length, savedAs: saved.name }
}

// Searches for one term, then opens every folder and subfolder of each matching subject and
// downloads the PDFs it finds there.
const searchAndDownload = async (context, page, term, outDir, config) => {
  const summary = { downloaded: 0, skipped: 0, failed: 0, found: true }
  console.log(`\n=== "${term}" ===`)
  await page.goto(config.startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await dismissAds(page)

  const subjects = await findSubjectLinks(page, term)
  if (!subjects.length) {
    console.warn(`  ! No subject matching "${term}" was found on ${config.startUrl}; skipping it.`)
    return { ...summary, found: false }
  }
  console.log(`Found ${subjects.length} subject link(s):`)
  subjects.forEach(({ href, text }) => console.log(`  - ${text || href}`))

  await mkdir(outDir, { recursive: true })
  const manifest = await loadManifest(path.join(outDir, 'manifest.json'))
  const visited = new Set()
  const seenPdfs = new Set()
  let linkCount = 0
  subjects: for (const { href } of subjects) {
    console.log(`Opening ${href}`)
    for await (const { url: pdfUrl, name, text } of walkFolders(page, href, config, visited)) {
      if (seenPdfs.has(pdfUrl)) continue
      seenPdfs.add(pdfUrl)
      linkCount += 1
      if (config.fileFilter && !config.fileFilter.test(`${name} ${text}`)) continue
      if (existsSync(path.join(outDir, name)) || manifest.files[name]) {
        summary.skipped += 1
        continue
      }
      try {
        const { bytes, savedAs } = await downloadPdf(context, { pdfUrl, name }, outDir, manifest, { ...config, term })
        summary.downloaded += 1
        console.log(`    ✓ ${name}${savedAs === name ? '' : ` → ${savedAs}`} (${bytes} bytes)`)
      } catch (error) {
        summary.failed += 1
        console.warn(`    ✗ ${name}: ${error.message}`)
      }
      await sleep(config.delayMs)
      if (config.maxFiles && summary.downloaded >= config.maxFiles) {
        console.log(`Reached MAX_FILES=${config.maxFiles} for "${term}"; not opening further folders.`)
        break subjects
      }
    }
  }
  console.log(`"${term}": opened ${visited.size} folder(s), found ${linkCount} PDF link(s); ` +
    `${summary.downloaded} downloaded, ${summary.skipped} already present, ${summary.failed} failed → ${path.relative(repoRoot, outDir) || '.'}`)
  return summary
}

export const run = async (config) => {
  config ??= await readConfig()
  const terms = config.searchTerms ?? [config.searchTerm]
  const totals = { downloaded: 0, skipped: 0, failed: 0, notFound: [] }
  const errored = []
  console.log(`Search terms (${terms.length}): ${terms.map((term) => `"${term}"`).join(', ')}`)
  // Fails before opening the browser when the watermark logo is missing or unreadable.
  if (config.rebrand) await loadWatermarkLogo(config.logoPath ?? DEFAULT_LOGO)

  const browser = await chromium.launch({ headless: config.headless, executablePath: config.chromiumPath })
  try {
    const context = await browser.newContext({ acceptDownloads: true })
    if (config.blockAds) await blockAds(context)
    const page = await context.newPage()
    await watchForAds(page)
    for (const term of terms) {
      try {
        const result = await searchAndDownload(context, page, term, outDirFor(config, term, terms.length), config)
        totals.downloaded += result.downloaded
        totals.skipped += result.skipped
        totals.failed += result.failed
        if (!result.found) totals.notFound.push(term)
      } catch (error) {
        // One broken search must not stop the remaining terms.
        console.error(`  ! "${term}" stopped: ${error.message}`)
        totals.failed += 1
        errored.push(term)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\nDone: ${totals.downloaded} downloaded, ${totals.skipped} already present, ${totals.failed} failed.`)
  if (totals.notFound.length) console.warn(`No subject found for: ${totals.notFound.map((term) => `"${term}"`).join(', ')}`)
  if (totals.notFound.length + errored.length === terms.length) throw new Error('None of the search terms matched a subject or could be searched.')
  return totals
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
