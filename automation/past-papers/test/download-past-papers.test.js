// Runs the downloader end to end against a small local imitation of the PapaCambridge listing.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { isAdRequest } from '../ads.js'
import { folderKey, isPdfLink, isSubfolderLink, matchesSearch, parseFileFilter, pdfFileName, run } from '../download-past-papers.js'

const pdf = (label) => Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`)

// Imitates Google's full-screen vignette ad: covers the page, disables scrolling, and can only be
// closed with the dismiss button inside its iframe (which reports the click to the server).
const vignette = `<script>
  setTimeout(() => {
    const ad = document.createElement('ins')
    ad.className = 'adsbygoogle'
    ad.dataset.vignetteLoaded = 'true'
    ad.style.cssText = 'position:fixed;inset:0;z-index:9999;display:block;background:#000'
    ad.innerHTML = '<iframe style="width:100%;height:100%" srcdoc="<button id=dismiss-button onclick=\\'fetch(&quot;/ad-dismissed&quot;)\\'>Close</button>"></iframe>'
    document.body.append(ad)
    document.body.style.overflow = 'hidden'
    location.hash = 'google_vignette'
  }, 200)
</script>`

const pages = {
  '/papers/caie/igcse': `<!doctype html><input type="search" placeholder="Search subjects">
    <ul id="list">
      <li><a href="/papers/caie/igcse-accounting-0452">Accounting (0452)</a></li>
      <li><a href="/papers/caie/igcse-mathematics-us-0444">Mathematics - US (0444)</a></li>
      <li><a href="/papers/caie/igcse-mathematics-0580">Mathematics (0580)</a></li>
      <li><a href="/papers/caie/igcse-physics-0625?theme=lightTheme">Physics (0625)</a></li>
      <li><a href="/papers/caie/igcse-biology-0610">Biology (0610)</a></li>
    </ul>
    <script>
      document.querySelector('input').addEventListener('input', (e) => {
        for (const li of document.querySelectorAll('li'))
          li.hidden = !li.textContent.toLowerCase().includes(e.target.value.toLowerCase())
      })
    </script>`,
  '/papers/caie/igcse-accounting-0452': `<a href="/papers/caie/igcse-accounting-0452-2023-may-june">2023 May June</a>
    <a href="/papers/caie/igcse-biology-0610">Biology</a>`,
  '/papers/caie/igcse-accounting-0452-2023-may-june': `
    <a href="/directories/CAIE/upload/0452_s23_qp_12.pdf">qp</a>
    <a href="/download_file.php?files=https://example.test/upload/0452_s23_ms_12.pdf">ms</a>
    <a href="/directories/CAIE/upload/0452_s23_broken.pdf">broken</a>`,
  '/papers/caie/igcse-mathematics-us-0444': `${vignette}<a href="/papers/caie/igcse-mathematics-us-0444-2024-oct-nov">2024 Oct Nov</a>`,
  '/papers/caie/igcse-mathematics-us-0444-2024-oct-nov': `${vignette}
    <a href="/directories/CAIE/upload/0444_w24_qp_12.pdf">Question paper 12</a>
    <a href="/directories/CAIE/upload/0444_w24_ms_12.pdf">Mark scheme 12</a>
    <a href="/directories/CAIE/upload/0444_w24_ms_22.pdf">Mark scheme 22</a>
    <a href="/directories/CAIE/upload/0444_w24_er.pdf">Examiner report</a>`,
  '/papers/caie/igcse-mathematics-0580': `<a href="/directories/CAIE/upload/0580_w24_ms_12.pdf">Mark scheme</a>`,
  // Physics 0625 nests its papers five folders deep: subject › year › session › paper › variant.
  '/papers/caie/igcse-physics-0625': `<a href="/papers/caie/igcse-physics-0625-2023">2023</a>
    <a href="/papers/caie/igcse-physics-0625-2022">2022</a>`,
  '/papers/caie/igcse-physics-0625-2023': `<a href="/papers/caie/igcse-physics-0625">Back</a>
    <a href="/papers/caie/igcse-physics-0625-2023/may-june">May June</a>`,
  '/papers/caie/igcse-physics-0625-2023/may-june': `<a href="/papers/caie/igcse-physics-0625-2023/may-june/paper-4?theme=lightTheme">Paper 4</a>`,
  '/papers/caie/igcse-physics-0625-2023/may-june/paper-4': `<a href="/papers/caie/igcse-physics-0625-2023/may-june/paper-4/variant-1/">Variant 1</a>
    <a href="/papers/caie/igcse-physics-0625-2023/may-june/paper-4/variant-2">Variant 2</a>`,
  '/papers/caie/igcse-physics-0625-2023/may-june/paper-4/variant-1': `<a href="/directories/CAIE/upload/0625_s23_ms_41.pdf">ms</a>
    <a href="/papers/caie/igcse-physics-0625-2023/may-june">Up</a>`,
  '/papers/caie/igcse-physics-0625-2023/may-june/paper-4/variant-2': `<a href="/directories/CAIE/upload/0625_s23_ms_42.pdf">ms</a>`,
  '/papers/caie/igcse-physics-0625-2022': `<a href="/papers/caie/igcse-physics-0625-2022/oct-nov">Oct Nov</a>`,
  '/papers/caie/igcse-physics-0625-2022/oct-nov': `<a href="/directories/CAIE/upload/0625_w22_ms_41.pdf">ms</a>`,
  '/papers/caie/igcse-biology-0610': `<a href="/directories/CAIE/upload/0610_s23_qp_11.pdf">bio</a>`,
}

const startServer = () =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost')
      if (!url.pathname.endsWith('.pdf') && url.pathname !== '/download_file.php') {
        server.opened = server.opened || []
        server.opened.push(url.pathname.replace(/\/+$/, ''))
      }
      if (url.pathname.endsWith('/') && url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
      if (url.pathname === '/ad-dismissed') { server.adsDismissed = (server.adsDismissed || 0) + 1; return res.end() }
      if (url.pathname === '/download_file.php') return res.end(pdf(url.searchParams.get('files')))
      if (url.pathname.endsWith('broken.pdf')) return res.end('<html>not a pdf</html>')
      if (url.pathname.endsWith('.pdf')) return res.end(pdf(url.pathname))
      const html = pages[url.pathname]
      res.writeHead(html ? 200 : 404, { 'content-type': 'text/html' })
      res.end(html || 'not found')
    })
    server.listen(0, () => resolve(server))
  })

test('pdf link helpers', () => {
  assert.ok(isPdfLink('https://x.test/a/0452_s23_qp_12.pdf'))
  assert.ok(isPdfLink('https://x.test/download_file.php?files=https://y.test/0452_w22_ms_21.pdf'))
  assert.ok(!isPdfLink('https://x.test/papers/caie/igcse-accounting-0452'))
  assert.equal(pdfFileName('https://x.test/download_file.php?files=https%3A%2F%2Fy.test%2F0452_w22_ms_21.pdf'), '0452_w22_ms_21.pdf')
})

test('searches for the subject and downloads only its valid PDFs, once', async () => {
  const server = await startServer()
  const outDir = await mkdtemp(path.join(tmpdir(), 'past-papers-'))
  const config = {
    searchTerm: 'Accounting',
    blockAds: true,
    startUrl: `http://localhost:${server.address().port}/papers/caie/igcse`,
    outDir,
    maxFiles: 0,
    maxDepth: 0,
    maxPages: 100,
    delayMs: 0,
    fileFilter: null,
    headless: true,
    chromiumPath: process.env.CHROMIUM_PATH,
  }
  try {
    const first = await run(config)
    assert.deepEqual(first, { downloaded: 2, skipped: 0, failed: 1 })
    const files = (await readdir(outDir)).sort()
    assert.deepEqual(files, ['0452_s23_ms_12.pdf', '0452_s23_qp_12.pdf', 'manifest.json'])
    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'))
    assert.equal(Object.keys(manifest.files).length, 2)

    const second = await run(config)
    assert.deepEqual(second, { downloaded: 0, skipped: 2, failed: 1 })
  } finally {
    server.close()
  }
})

test('search, solved-paper filter and ad request helpers', () => {
  assert.ok(matchesSearch('Mathematics 0444', 'Mathematics - US (0444)', 'https://x.test/papers/caie/igcse-mathematics-us-0444'))
  assert.ok(!matchesSearch('Mathematics 0444', 'Mathematics (0580)', 'https://x.test/papers/caie/igcse-mathematics-0580'))
  const solved = parseFileFilter('solved')
  assert.ok(solved.test('0444_w24_ms_12.pdf Mark scheme'))
  assert.ok(!solved.test('0444_w24_qp_12.pdf Question paper'))
  assert.ok(isAdRequest('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'))
  assert.ok(isAdRequest('https://securepubads.g.doubleclick.net/tag/js/gpt.js'))
  assert.ok(!isAdRequest('https://pastpapers.papacambridge.com/papers/caie/igcse'))
})

test('closes the vignette ad and downloads only the solved 0444 papers', async () => {
  const server = await startServer()
  const outDir = await mkdtemp(path.join(tmpdir(), 'past-papers-'))
  try {
    const summary = await run({
      searchTerm: 'Mathematics 0444',
      startUrl: `http://localhost:${server.address().port}/papers/caie/igcse`,
      outDir,
      blockAds: true,
      maxFiles: 0,
      maxDepth: 0,
    maxPages: 100,
      delayMs: 400,
      fileFilter: parseFileFilter('solved'),
      headless: true,
      chromiumPath: process.env.CHROMIUM_PATH,
    })
    assert.deepEqual(summary, { downloaded: 2, skipped: 0, failed: 0 })
    assert.deepEqual((await readdir(outDir)).sort(), ['0444_w24_ms_12.pdf', '0444_w24_ms_22.pdf', 'manifest.json'])
    assert.ok(server.adsDismissed >= 1, 'the dismiss button inside the ad was clicked')
  } finally {
    server.close()
  }
})

test('folder helpers', () => {
  const subject = 'https://x.test/papers/caie/igcse-physics-0625'
  assert.equal(folderKey('https://x.test/a/b/?theme=lightTheme#google_vignette'), folderKey('https://x.test/a/b'))
  assert.ok(isSubfolderLink('https://x.test/papers/caie/igcse-physics-0625-2023/may-june', subject))
  assert.ok(!isSubfolderLink('https://x.test/papers/caie/igcse-physics-0625/?theme=lightTheme', subject))
  assert.ok(!isSubfolderLink('https://x.test/papers/caie/igcse-biology-0610', subject))
  assert.ok(!isSubfolderLink('https://x.test/directories/CAIE/upload/0625_s23_ms_41.pdf', subject))
})

const physicsConfig = async (server, overrides = {}) => ({
  searchTerm: 'Physics 0625',
  startUrl: `http://localhost:${server.address().port}/papers/caie/igcse`,
  outDir: await mkdtemp(path.join(tmpdir(), 'past-papers-')),
  blockAds: true,
  maxFiles: 0,
  maxDepth: 0,
  maxPages: 100,
  delayMs: 0,
  fileFilter: parseFileFilter('solved'),
  headless: true,
  chromiumPath: process.env.CHROMIUM_PATH,
  ...overrides,
})

test('keeps opening subfolders, however deep, until it reaches the PDFs', async () => {
  const server = await startServer()
  try {
    const config = await physicsConfig(server)
    const summary = await run(config)
    assert.deepEqual(summary, { downloaded: 3, skipped: 0, failed: 0 })
    assert.deepEqual((await readdir(config.outDir)).sort(), ['0625_s23_ms_41.pdf', '0625_s23_ms_42.pdf', '0625_w22_ms_41.pdf', 'manifest.json'])
    const opened = server.opened.filter((page) => page.includes('physics'))
    assert.equal(new Set(opened).size, opened.length, 'no folder is opened twice')
  } finally {
    server.close()
  }
})

test('stops opening folders once MAX_FILES PDFs are downloaded', async () => {
  const server = await startServer()
  try {
    const summary = await run(await physicsConfig(server, { maxFiles: 1 }))
    assert.deepEqual(summary, { downloaded: 1, skipped: 0, failed: 0 })
    assert.ok(!server.opened.some((page) => page.includes('0625-2022')), 'the 2022 folders were never opened')
  } finally {
    server.close()
  }
})

test('MAX_DEPTH still limits how deep it goes when set', async () => {
  const server = await startServer()
  try {
    const summary = await run(await physicsConfig(server, { maxDepth: 2 }))
    assert.deepEqual(summary, { downloaded: 1, skipped: 0, failed: 0 })
  } finally {
    server.close()
  }
})
