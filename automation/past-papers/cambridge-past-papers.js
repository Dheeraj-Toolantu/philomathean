// Downloads the past papers and specimen papers that Cambridge International publishes on its
// public subject pages (cambridgeinternational.org) and adds the Philomathean watermark to them.
//
// Only the Philomathean logo, name and footer are added (watermarkPdf in rebrand-pdf.js). Nothing on
// the page is removed or covered: Cambridge's copyright notices, logos and document properties stay
// exactly as published. Cambridge University Press & Assessment holds the copyright in these papers;
// confirm you have permission before hosting them publicly (see README.md).
//
// The site's robots.txt is fetched first and obeyed (Disallow/Allow and Crawl-delay), requests are
// made one at a time with a pause between each, and every request identifies itself with USER_AGENT.
//
// For each line of cambridge-subjects.txt (one per line, # starts a comment):
//   - a subject, e.g. "Mathematics 0580": found on the subject listing pages (LISTING_URLS), then its
//     subject page and its /past-papers/ page are read;
//   - or a full https://www.cambridgeinternational.org/... page URL, which is read as it is.
// Every PDF linked from those pages is downloaded (HTTP 200, %PDF header, size limit), watermarked
// and named after its year and content, e.g. "June 2023 Question Paper 12" →
// "2023 May-June - Mathematics 0580 - Question Paper - Paper 12.pdf". manifest.json records each
// source URL so re-runs only fetch new papers.
//
// Configuration (environment variables):
//   SUBJECTS_FILE   text file with one subject or URL per line    default cambridge-subjects.txt
//   SUBJECT         just this subject or URL instead of the file
//   LISTING_URLS    comma-separated subject listing pages to       default Cambridge IGCSE, O Level
//                   search for subject names                       and AS & A Level subject lists
//   OUT_DIR         where PDFs are written (a subfolder per line)  default <repo>/past-papers/cambridge
//   MAX_FILES       per line: stop after this many new downloads  default 0 (no limit)
//   DELAY_MS        pause between requests; raised to the site's   default 3000
//                   Crawl-delay when that is longer
//   FILE_FILTER     regex a PDF's link text or file name must      default "" (all)
//                   match; "solved" is a shortcut for mark schemes
//   WATERMARK       "false" to keep PDFs exactly as downloaded     default true
//   WATERMARK_LOGO  logo stamped on every page                     default <repo>/logo.png
//   USER_AGENT      sent with every request                        default PhilomatheanPastPapers/1.0
//   DRY_RUN         "true" to list the PDFs without downloading    default false
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandedFileName, DEFAULT_LOGO, loadWatermarkLogo, watermarkPdf } from './rebrand-pdf.js'
import { isPdfBuffer, matchesSearch, parseFileFilter, parseSearchTerms, slugify } from './download-past-papers.js'

const MAX_PDF_BYTES = 50 * 1024 * 1024
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SITE = 'https://www.cambridgeinternational.org'
export const DEFAULT_LISTING_URLS = [
  `${SITE}/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/`,
  `${SITE}/programmes-and-qualifications/cambridge-upper-secondary/cambridge-o-level/subjects/`,
  `${SITE}/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/`,
]
export const DEFAULT_USER_AGENT = 'PhilomatheanPastPapers/1.0 (+https://github.com/Dheeraj-Toolantu/philomathean)'
export const COPYRIGHT_NOTE = '© Cambridge University Press & Assessment (UCLES). Downloaded from cambridgeinternational.org; ' +
  'copyright notices left intact. Confirm permission before hosting publicly.'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------------------------
// robots.txt

// Returns the rules that apply to `userAgent`: the groups naming it, or else the "*" groups.
export const parseRobots = (text, userAgent = DEFAULT_USER_AGENT) => {
  const token = userAgent.split('/')[0].toLowerCase()
  const groups = []
  let current = null
  let lastWasAgent = false
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const match = line.match(/^([\w-]+)\s*:\s*(.*)$/)
    if (!match) continue
    const [field, value] = [match[1].toLowerCase(), match[2].trim()]
    if (field === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [], crawlDelay: null }))
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (field === 'allow' || field === 'disallow') {
      if (value) current.rules.push({ allow: field === 'allow', pattern: value }) // an empty Disallow allows everything
    } else if (field === 'crawl-delay' && Number.isFinite(Number(value))) {
      current.crawlDelay = Number(value)
    }
  }
  const named = groups.filter((group) => group.agents.some((agent) => agent !== '*' && token.includes(agent)))
  const chosen = named.length ? named : groups.filter((group) => group.agents.includes('*'))
  const delays = chosen.map((group) => group.crawlDelay).filter((delay) => delay != null)
  return { rules: chosen.flatMap((group) => group.rules), crawlDelay: delays.length ? Math.max(...delays) : null }
}

// "*" matches anything and a trailing "$" anchors the end; everything else is literal.
const patternToRegex = (pattern) => {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

// Longest matching rule wins; Allow wins a tie. No matching rule means allowed.
export const isAllowed = (robots, url) => {
  const { pathname, search } = new URL(url)
  const target = `${pathname}${search}`
  let best = null
  for (const rule of robots.rules) {
    if (!patternToRegex(rule.pattern).test(target)) continue
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule
  }
  return !best || best.allow
}

// ---------------------------------------------------------------------------------------------
// Polite HTTP client: one request at a time, robots.txt checked per URL, a pause between requests.

export const createClient = async ({ origin, userAgent = DEFAULT_USER_AGENT, delayMs = 3000, fetchImpl = fetch, log = console } = {}) => {
  const headers = { 'User-Agent': userAgent }
  let robots = { rules: [], crawlDelay: null }
  const response = await fetchImpl(new URL('/robots.txt', origin), { headers })
  if (response.ok) robots = parseRobots(await response.text(), userAgent)
  else if (response.status >= 500) throw new Error(`robots.txt returned HTTP ${response.status}; not crawling ${origin}`)
  const pause = Math.max(delayMs, (robots.crawlDelay ?? 0) * 1000)
  if (robots.crawlDelay) log.log(`robots.txt asks for a ${robots.crawlDelay}s crawl delay; waiting ${pause} ms between requests.`)
  let last = Date.now()

  const get = async (url) => {
    if (!isAllowed(robots, url)) throw Object.assign(new Error(`robots.txt disallows ${new URL(url).pathname}`), { robots: true })
    const wait = last + pause - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      let result = await fetchImpl(url, { headers, redirect: 'follow' })
      // Back off once when the site asks us to slow down.
      if (result.status === 429 || result.status === 503) {
        const retryAfter = Math.min(120, Number(result.headers.get('retry-after')) || 30)
        log.warn(`  ! HTTP ${result.status} for ${url}; waiting ${retryAfter}s before one retry`)
        await sleep(retryAfter * 1000)
        result = await fetchImpl(url, { headers, redirect: 'follow' })
      }
      return result
    } finally {
      last = Date.now()
    }
  }
  return { get, robots, pause }
}

// ---------------------------------------------------------------------------------------------
// Pages and links

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' }
const decodeEntities = (value) =>
  value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, code) => {
    if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
    return ENTITIES[code.toLowerCase()] ?? whole
  })

// Every <a href> on a page, resolved against the page URL, with its visible text.
export const extractLinks = (html, baseUrl) => {
  const links = []
  for (const [, , href, inner] of String(html).matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeEntities(href.trim()), baseUrl)
      if (!/^https?:$/.test(url.protocol)) continue
      url.hash = ''
      const text = decodeEntities(inner.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
      links.push({ href: url.href, text })
    } catch {
      // Not a URL; ignore.
    }
  }
  return links
}

export const isCambridgeUrl = (href) => {
  try {
    const { hostname } = new URL(href)
    return hostname === 'cambridgeinternational.org' || hostname.endsWith('.cambridgeinternational.org')
  } catch {
    return false
  }
}

const isPdf = (href) => /\.pdf$/i.test(new URL(href).pathname)

// The four-digit syllabus code in a subject's link text or URL, e.g. "...-mathematics-0580/".
export const syllabusCode = (...values) => values.map((value) => String(value).match(/(?:^|\D)(\d{4})(?:\D|$)/)?.[1]).find(Boolean) || ''

// ---------------------------------------------------------------------------------------------
// File names

const SERIES = [
  [/\bspecimen\b/i, 'y'],
  [/\b(?:feb(?:ruary)?[\s-]*)?march\b/i, 'm'],
  [/\b(?:may[\s-]*)?june\b/i, 's'],
  [/\b(?:oct(?:ober)?[\s-]*)?nov(?:ember)?\b/i, 'w'],
]
const TYPES = [
  // Cambridge writes "2025 Specimen Paper 1 Mark Scheme", with the paper number in the middle.
  [/specimen\s+(?:paper\s+)?(?:\d{1,2}\s+)?mark\s+scheme/i, 'sm'],
  [/specimen\s+(?:paper\s+)?(?:\d{1,2}\s+)?insert/i, 'si'],
  [/specimen\s+(?:paper\s+)?(?:\d{1,2}\s+)?(?:examiner\s+)?report/i, 'sr'],
  [/specimen\s+paper/i, 'sp'],
  [/mark\s+scheme/i, 'ms'],
  [/question\s+paper/i, 'qp'],
  [/examiner(?:'?s)?\s+report/i, 'er'],
  [/grade\s+thresholds?/i, 'gt'],
  [/confidential\s+instructions/i, 'ci'],
  [/pre[\s-]*release/i, 'pm'],
  [/source\s+files?/i, 'sf'],
  [/\binsert\b/i, 'in'],
]

// Reads the series, year, content and paper number from a Cambridge link, e.g. link text
// "June 2023 Question Paper 12" or file name "649425-june-2023-question-paper-12.pdf", and returns
// the matching CAIE-style name ("0580_s23_qp_12.pdf"), or null when the link doesn't say enough.
export const cambridgeCodeName = ({ text = '', href = '', syllabus = '' }) => {
  if (!/^\d{4}$/.test(syllabus)) return null
  const fileWords = decodeURIComponent(path.posix.basename(href ? new URL(href).pathname : ''))
    .replace(/\.pdf$/i, '')
    .replace(/^\d{4,}[-_]/, '') // Cambridge prefixes uploads with a numeric id
    .replace(/[-_]+/g, ' ')
  for (const source of [text, fileWords]) {
    const words = source.replace(/\((?:pdf|doc)[^)]*\)/gi, ' ').replace(/\s+/g, ' ')
    const type = TYPES.find(([pattern]) => pattern.test(words))?.[1]
    const series = SERIES.find(([pattern]) => pattern.test(words))?.[1]
    const year = words.match(/\b20(\d{2})\b/)?.[1]
    if (!type || !series || !year) continue
    const variant = words.replace(/\b(?:19|20)\d{2}\b/g, ' ').match(/\b(\d{1,2})\b(?!.*\b\d{1,2}\b)/)?.[1]
    return `${syllabus}_${series}${year}_${type}${variant ? `_${variant}` : ''}.pdf`
  }
  return null
}

// Local name for a PDF before watermarking: the CAIE-style name when the link can be read,
// otherwise the link's own file name made safe.
export const localFileName = (link, syllabus) =>
  cambridgeCodeName({ ...link, syllabus }) ||
  path.posix.basename(new URL(link.href).pathname).replace(/[^A-Za-z0-9._-]+/g, '_')

// ---------------------------------------------------------------------------------------------
// Configuration

export const readSubjects = async (file) => {
  if (!existsSync(file)) throw new Error(`Subjects file not found: ${file}`)
  const subjects = parseSearchTerms(await readFile(file, 'utf8'))
  if (!subjects.length) throw new Error(`${file} has no subjects; add one per line, e.g. "Mathematics 0580"`)
  return subjects
}

const readConfig = async () => {
  const file = path.resolve(process.env.SUBJECTS_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'cambridge-subjects.txt'))
  return {
    subjects: process.env.SUBJECT?.trim() ? [process.env.SUBJECT.trim()] : await readSubjects(file),
    listingUrls: process.env.LISTING_URLS ? process.env.LISTING_URLS.split(',').map((url) => url.trim()).filter(Boolean) : DEFAULT_LISTING_URLS,
    outDir: path.resolve(repoRoot, process.env.OUT_DIR || 'past-papers/cambridge'),
    maxFiles: Number(process.env.MAX_FILES || 0),
    delayMs: Number(process.env.DELAY_MS ?? 3000),
    fileFilter: parseFileFilter(process.env.FILE_FILTER),
    watermark: process.env.WATERMARK !== 'false',
    logoPath: path.resolve(process.env.WATERMARK_LOGO || DEFAULT_LOGO),
    userAgent: process.env.USER_AGENT || DEFAULT_USER_AGENT,
    dryRun: process.env.DRY_RUN === 'true',
  }
}

// ---------------------------------------------------------------------------------------------
// Crawl

const fetchPage = async (client, url) => {
  const response = await client.get(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return extractLinks(await response.text(), response.url || url)
}

// The pages to read for one line: the URL itself, or a subject's page and its past-papers page.
const pagesFor = async (client, subject, listingUrls, log) => {
  if (/^https?:\/\//i.test(subject)) return { pages: [subject], syllabus: syllabusCode(subject), name: subject }
  for (const listingUrl of listingUrls) {
    let links
    try {
      links = await fetchPage(client, listingUrl)
    } catch (error) {
      log.warn(`  ! Could not read ${listingUrl}: ${error.message}`)
      continue
    }
    const match = links.find(({ href, text }) => isCambridgeUrl(href) && !isPdf(href) && text && matchesSearch(subject, text, href))
    if (match) {
      const page = match.href.endsWith('/') ? match.href : `${match.href}/`
      return { pages: [page, new URL('past-papers/', page).href], syllabus: syllabusCode(match.text, match.href, subject), name: match.text }
    }
  }
  return null
}

const loadManifest = async (file) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { files: {} })

const downloadOne = async (client, link, outDir, manifest, { name, subject, watermark, logoPath }) => {
  const response = await client.get(link.href)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  if (!isPdfBuffer(body)) throw new Error('response is not a PDF')
  if (body.length > MAX_PDF_BYTES) throw new Error(`file is larger than ${MAX_PDF_BYTES} bytes`)
  const savedAs = (watermark && brandedFileName(name, { subject })) || name
  const bytes = watermark ? await watermarkPdf(body, { logoPath }) : body
  await writeFile(path.join(outDir, savedAs), bytes)
  manifest.files[link.href] = {
    linkText: link.text,
    savedAs,
    bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    watermarked: watermark,
    downloadedAt: new Date().toISOString(),
    copyright: COPYRIGHT_NOTE,
  }
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return { savedAs, bytes: bytes.length }
}

const downloadSubject = async (client, subject, config, log) => {
  const summary = { downloaded: 0, skipped: 0, failed: 0, blocked: 0, found: true }
  log.log(`\n=== "${subject}" ===`)
  const target = await pagesFor(client, subject, config.listingUrls, log)
  if (!target) {
    log.warn(`  ! No Cambridge subject page matching "${subject}" was found; skipping it.`)
    return { ...summary, found: false }
  }

  const pdfs = new Map()
  for (const page of target.pages) {
    log.log(`Reading ${page}`)
    try {
      for (const link of await fetchPage(client, page)) {
        if (isCambridgeUrl(link.href) && isPdf(link.href) && !pdfs.has(link.href)) pdfs.set(link.href, link)
      }
    } catch (error) {
      log.warn(`  ! ${error.message}`)
    }
  }
  log.log(`Found ${pdfs.size} PDF link(s).`)

  const outDir = path.join(config.outDir, slugify(/^https?:/i.test(subject) ? `${target.syllabus || new URL(subject).pathname}` : subject))
  const manifest = await loadManifest(path.join(outDir, 'manifest.json'))
  if (!config.dryRun) await mkdir(outDir, { recursive: true })
  const subjectName = /^https?:/i.test(subject) ? '' : subject
  for (const link of pdfs.values()) {
    const name = localFileName(link, target.syllabus)
    if (config.fileFilter && !config.fileFilter.test(`${name} ${link.text}`)) continue
    if (manifest.files[link.href]) {
      summary.skipped += 1
      continue
    }
    if (config.dryRun) {
      log.log(`    · ${link.text || name} → ${(config.watermark && brandedFileName(name, { subject: subjectName })) || name}`)
      continue
    }
    try {
      const { savedAs, bytes } = await downloadOne(client, link, outDir, manifest, { ...config, name, subject: subjectName })
      summary.downloaded += 1
      log.log(`    ✓ ${link.text || name} → ${savedAs} (${bytes} bytes)`)
    } catch (error) {
      if (error.robots) {
        summary.blocked += 1
        log.log(`    · ${link.text || name}: skipped, ${error.message}`)
        continue
      }
      summary.failed += 1
      log.warn(`    ✗ ${link.text || name}: ${error.message}`)
    }
    if (config.maxFiles && summary.downloaded >= config.maxFiles) {
      log.log(`Reached MAX_FILES=${config.maxFiles} for "${subject}".`)
      break
    }
  }
  log.log(`"${subject}": ${summary.downloaded} downloaded, ${summary.skipped} already present, ${summary.failed} failed` +
    `${summary.blocked ? `, ${summary.blocked} disallowed by robots.txt` : ''} → ${path.relative(repoRoot, outDir) || '.'}`)
  return summary
}

export const run = async (config, { fetchImpl = fetch, log = console } = {}) => {
  config ??= await readConfig()
  config = { listingUrls: DEFAULT_LISTING_URLS, delayMs: 3000, watermark: true, logoPath: DEFAULT_LOGO, userAgent: DEFAULT_USER_AGENT, ...config }
  log.log(`Subjects (${config.subjects.length}): ${config.subjects.map((subject) => `"${subject}"`).join(', ')}`)
  log.log('Cambridge papers are © Cambridge University Press & Assessment; confirm permission before hosting them publicly.')
  if (config.watermark) await loadWatermarkLogo(config.logoPath)

  const origins = new Set([...config.listingUrls, ...config.subjects.filter((subject) => /^https?:/i.test(subject))].map((url) => new URL(url).origin))
  const clients = new Map()
  // One client (and one robots.txt) per site; pages and PDFs on another host are refused by isCambridgeUrl.
  const clientFor = async (url) => {
    const { origin } = new URL(url)
    if (!clients.has(origin)) clients.set(origin, await createClient({ origin, userAgent: config.userAgent, delayMs: config.delayMs, fetchImpl, log }))
    return clients.get(origin)
  }
  for (const origin of origins) await clientFor(origin)
  const client = { get: async (url) => (await clientFor(url)).get(url) }

  const totals = { downloaded: 0, skipped: 0, failed: 0, notFound: [] }
  for (const subject of config.subjects) {
    try {
      const result = await downloadSubject(client, subject, config, log)
      totals.downloaded += result.downloaded
      totals.skipped += result.skipped
      totals.failed += result.failed
      if (!result.found) totals.notFound.push(subject)
    } catch (error) {
      log.error(`  ! "${subject}" stopped: ${error.message}`)
      totals.failed += 1
    }
  }
  log.log(`\nDone: ${totals.downloaded} downloaded, ${totals.skipped} already present, ${totals.failed} failed.`)
  if (totals.notFound.length) log.warn(`No subject found for: ${totals.notFound.map((subject) => `"${subject}"`).join(', ')}`)
  return totals
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
