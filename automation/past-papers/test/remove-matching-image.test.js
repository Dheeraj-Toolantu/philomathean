import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import jpeg from 'jpeg-js'
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { PNG } from 'pngjs'
import { removeMatchingImagesFromPdf, removeMatchingImagesInFolder, loadReferenceImage } from '../remove-matching-image.js'

const makePng = (color) => {
  const image = new PNG({ width: 16, height: 16 })
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4
      const mark = (x < 8) !== (y < 8)
      image.data.set(mark ? color : [255 - color[0], 255 - color[1], 255 - color[2], 255], offset)
    }
  }
  return PNG.sync.write(image)
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

const pdfWithOneImage = async (imageBytes) => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([100, 100])
  const image = await doc.embedPng(imageBytes)
  page.drawImage(image, { x: 10, y: 10, width: 40, height: 40 })
  return Buffer.from(await doc.save())
}

const pageContent = async (bytes) => {
  const doc = await PDFDocument.load(bytes)
  const [page] = doc.getPages()
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => doc.context.lookup(ref))
    : [contents]
  return streams
    .map((stream) => Buffer.from(stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents()).toString('latin1'))
    .join('\n')
}

test('removes matching embedded images from cleaned copies while preserving originals and other images', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'matching-image-'))
  const referenceBytes = makePng([210, 35, 80, 255])
  const originalBytes = await pdfWithImages(referenceBytes, makePng([20, 70, 190, 255]))
  const referencePath = path.join(folder, 'reference.png')
  const pdfPath = path.join(folder, 'paper.pdf')
  const unmatchedPath = path.join(folder, 'no-match.pdf')
  await writeFile(referencePath, referenceBytes)
  await writeFile(pdfPath, originalBytes)
  await writeFile(unmatchedPath, await pdfWithOneImage(makePng([20, 70, 190, 255])))

  const results = await removeMatchingImagesInFolder(referencePath, folder)
  const result = results.find(({ fileName }) => fileName === 'paper.pdf')
  const unmatched = results.find(({ fileName }) => fileName === 'no-match.pdf')
  assert.equal(result.removed, 2)
  assert.equal(result.matchedImages, 1)
  assert.equal(path.basename(result.outputPath), 'paper.cleaned.pdf')
  assert.equal(unmatched.removed, 0)
  assert.equal(unmatched.outputPath, null)
  assert.deepEqual(await readFile(pdfPath), originalBytes)
  assert.equal((await readdir(folder)).filter((name) => name.endsWith('.cleaned.pdf')).length, 1)

  const cleanedContent = await pageContent(await readFile(result.outputPath))
  assert.equal((cleanedContent.match(/\/Image[-\w]*\s+Do/g) ?? []).length, 1)
  assert.equal((await pageContent(originalBytes)).match(/\/Image[-\w]*\s+Do/g)?.length, 3)
})

test('removes a matching image nested inside an embedded-page form', async () => {
  const referenceBytes = makePng([210, 35, 80, 255])
  const referencePath = path.join(await mkdtemp(path.join(tmpdir(), 'nested-image-')), 'reference.png')
  await writeFile(referencePath, referenceBytes)
  const reference = await loadReferenceImage(referencePath)

  const source = await PDFDocument.create()
  const sourcePage = source.addPage([100, 100])
  sourcePage.drawImage(await source.embedPng(referenceBytes), { x: 10, y: 10, width: 40, height: 40 })
  const destination = await PDFDocument.create()
  const [embeddedPage] = await destination.embedPdf(await source.save())
  destination.addPage([100, 100]).drawPage(embeddedPage)

  const result = await removeMatchingImagesFromPdf(Buffer.from(await destination.save()), reference)
  assert.equal(result.removed, 1)
  const doc = await PDFDocument.load(result.bytes)
  const [page] = doc.getPages()
  const forms = page.node.Resources().lookup(PDFName.of('XObject'))
  const form = forms.values().map((ref) => doc.context.lookup(ref))
    .find((object) => object instanceof PDFRawStream && object.dict.lookup(PDFName.of('Subtype'))?.decodeText() === 'Form')
  assert.ok(form)
  const content = Buffer.from(decodePDFRawStream(form).decode()).toString('latin1')
  assert.doesNotMatch(content, /\/Image[-\w]*\s+Do/)
})

test('matches JPEG reference images and embedded JPEG images', async () => {
  const png = PNG.sync.read(makePng([210, 35, 80, 255]))
  const jpegBytes = Buffer.from(jpeg.encode(png, 95).data)
  const folder = await mkdtemp(path.join(tmpdir(), 'jpeg-image-'))
  const referencePath = path.join(folder, 'reference.jpg')
  await writeFile(referencePath, jpegBytes)
  const reference = await loadReferenceImage(referencePath)

  const doc = await PDFDocument.create()
  const page = doc.addPage([100, 100])
  page.drawImage(await doc.embedJpg(jpegBytes), { x: 10, y: 10, width: 40, height: 40 })
  const result = await removeMatchingImagesFromPdf(Buffer.from(await doc.save()), reference)
  assert.equal(result.removed, 1)
  assert.equal(result.unsupportedImages.length, 0)
})
