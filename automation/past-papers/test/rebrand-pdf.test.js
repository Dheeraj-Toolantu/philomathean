import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { brandedFileName, graphicsStateBlocks, rebrandFolder, rebrandPdf, stripWatermarkFromContent, subjectLabel } from '../rebrand-pdf.js'
import { watermarkedPdf } from './fixtures.js'

const pageText = (doc, page) => {
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents]
  return streams.map((stream) => Buffer.from(stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents()).toString('latin1')).join('\n')
}

test('names papers after their year, session, subject and content', () => {
  assert.equal(subjectLabel('Mathematics 0444'), 'Mathematics')
  assert.equal(subjectLabel('business studies'), 'Business Studies')
  assert.equal(brandedFileName('0452_s23_ms_12.pdf', { subject: 'Accounting 0452' }), '2023 May-June - Accounting 0452 - Mark Scheme - Paper 12.pdf')
  assert.equal(brandedFileName('0452_w19_qp_21.pdf', { subject: 'Accounting' }), '2019 Oct-Nov - Accounting 0452 - Question Paper - Paper 21.pdf')
  assert.equal(brandedFileName('0444_m24_er.pdf', { subject: 'Mathematics 0444' }), '2024 Feb-March - Mathematics 0444 - Examiner Report.pdf')
  assert.equal(brandedFileName('0452_s26_gt.pdf'), '2026 May-June - 0452 - Grade Thresholds.pdf')
  assert.equal(brandedFileName('0452_y25_sp_1.pdf', { subject: 'Accounting' }), '2025 Specimen - Accounting 0452 - Specimen Paper - Paper 1.pdf')
  assert.equal(brandedFileName('download.pdf', { title: '0452/11 Mark Scheme June 2026 - PapaCambridge' }), '2026 - 0452-11 Mark Scheme June 2026.pdf')
  assert.equal(brandedFileName('download.pdf', { title: '' }), null)
})

test('removes only the PapaCambridge overlay blocks from a content stream', () => {
  const content = 'q 1 0 0 1 0 0 cm BT /F1 12 Tf 14.4 TL ET /FormXob.pcm Do Q\nq BT (keep \\(Q\\) q) Tj ET Q\nq 1 0 0 1 0 0 cm BT /F1 12 Tf 14.4 TL ET (PapaCambridge) Tj Q'
  assert.equal(graphicsStateBlocks(content).length, 3)
  const { content: cleaned, removed } = stripWatermarkFromContent(content)
  assert.equal(removed, 2)
  assert.equal(cleaned.trim(), 'q BT (keep \\(Q\\) q) Tj ET Q')
  // A ReportLab-made paper without PapaCambridge markers is left alone.
  assert.equal(stripWatermarkFromContent('q 1 0 0 1 0 0 cm BT /F1 12 Tf 14.4 TL ET (Q1) Tj Q').removed, 0)
})

test('swaps the PapaCambridge watermark and properties for Philomathean ones', async () => {
  const result = await rebrandPdf(await watermarkedPdf('0452/12'), { fileName: '0452_s23_qp_12.pdf', subject: 'Accounting 0452' })
  assert.equal(result.name, '2023 May-June - Accounting 0452 - Question Paper - Paper 12.pdf')
  assert.equal(result.removed, 2)
  const doc = await PDFDocument.load(result.bytes)
  const [page] = doc.getPages()
  const text = pageText(doc, page)
  assert.doesNotMatch(text, /papacambridge|FormXob\.pcm|gRLs|Trace ID/i)
  assert.match(text, /\(Question 1 \\\(a\\\) Q q \) Tj/, 'the paper itself is kept')
  const xObjects = page.node.Resources().lookup(PDFName.of('XObject'))
  assert.ok(!xObjects.has(PDFName.of('FormXob.pcm')), 'the PapaCambridge logo form is dropped')
  assert.ok(xObjects.keys().some((key) => /^Image/.test(key.decodeText())), 'the Philomathean logo is drawn')
  assert.equal(doc.getTitle(), '2023 May-June - Accounting 0452 - Question Paper - Paper 12 | Philomathean')
  assert.equal(doc.getAuthor(), 'Philomathean')
  assert.ok(!doc.getInfoDict().has(PDFName.of('PC_TraceID')))
  assert.doesNotMatch(result.bytes.toString('latin1'), /papacambridge/i)
})

test('rebrands a folder downloaded earlier and records the new names in its manifest', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'rebrand-'))
  await writeFile(path.join(folder, '0452_s23_qp_12.pdf'), await watermarkedPdf('qp'))
  await writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ files: { '0452_s23_qp_12.pdf': { source: 'https://x.test/0452_s23_qp_12.pdf' } } }))
  const results = await rebrandFolder(folder, { subject: 'accounting 0452' })
  assert.deepEqual(results.map(({ to }) => to), ['2023 May-June - Accounting 0452 - Question Paper - Paper 12.pdf'])
  assert.deepEqual((await readdir(folder)).sort(), ['2023 May-June - Accounting 0452 - Question Paper - Paper 12.pdf', 'manifest.json'])
  const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'))
  assert.equal(manifest.files['0452_s23_qp_12.pdf'].savedAs, '2023 May-June - Accounting 0452 - Question Paper - Paper 12.pdf')
  assert.deepEqual(await rebrandFolder(folder, { subject: 'accounting 0452' }), [], 'a second run changes nothing')
})
