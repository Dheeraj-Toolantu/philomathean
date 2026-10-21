// Runs the Cambridge downloader against an imitation of cambridgeinternational.org served by a
// fake fetch, so no request leaves the machine.
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib'
import { cambridgeCodeName, extractLinks, isAllowed, isCambridgeUrl, parseRobots, run, syllabusCode } from '../cambridge-past-papers.js'
import { watermarkPdf } from '../rebrand-pdf.js'

const SITE = 'https://www.cambridgeinternational.org'
const LISTING = `${SITE}/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/`
const SUBJECT = `${SITE}/programmes-and-qualifications/cambridge-igcse-mathematics-0580/`

const pageStreams = (doc, page) => {
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents]
  return streams.map((stream) => Buffer.from(stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents()).toString('latin1'))
}

// A paper laid out like Cambridge's: question text, the "© UCLES" copyright line and Cambridge's
// name in the footer, and Cambridge's document properties.
const cambridgePdf = async (label) => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595.28, 841.89])
  page.drawText(`Question 1 ${label}`, { x: 72, y: 700, size: 12, font })
  page.drawText('© UCLES 2023', { x: 36, y: 30, size: 8, font })
  page.drawText('Cambridge International Examinations', { x: 300, y: 30, size: 8, font })
  doc.setAuthor('Cambridge University Press & Assessment')
  doc.setTitle(`0580/12 ${label}`)
  return Buffer.from(await doc.save())
}

const site = async ({ robots = 'User-agent: *\nDisallow: /search/\n' } = {}) => {
  const pdfs = {
    '/Images/649425-june-2023-question-paper-12.pdf': await cambridgePdf('June 2023'),
    '/Images/649433-june-2023-mark-scheme-12.pdf': await cambridgePdf('Mark scheme'),
    '/Images/595426-2025-specimen-paper-1.pdf': await cambridgePdf('Specimen'),
    '/Images/broken.pdf': Buffer.from('<html>not a pdf</html>'),
    '/search/hidden.pdf': await cambridgePdf('hidden'),
  }
  const pages = {
    '/robots.txt': robots,
    [new URL(LISTING).pathname]: `<ul>
      <li><a href="/programmes-and-qualifications/cambridge-igcse-accounting-0452/">Cambridge IGCSE Accounting (0452)</a></li>
      <li><a href="/programmes-and-qualifications/cambridge-igcse-mathematics-0580/">Cambridge IGCSE Mathematics (0580)</a></li>
    </ul>`,
    [new URL(SUBJECT).pathname]: `<h2>Specimen papers</h2>
      <a href="/Images/595426-2025-specimen-paper-1.pdf">2025 Specimen Paper 1 (PDF, 1MB)</a>
      <a href="https://example.com/other.pdf">Not Cambridge</a>`,
    [`${new URL(SUBJECT).pathname}past-papers/`]: `<h2>Past papers</h2>
      <a href="/Images/649425-june-2023-question-paper-12.pdf">June 2023 Question Paper 12 (PDF, 1MB)</a>
      <a href="/Images/649433-june-2023-mark-scheme-12.pdf">June 2023 Mark Scheme 12 (PDF, 200KB)</a>
      <a href="/Images/broken.pdf">Broken</a>
      <a href="/search/hidden.pdf">June 2023 Question Paper 13</a>`,
  }
  const requests = []
  const fetchImpl = async (url, { headers } = {}) => {
    const { pathname, origin } = new URL(url)
    requests.push({ url: String(url), userAgent: headers?.['User-Agent'] })
    assert.equal(origin, SITE, `unexpected request to ${url}`)
    if (pdfs[pathname]) return new Response(pdfs[pathname], { status: 200 })
    if (pages[pathname] != null) return new Response(pages[pathname], { status: 200, headers: { 'content-type': 'text/html' } })
    return new Response('not found', { status: 404 })
  }
  return { fetchImpl, requests }
}

const quiet = { log: () => {}, warn: () => {}, error: () => {} }
const config = (outDir, extra = {}) => ({ subjects: ['Mathematics 0580'], listingUrls: [LISTING], outDir, delayMs: 0, ...extra })

test('reads robots.txt rules for our user agent', () => {
  const robots = parseRobots('User-agent: *\nDisallow: /private/\nAllow: /private/open\nCrawl-delay: 5\n\nUser-agent: OtherBot\nDisallow: /\n', 'PhilomatheanPastPapers/1.0')
  assert.equal(robots.crawlDelay, 5)
  assert.equal(isAllowed(robots, `${SITE}/Images/a.pdf`), true)
  assert.equal(isAllowed(robots, `${SITE}/private/x`), false)
  assert.equal(isAllowed(robots, `${SITE}/private/open/x`), true)
  const named = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: PhilomatheanPastPapers\nDisallow: /Images/*.pdf$\n')
  assert.equal(isAllowed(named, `${SITE}/Images/a.pdf`), false)
  assert.equal(isAllowed(named, `${SITE}/Images/a.pdf?x=1`), true)
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:\n'), `${SITE}/anything`), true)
})

test('reads links, syllabus codes and paper names from Cambridge pages', () => {
  const links = extractLinks('<a class="x" href="/Images/1-june-2023-question-paper-12.pdf"><span>June 2023</span> Question Paper 12 &amp; more</a><a href="mailto:a@b">mail</a>', `${SITE}/a/`)
  assert.deepEqual(links, [{ href: `${SITE}/Images/1-june-2023-question-paper-12.pdf`, text: 'June 2023 Question Paper 12 & more' }])
  assert.equal(isCambridgeUrl(`${SITE}/x.pdf`), true)
  assert.equal(isCambridgeUrl('https://cambridgeinternational.org.evil.com/x.pdf'), false)
  assert.equal(syllabusCode('Cambridge IGCSE Mathematics (0580)'), '0580')
  assert.equal(syllabusCode('', SUBJECT), '0580')
  const name = (text, href = `${SITE}/Images/1.pdf`) => cambridgeCodeName({ text, href, syllabus: '0580' })
  assert.equal(name('June 2023 Question Paper 12 (PDF, 1MB)'), '0580_s23_qp_12.pdf')
  assert.equal(name('November 2022 Mark Scheme 42'), '0580_w22_ms_42.pdf')
  assert.equal(name('March 2024 Insert 22'), '0580_m24_in_22.pdf')
  assert.equal(name('June 2023 Principal Examiner Report'), '0580_s23_er.pdf')
  assert.equal(name('2025 Specimen Paper Mark Scheme 2'), '0580_y25_sm_2.pdf')
  assert.equal(name('2025 Specimen Paper 1'), '0580_y25_sp_1.pdf')
  assert.equal(name('Download', `${SITE}/Images/649425-june-2023-question-paper-12.pdf`), '0580_s23_qp_12.pdf')
  assert.equal(name('Syllabus overview'), null)
})

test('adds the Philomathean watermark without touching the Cambridge copyright notice or properties', async () => {
  const original = await cambridgePdf('June 2023')
  const before = await PDFDocument.load(original)
  const [originalStream] = pageStreams(before, before.getPage(0))
  const doc = await PDFDocument.load(await watermarkPdf(original))
  const streams = pageStreams(doc, doc.getPage(0))
  assert.ok(streams.length > 1, 'the watermark is drawn in a stream of its own')
  assert.ok(streams.includes(originalStream), 'the original page content, copyright line included, is unchanged')
  assert.match(streams.filter((stream) => stream !== originalStream).join('\n'), /Do/, 'the logo is drawn')
  assert.equal(doc.getAuthor(), 'Cambridge University Press & Assessment')
  assert.equal(doc.getTitle(), '0580/12 June 2023')
})

test('downloads the Cambridge subject’s papers once, watermarked and renamed, obeying robots.txt', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'cambridge-'))
  const { fetchImpl, requests } = await site()
  const totals = await run(config(outDir), { fetchImpl, log: quiet })
  assert.deepEqual({ downloaded: totals.downloaded, failed: totals.failed }, { downloaded: 3, failed: 1 })

  const folder = path.join(outDir, 'mathematics-0580')
  assert.deepEqual((await readdir(folder)).sort(), [
    '2023 May-June - Mathematics 0580 - Mark Scheme - Paper 12.pdf',
    '2023 May-June - Mathematics 0580 - Question Paper - Paper 12.pdf',
    '2025 Specimen - Mathematics 0580 - Specimen Paper - Paper 1.pdf',
    'manifest.json',
  ])
  const saved = await PDFDocument.load(await readFile(path.join(folder, '2023 May-June - Mathematics 0580 - Question Paper - Paper 12.pdf')))
  assert.equal(saved.getAuthor(), 'Cambridge University Press & Assessment')
  assert.ok(pageStreams(saved, saved.getPage(0)).length > 1)

  const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'))
  const entry = manifest.files[`${SITE}/Images/649425-june-2023-question-paper-12.pdf`]
  assert.equal(entry.watermarked, true)
  assert.match(entry.copyright, /Cambridge University Press & Assessment/)

  assert.equal(requests[0].url, `${SITE}/robots.txt`)
  assert.ok(requests.every(({ userAgent }) => /^PhilomatheanPastPapers\//.test(userAgent)))
  assert.ok(!requests.some(({ url }) => url.includes('/search/')), 'disallowed paths are never requested')
  assert.ok(!requests.some(({ url }) => url.includes('example.com')), 'links to other sites are ignored')

  requests.length = 0
  const again = await run(config(outDir), { fetchImpl, log: quiet })
  assert.equal(again.downloaded, 0)
  assert.equal(again.skipped, 3)
  assert.ok(!requests.some(({ url }) => url.endsWith('.pdf') && !url.includes('broken')), 'saved papers are not fetched again')
})

test('waits between requests and honours a longer Crawl-delay', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'cambridge-'))
  const { fetchImpl, requests } = await site({ robots: 'User-agent: *\nCrawl-delay: 0.2\n' })
  const times = []
  const timed = async (url, options) => {
    times.push(Date.now())
    return fetchImpl(url, options)
  }
  await run(config(outDir, { delayMs: 50, maxFiles: 1, fileFilter: /question/i }), { fetchImpl: timed, log: quiet })
  assert.ok(requests.length >= 4)
  for (let i = 2; i < times.length; i += 1) assert.ok(times[i] - times[i - 1] >= 190, `request ${i} came ${times[i] - times[i - 1]} ms after the last`)
})

test('lists the papers without downloading in a dry run, and reports subjects it cannot find', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'cambridge-'))
  const { fetchImpl, requests } = await site()
  const lines = []
  const totals = await run(config(outDir, { subjects: ['Mathematics 0580', 'Physics 0625'], dryRun: true }), { fetchImpl, log: { ...quiet, log: (line) => lines.push(line) } })
  assert.equal(totals.downloaded, 0)
  assert.deepEqual(totals.notFound, ['Physics 0625'])
  assert.ok(lines.some((line) => line.includes('2023 May-June - Mathematics 0580 - Question Paper - Paper 12.pdf')))
  assert.ok(!requests.some(({ url }) => url.endsWith('.pdf')))
  assert.deepEqual(await readdir(outDir), [])
})
