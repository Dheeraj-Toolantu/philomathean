import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import jpeg from 'jpeg-js'
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { PNG } from 'pngjs'
import { compareImages, loadReferenceImage, removeMatchingImagesFromPdf, removeMatchingImagesInFolder } from '../remove-matching-image.js'

const RED = [210, 35, 80, 255]
const BLUE = [20, 70, 190, 255]

// A 16x16 two-colour checkerboard; `size` scales it up so it can be used as a resized copy.
const makeImage = (color, size = 16, background) => {
  const image = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const mark = (x < size / 2) !== (y < size / 2)
      image.data.set(mark ? color : background ?? [255 - color[0], 255 - color[1], 255 - color[2], 255], offset)
    }
  }
  return image
}
const makePng = (color, size, background) => PNG.sync.write(makeImage(color, size, background))

const tempFile = async (name, bytes) => {
  const filePath = path.join(await mkdtemp(path.join(tmpdir(), 'matching-image-')), name)
  await writeFile(filePath, bytes)
  return filePath
}

const pageContents = async (bytes) => {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((page) => {
    const contents = page.node.Contents()
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents]
    return streams
      .map((stream) => Buffer.from(stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents()).toString('latin1'))
      .join('\n')
  })
}

const imageCount = async (bytes) => {
  const doc = await PDFDocument.load(bytes)
  return doc.context.enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFRawStream && object.dict.lookup(PDFName.of('Subtype'))?.decodeText() === 'Image')
    .length
}

const pdfWithImages = async (referenceBytes, otherBytes) => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([300, 300])
  const reference = await doc.embedPng(referenceBytes)
  const other = await doc.embedPng(otherBytes)
  page.drawImage(reference, { x: 10, y: 10, width: 40, height: 40 })
  page.drawImage(reference, { x: 80, y: 80, width: 40, height: 40 })
  page.drawImage(other, { x: 150, y: 150, width: 40, height: 40 })
  return Buffer.from(await doc.save())
}

test('erases every matching image and saves the PDF in place, leaving other images and files alone', async () => {
  const referencePath = await tempFile('reference.png', makePng(RED))
  const folder = await mkdtemp(path.join(tmpdir(), 'matching-folder-'))
  const pdfPath = path.join(folder, 'paper.pdf')
  const unmatchedPath = path.join(folder, 'no-match.pdf')
  const originalBytes = await pdfWithImages(makePng(RED), makePng(BLUE))
  const unmatchedDoc = await PDFDocument.create()
  unmatchedDoc.addPage([100, 100]).drawImage(await unmatchedDoc.embedPng(makePng(BLUE)), { x: 10, y: 10, width: 40, height: 40 })
  const unmatchedBytes = Buffer.from(await unmatchedDoc.save())
  await writeFile(pdfPath, originalBytes)
  await writeFile(unmatchedPath, unmatchedBytes)

  const results = await removeMatchingImagesInFolder(referencePath, folder)
  const result = results.find(({ fileName }) => fileName === 'paper.pdf')
  const unmatched = results.find(({ fileName }) => fileName === 'no-match.pdf')
  assert.equal(result.removed, 2)
  assert.equal(result.matchedImages, 1)
  assert.equal(result.pagesCleaned, 1)
  assert.equal(result.saved, true)
  assert.equal(unmatched.removed, 0)
  assert.equal(unmatched.saved, false)
  assert.deepEqual((await readdir(folder)).sort(), ['no-match.pdf', 'paper.pdf'])
  assert.deepEqual(await readFile(unmatchedPath), unmatchedBytes)

  const cleaned = await readFile(pdfPath)
  assert.notDeepEqual(cleaned, originalBytes)
  const [content] = await pageContents(cleaned)
  assert.equal((content.match(/\/Image[-\w]*\s+Do/g) ?? []).length, 1)
  // The matching image (and its soft mask, if any) is gone from the file, not just hidden.
  assert.equal(await imageCount(cleaned), (await imageCount(originalBytes)) - 1)

  const again = await removeMatchingImagesInFolder(referencePath, pdfPath)
  assert.equal(again[0].removed, 0)
})

test('dry run reports matches without touching the PDF', async () => {
  const referencePath = await tempFile('reference.png', makePng(RED))
  const originalBytes = await pdfWithImages(makePng(RED), makePng(BLUE))
  const pdfPath = await tempFile('paper.pdf', originalBytes)
  const [result] = await removeMatchingImagesInFolder(referencePath, pdfPath, { dryRun: true })
  assert.equal(result.removed, 2)
  assert.equal(result.saved, false)
  assert.deepEqual(await readFile(pdfPath), originalBytes)
})

test('matches a resized, re-encoded copy and a copy with a transparent background', async () => {
  const embedded = makeImage(RED, 16, [255, 255, 255, 255])
  const resizedJpeg = jpeg.decode(jpeg.encode(makeImage(RED, 96, [255, 255, 255, 255]), 70).data, { useTArray: true })
  assert.equal(compareImages(resizedJpeg, embedded).match, true)
  const transparent = makeImage(RED, 64, [0, 0, 0, 0])
  assert.equal(compareImages(transparent, embedded).match, true)
  assert.equal(compareImages(makeImage(BLUE, 16), makeImage(RED, 16)).match, false)
  assert.equal(compareImages(makeImage(RED, 16), makeImage([255 - RED[0], 255 - RED[1], 255 - RED[2], 255], 16, RED)).match, false)
})

test('erases a matching image inside a form shared by several pages', async () => {
  const reference = await loadReferenceImage(await tempFile('reference.png', makePng(RED)))
  const source = await PDFDocument.create()
  source.addPage([100, 100]).drawImage(await source.embedPng(makePng(RED)), { x: 10, y: 10, width: 40, height: 40 })
  const destination = await PDFDocument.create()
  const [embeddedPage] = await destination.embedPdf(await source.save())
  destination.addPage([100, 100]).drawPage(embeddedPage)
  destination.addPage([100, 100]).drawPage(embeddedPage)

  const result = await removeMatchingImagesFromPdf(Buffer.from(await destination.save()), reference)
  assert.equal(result.removed, 1)
  assert.equal(result.pagesCleaned, 2)
  assert.equal(await imageCount(result.bytes), 0)
  const doc = await PDFDocument.load(result.bytes)
  const forms = doc.getPages()[0].node.Resources().lookup(PDFName.of('XObject'))
  const form = forms.values().map((ref) => doc.context.lookup(ref))
    .find((object) => object instanceof PDFRawStream && object.dict.lookup(PDFName.of('Subtype'))?.decodeText() === 'Form')
  assert.doesNotMatch(Buffer.from(decodePDFRawStream(form).decode()).toString('latin1'), /\/Image[-\w]*\s+Do/)
})

test('matches JPEG reference images and embedded JPEG images', async () => {
  // A standalone copy: pdf-lib's JPEG reader ignores the byte offset of pooled Buffers.
  const jpegBytes = new Uint8Array(jpeg.encode(makeImage(RED), 95).data)
  const reference = await loadReferenceImage(await tempFile('reference.jpg', jpegBytes))
  const doc = await PDFDocument.create()
  doc.addPage([100, 100]).drawImage(await doc.embedJpg(jpegBytes), { x: 10, y: 10, width: 40, height: 40 })
  const result = await removeMatchingImagesFromPdf(Buffer.from(await doc.save()), reference)
  assert.equal(result.removed, 1)
  assert.equal(result.unsupportedImages.length, 0)
})

test('decodes indexed, PNG-predicted and inline images', async () => {
  const reference = await loadReferenceImage(await tempFile('reference.png', makePng(RED)))
  const size = 16
  // Palette image: index 0 = RED, index 1 = its inverse, compressed with the PNG "Up" predictor.
  const rows = []
  for (let y = 0; y < size; y += 1) {
    const row = [2]
    for (let x = 0; x < size; x += 1) {
      const value = (x < size / 2) !== (y < size / 2) ? 0 : 1
      const above = y ? ((x < size / 2) !== (y - 1 < size / 2) ? 0 : 1) : 0
      row.push((value - above) & 0xff)
    }
    rows.push(...row)
  }
  const doc = await PDFDocument.create()
  const page = doc.addPage([100, 100])
  const palette = Buffer.from([...RED.slice(0, 3), ...RED.slice(0, 3).map((value) => 255 - value)]).toString('hex')
  const indexed = doc.context.stream(deflateSync(Buffer.from(rows)), {
    Type: 'XObject', Subtype: 'Image', Width: size, Height: size, BitsPerComponent: 8, Filter: 'FlateDecode',
    ColorSpace: ['Indexed', 'DeviceRGB', 1, doc.context.obj(null)],
    DecodeParms: { Predictor: 12, Colors: 1, BitsPerComponent: 8, Columns: size },
  })
  indexed.dict.get(PDFName.of('ColorSpace')).set(3, (await import('pdf-lib')).PDFHexString.of(palette))
  const indexedRef = doc.context.register(indexed)
  page.node.Resources().set(PDFName.of('XObject'), doc.context.obj({ Pal: indexedRef }))

  const pixels = makeImage(RED)
  const rgb = Buffer.alloc(size * size * 3)
  for (let index = 0; index < size * size; index += 1) rgb.set(pixels.data.subarray(index * 4, index * 4 + 3), index * 3)
  const inline = `q 40 0 0 40 50 50 cm BI /W ${size} /H ${size} /BPC 8 /CS /RGB /F /AHx ID ${rgb.toString('hex')}> EI Q`
  const content = `q 40 0 0 40 5 5 cm /Pal Do Q\n${inline}\nBT ET`
  page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(content)))

  const result = await removeMatchingImagesFromPdf(Buffer.from(await doc.save({ useObjectStreams: false })), reference)
  assert.deepEqual(result.unsupportedImages, [])
  assert.equal(result.removed, 2)
  const [cleaned] = await pageContents(result.bytes)
  assert.doesNotMatch(cleaned, /\/Pal\s+Do|BI/)
  assert.match(cleaned, /BT ET/)
})
