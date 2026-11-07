// Removes separately embedded PDF images that visually match a PNG or JPEG reference.
// The original PDFs are preserved; edited copies are written beside them with ".cleaned" added.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { PNG } from 'pngjs'
import { tokenize } from './rebrand-pdf.js'

const SAMPLE_SIZE = 32
const MAX_PIXELS = 50_000_000
const PIXEL_DISTANCE = 45
const MIN_SIMILARITY = 0.88
const MIN_VISIBLE_SAMPLES = 16

const decodeImageFile = (filePath, bytes) => {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') {
    const image = PNG.sync.read(bytes)
    return { width: image.width, height: image.height, data: image.data }
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    const image = jpeg.decode(bytes, { useTArray: true })
    return { width: image.width, height: image.height, data: image.data }
  }
  throw new Error(`Unsupported reference image type "${extension}"; use PNG or JPEG.`)
}

export const loadReferenceImage = async (filePath) => {
  const image = decodeImageFile(filePath, await readFile(filePath))
  if (!image.width || !image.height || image.width * image.height > MAX_PIXELS) {
    throw new Error(`Reference image dimensions are invalid or exceed ${MAX_PIXELS} pixels.`)
  }
  return image
}

const dictionaryNumber = (dict, key) =>
  dict.lookupMaybe(PDFName.of(key), PDFNumber)?.asNumber()

const filterNames = (dict) => {
  const filter = dict.lookup(PDFName.of('Filter'))
  if (filter instanceof PDFName) return [filter.decodeText()]
  if (filter instanceof PDFArray) return filter.asArray().map((entry) => entry.decodeText())
  return []
}

const decodedSamples = (stream) => {
  const parms = stream.dict.lookupMaybe(PDFName.of('DecodeParms'), PDFDict)
  const predictor = parms ? dictionaryNumber(parms, 'Predictor') ?? 1 : 1
  if (predictor > 1) return { reason: `unsupported PDF image predictor ${predictor}` }

  const filters = filterNames(stream.dict)
  if (filters.includes('DCTDecode')) {
    if (filters.length !== 1) return { reason: 'JPEG image uses an unsupported filter chain' }
    const image = jpeg.decode(Buffer.from(stream.contents), { useTArray: true })
    return { image: { width: image.width, height: image.height, data: image.data } }
  }
  if (filters.includes('JPXDecode')) return { reason: 'JPEG 2000 images are not supported' }

  return { samples: Buffer.from(decodePDFRawStream(stream).decode()) }
}

const colorSpaceComponents = (doc, dict) => {
  const colorSpaceRef = dict.get(PDFName.of('ColorSpace'))
  if (!colorSpaceRef) return { description: 'unknown' }
  const colorSpace = doc.context.lookup(colorSpaceRef)
  if (colorSpace instanceof PDFName) {
    const name = colorSpace.decodeText()
    return {
      components: { DeviceGray: 1, G: 1, DeviceRGB: 3, RGB: 3, DeviceCMYK: 4, CMYK: 4 }[name],
      description: name,
    }
  }
  if (!(colorSpace instanceof PDFArray)) return { description: 'unknown' }
  const entries = colorSpace.asArray()
  const name = doc.context.lookup(entries[0])
  if (!(name instanceof PDFName)) return { description: 'array-based' }
  const nameText = name.decodeText()
  if (nameText === 'CalGray') return { components: 1, description: nameText }
  if (nameText === 'CalRGB') return { components: 3, description: nameText }
  if (nameText === 'ICCBased') {
    const profile = doc.context.lookup(entries[1])
    const components = profile instanceof PDFRawStream ? dictionaryNumber(profile.dict, 'N') : undefined
    return { components: components === 1 || components === 3 ? components : undefined, description: `ICCBased/${components ?? 'unknown'}` }
  }
  return { description: nameText }
}

const pdfImagePixels = (doc, stream, includeSoftMask = true) => {
  const width = dictionaryNumber(stream.dict, 'Width')
  const height = dictionaryNumber(stream.dict, 'Height')
  const bits = dictionaryNumber(stream.dict, 'BitsPerComponent')
  if (!width || !height || width * height > MAX_PIXELS) return { reason: 'invalid or oversized image dimensions' }
  if (bits !== 8) return { reason: `unsupported ${bits ?? 'unknown'}-bit image samples` }

  const decoded = decodedSamples(stream)
  if (decoded.reason) return decoded
  if (decoded.image) {
    if (decoded.image.width !== width || decoded.image.height !== height) {
      return { reason: 'JPEG dimensions do not match the PDF image dictionary' }
    }
    return { image: decoded.image }
  }

  const { components, description } = colorSpaceComponents(doc, stream.dict)
  if (!components) return { reason: `unsupported PDF image color space "${description}"` }
  const samples = decoded.samples
  if (samples.length !== width * height * components) {
    return { reason: 'PDF image sample length does not match its dimensions' }
  }

  const data = Buffer.alloc(width * height * 4)
  for (let source = 0, target = 0; source < samples.length; source += components, target += 4) {
    if (components === 1) {
      data[target] = samples[source]
      data[target + 1] = samples[source]
      data[target + 2] = samples[source]
    } else if (components === 3) {
      data[target] = samples[source]
      data[target + 1] = samples[source + 1]
      data[target + 2] = samples[source + 2]
    } else {
      const cyan = samples[source] / 255
      const magenta = samples[source + 1] / 255
      const yellow = samples[source + 2] / 255
      const black = samples[source + 3] / 255
      data[target] = 255 * (1 - cyan) * (1 - black)
      data[target + 1] = 255 * (1 - magenta) * (1 - black)
      data[target + 2] = 255 * (1 - yellow) * (1 - black)
    }
    data[target + 3] = 255
  }

  const softMaskRef = includeSoftMask && stream.dict.get(PDFName.of('SMask'))
  if (!softMaskRef) return { image: { width, height, data } }
  const softMask = doc.context.lookup(softMaskRef)
  if (!(softMask instanceof PDFRawStream)) return { reason: 'unsupported PDF soft mask' }
  const maskResult = pdfImagePixels(doc, softMask, false)
  if (maskResult.reason) return { reason: `unsupported PDF soft mask: ${maskResult.reason}` }
  if (maskResult.image.width !== width || maskResult.image.height !== height) {
    return { reason: 'PDF soft-mask dimensions do not match the image' }
  }
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4 + 3] = maskResult.image.data[index * 4]
  }
  return { image: { width, height, data } }
}

const pixelAtSample = (image, x, y) => {
  const sourceX = Math.min(image.width - 1, Math.floor((x + 0.5) * image.width / SAMPLE_SIZE))
  const sourceY = Math.min(image.height - 1, Math.floor((y + 0.5) * image.height / SAMPLE_SIZE))
  const offset = (sourceY * image.width + sourceX) * 4
  return image.data.subarray(offset, offset + 4)
}

export const imagesAreSimilar = (reference, candidate) => {
  const referenceRatio = reference.width / reference.height
  const candidateRatio = candidate.width / candidate.height
  if (Math.abs(referenceRatio - candidateRatio) / referenceRatio > 0.04) return false

  let visibleReferenceSamples = 0
  let consideredSamples = 0
  let matchingSamples = 0
  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < SAMPLE_SIZE; x += 1) {
      const a = pixelAtSample(reference, x, y)
      const b = pixelAtSample(candidate, x, y)
      if (a[3] >= 32) visibleReferenceSamples += 1
      if (a[3] < 32 && b[3] < 32) continue
      consideredSamples += 1
      const colorDistance = (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3
      if (colorDistance <= PIXEL_DISTANCE && Math.abs(a[3] - b[3]) <= PIXEL_DISTANCE * 2) {
        matchingSamples += 1
      }
    }
  }
  return visibleReferenceSamples >= MIN_VISIBLE_SAMPLES
    && consideredSamples > 0
    && matchingSamples / consideredSamples >= MIN_SIMILARITY
}

const contentOf = (stream) => Buffer.from(
  stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents(),
).toString('latin1')

const replaceStream = (doc, ref, stream, content) => {
  const replacement = doc.context.flateStream(Buffer.from(content, 'latin1'))
  for (const [key, value] of stream.dict.entries()) {
    if (!['Length', 'Filter', 'DecodeParms'].includes(key.decodeText())) replacement.dict.set(key, value)
  }
  doc.context.assign(ref, replacement)
}

const removeDraws = (content, names) => {
  if (!names.size) return { content, removed: 0 }
  const tokens = tokenize(content)
  const edits = []
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const operand = tokens[index - 1]
    if (token.type === 'op' && token.value === 'Do' && operand.type === 'name' && names.has(operand.value)) {
      edits.push({ start: operand.start, end: token.end })
    }
  }
  let result = content
  for (const { start, end } of edits.reverse()) result = `${result.slice(0, start)}${result.slice(end)}`
  return { content: result, removed: edits.length }
}

const processContent = async (doc, content, resources, reference, state) => {
  let removed = 0
  let changed = false
  const matchingNames = new Set()
  const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict)

  for (const [key, ref] of xObjects?.entries() ?? []) {
    const object = doc.context.lookup(ref)
    if (!(object instanceof PDFRawStream)) continue
    const subtype = object.dict.lookup(PDFName.of('Subtype'))?.decodeText()
    const name = key.decodeText()
    if (subtype === 'Image') {
      const cacheKey = ref.toString()
      let candidate = state.imageCache.get(cacheKey)
      if (!candidate) {
        candidate = pdfImagePixels(doc, object)
        state.imageCache.set(cacheKey, candidate)
      }
      if (candidate.reason) state.unsupported.add(`${name}: ${candidate.reason}`)
      else if (imagesAreSimilar(reference, candidate.image)) {
        matchingNames.add(name)
        state.matched.add(cacheKey)
      }
      continue
    }
    if (subtype !== 'Form') continue

    const formKey = ref.toString()
    if (state.activeForms.has(formKey)) continue
    state.activeForms.add(formKey)
    const formResources = object.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) ?? resources
    const nested = await processContent(doc, contentOf(object), formResources, reference, state)
    state.activeForms.delete(formKey)
    if (nested.changed) {
      replaceStream(doc, ref, object, nested.content)
      changed = true
    }
    removed += nested.removed
  }

  const result = removeDraws(content, matchingNames)
  removed += result.removed
  return {
    content: result.content,
    removed,
    changed: changed || result.removed > 0,
  }
}

const pageContents = (doc, page) => {
  const contents = page.node.Contents()
  if (!contents) return ''
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => doc.context.lookup(ref))
    : [contents]
  return streams.map(contentOf).join('\n')
}

export const removeMatchingImagesFromPdf = async (bytes, reference) => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const state = {
    activeForms: new Set(),
    imageCache: new Map(),
    matched: new Set(),
    unsupported: new Set(),
  }
  let removed = 0
  for (const page of doc.getPages()) {
    const content = pageContents(doc, page)
    const result = await processContent(doc, content, page.node.Resources(), reference, state)
    if (!result.changed) continue
    page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(Buffer.from(result.content, 'latin1'))))
    removed += result.removed
  }
  return {
    bytes: removed ? Buffer.from(await doc.save()) : Buffer.from(bytes),
    removed,
    matchedImages: state.matched.size,
    unsupportedImages: [...state.unsupported],
  }
}

export const removeMatchingImagesInFolder = async (referencePath, pdfFolder) => {
  const reference = await loadReferenceImage(referencePath)
  const pdfFiles = (await readdir(pdfFolder, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name) && !/\.cleaned\.pdf$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
  if (!pdfFiles.length) throw new Error(`No PDF files found in "${pdfFolder}".`)

  const results = []
  for (const fileName of pdfFiles) {
    const sourcePath = path.join(pdfFolder, fileName)
    const result = await removeMatchingImagesFromPdf(await readFile(sourcePath), reference)
    const { bytes, ...summary } = result
    let outputPath = null
    if (result.removed) {
      const parsed = path.parse(fileName)
      outputPath = path.join(pdfFolder, `${parsed.name}.cleaned${parsed.ext}`)
      await writeFile(outputPath, bytes)
    }
    results.push({ fileName, outputPath, ...summary })
  }
  return results
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [referencePath, pdfFolder] = process.argv.slice(2)
  try {
    if (!referencePath || !pdfFolder) {
      throw new Error('Usage: node remove-matching-image.js <reference.png|reference.jpg> <pdf-folder>')
    }
    const results = await removeMatchingImagesInFolder(path.resolve(referencePath), path.resolve(pdfFolder))
    for (const result of results) {
      if (result.outputPath) {
        console.log(`${result.fileName} -> ${path.basename(result.outputPath)} (${result.removed} image placement(s) removed)`)
      } else {
        console.log(`${result.fileName}: no matching image found; original left unchanged`)
      }
      if (result.unsupportedImages.length) {
        console.warn(`${result.fileName}: skipped unsupported image(s): ${result.unsupportedImages.join('; ')}`)
      }
    }
    console.log(`Checked ${results.length} PDF(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
