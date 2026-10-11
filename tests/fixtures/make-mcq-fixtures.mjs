// Regenerates mcq-question-paper.pdf and mcq-mark-scheme.pdf (needs pdf-lib, e.g. from automation/past-papers):
//   node tests/fixtures/make-mcq-fixtures.mjs <output-dir>   then rename test-qp.pdf / test-ms.pdf
// Builds a Cambridge Paper-1–style multiple-choice question paper + mark scheme for testing the importer.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import zlib from 'node:zlib'
const out = process.argv[2]
const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.TimesRoman)
const bold = await doc.embedFont(StandardFonts.TimesRomanBold)
const W = 595, H = 842
// a small raster "photo" (gradient PNG) to prove raster images are captured too
const png = (() => { const w = 160, h = 90; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 40 + x; raw[o + 1] = 90 + y; raw[o + 2] = 200 } } const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }; const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }; const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]) })()
const photo = await doc.embedPng(png)
let page, y, pageNo = 0
const newPage = () => {
  page = doc.addPage([W, H]); pageNo += 1; y = H - 70
  page.drawText(String(pageNo + 1), { x: W / 2, y: H - 40, size: 11, font })
  page.drawText('© UCLES 2023                       0625/11/M/J/23', { x: 50, y: 30, size: 9, font })
  page.drawText('[Turn over', { x: W - 110, y: 30, size: 10, font: bold })
}
const text = (s, x, size = 11, f = font) => { ensure(size + 8); page.drawText(s, { x, y, size, font: f }); y -= size + 7 }
const gap = (n) => { y -= n }
const ensure = (need) => { if (y - need < 70) newPage() }
const question = (n, stemLines, opts, draw) => {
  ensure(60)
  page.drawText(String(n), { x: 50, y, size: 11, font: bold })
  for (const line of stemLines) text(line, 75)
  if (draw) { gap(8); ensure(130); draw() }
  gap(8)
  for (const [l, t] of opts) { ensure(20); page.drawText(l, { x: 75, y, size: 11, font: bold }); page.drawText(t, { x: 95, y, size: 11, font }); y -= 18 }
  gap(22)
}
newPage()
question(1, ['Which quantity is a vector?'], [['A', 'energy'], ['B', 'mass'], ['C', 'momentum'], ['D', 'speed']])
question(2, ['The diagram shows a ray of light passing from air into glass.', 'Which angle is the angle of refraction?'], [['A', 'p'], ['B', 'q'], ['C', 'r'], ['D', 's']], () => {
  const top = y, cx = 300; page.drawRectangle({ x: 180, y: top - 120, width: 240, height: 60, borderColor: rgb(0, 0, 0), borderWidth: 1, color: rgb(0.9, 0.95, 1) })
  page.drawLine({ start: { x: cx, y: top }, end: { x: cx, y: top - 120 }, thickness: 0.6, dashArray: [3, 3] })
  page.drawLine({ start: { x: 230, y: top - 10 }, end: { x: cx, y: top - 60 }, thickness: 1.2 }); page.drawLine({ start: { x: cx, y: top - 60 }, end: { x: 330, y: top - 120 }, thickness: 1.2 })
  page.drawText('air', { x: 190, y: top - 30, size: 10, font }); page.drawText('glass', { x: 190, y: top - 100, size: 10, font }); y = top - 130
})
question(3, ['A car travels 150 m in 6.0 s. What is its average speed?'], [['A', '0.040 m/s'], ['B', '9.0 m/s'], ['C', '25 m/s'], ['D', '900 m/s']])
question(4, ['The photograph shows a solar panel on a roof.', 'Which energy transfer takes place in the panel?'], [['A', 'chemical to electrical'], ['B', 'light to electrical'], ['C', 'light to thermal'], ['D', 'thermal to electrical']], () => { page.drawImage(photo, { x: 200, y: y - 95, width: 180, height: 95 }); y -= 105 })
question(5, ['Which graph shows an object moving at constant speed?'], [], () => {
  const top = y; ['A', 'B', 'C', 'D'].forEach((l, i) => { const x0 = 85 + i * 120; page.drawText(l, { x: x0 + 35, y: top - 95, size: 11, font: bold }); page.drawLine({ start: { x: x0, y: top - 80 }, end: { x: x0, y: top - 10 }, thickness: 1 }); page.drawLine({ start: { x: x0, y: top - 80 }, end: { x: x0 + 80, y: top - 80 }, thickness: 1 }); const ends = [[x0 + 70, top - 20], [x0 + 70, top - 80], [x0 + 40, top - 20], [x0 + 70, top - 50]][i]; page.drawLine({ start: { x: x0, y: i === 1 ? top - 30 : top - 80 }, end: { x: ends[0], y: ends[1] }, thickness: 1.5 }) }); y = top - 115
})
for (let n = 6; n <= 9; n++) question(n, [`Question ${n}: which unit is used for ${['force', 'power', 'pressure', 'work'][n - 6]}?`], [['A', 'joule'], ['B', 'newton'], ['C', 'pascal'], ['D', 'watt']])
y = 150 // force question 10 to split across a page
question(10, ['A resistor of 6.0 ohm carries a current of 2.0 A.', 'What is the potential difference across it?', 'Use V = IR.'], [['A', '0.33 V'], ['B', '3.0 V'], ['C', '8.0 V'], ['D', '12 V']])
writeFileSync(`${out}/test-qp.pdf`, await doc.save())

const ms = await PDFDocument.create(); const mf = await ms.embedFont(StandardFonts.Helvetica); const mp = ms.addPage([W, H])
mp.drawText('Cambridge IGCSE – Mark Scheme  0625/11  May/June 2023', { x: 50, y: H - 60, size: 12, font: mf })
mp.drawText('Question       Answer       Marks', { x: 60, y: H - 110, size: 11, font: mf })
const key = 'CCCBBBDCAD'; [...key].forEach((a, i) => mp.drawText(`${i + 1}                  ${a}                 1`, { x: 70, y: H - 135 - i * 20, size: 11, font: mf }))
writeFileSync(`${out}/test-ms.pdf`, await ms.save())
console.log('ok')
