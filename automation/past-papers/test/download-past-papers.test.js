// Runs the downloader end to end against a small local imitation of the PapaCambridge listing.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { isPdfLink, pdfFileName, run } from '../download-past-papers.js'

const pdf = (label) => Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`)

const pages = {
  '/papers/caie/igcse': `<!doctype html><input type="search" placeholder="Search subjects">
    <ul id="list">
      <li><a href="/papers/caie/igcse-accounting-0452">Accounting (0452)</a></li>
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
  '/papers/caie/igcse-biology-0610': `<a href="/directories/CAIE/upload/0610_s23_qp_11.pdf">bio</a>`,
}

const startServer = () =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost')
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
    startUrl: `http://localhost:${server.address().port}/papers/caie/igcse`,
    outDir,
    maxFiles: 0,
    maxDepth: 3,
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
