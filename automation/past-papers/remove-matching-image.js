// Erases every image in a PDF that visually matches a PNG or JPEG reference image, then saves the PDF
// back to the same path. Use it only on PDFs you own or are authorized to edit.
//
//   node remove-matching-image.js <reference.png|reference.jpg> <pdf-file-or-folder> [--dry-run]
//
// Matching images are found among image XObjects (including ones nested inside form XObjects, tiling
// patterns and annotation appearances) and inline images. Each placement of a matching image is cut out
// of the content stream, and the image data is dropped from the file so it cannot be recovered.
import { readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import {
  PDFArray, PDFBool, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString,
  decodePDFRawStream,
} from 'pdf-lib'
import { PNG } from 'pngjs'
import { tokenize } from './rebrand-pdf.js'

const MAX_PIXELS = 50_000_000
const GRID = 32
// Two images match when, after trimming white margins and scaling both to GRID x GRID, they have the
// same shape, similar colours and the same light/dark pattern.
export const MATCH_LIMITS = {
  aspectTolerance: 0.08,
  maxColorDifference: 32,
  minCorrelation: 0.8,
  strongCorrelation: 0.96,
  maxColorDifferenceStrong: 56,
  flatColorDifference: 12,
}

const IMAGE_FILTERS = new Set(['DCTDecode', 'JPXDecode', 'CCITTFaxDecode', 'JBIG2Decode'])
const INLINE_KEYS = {
  W: 'Width', H: 'Height', BPC: 'BitsPerComponent', CS: 'ColorSpace', F: 'Filter', DP: 'DecodeParms',
  IM: 'ImageMask', D: 'Decode', I: 'Interpolate', L: 'Length',
}
const INLINE_VALUES = {
  G: 'DeviceGray', RGB: 'DeviceRGB', CMYK: 'DeviceCMYK', I: 'Indexed', AHx: 'ASCIIHexDecode',
  A85: 'ASCII85Decode', LZW: 'LZWDecode', Fl: 'FlateDecode', RL: 'RunLengthDecode', CCF: 'CCITTFaxDecode',
  DCT: 'DCTDecode',
}

// ---------- reference image ----------

const decodeImageFile = (filePath, bytes) => {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') {
    const image = PNG.sync.read(bytes)
    return { width: image.width, height: image.height, data: image.data }
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 200 })
    return { width: image.width, height: image.height, data: image.data }
  }
  throw new Error(`Unsupported reference image type "${extension}"; use PNG or JPEG.`)
}

export const loadReferenceImage = async (filePath) => {
  const image = decodeImageFile(filePath, await readFile(filePath))
  if (!image.width || !image.height || image.width * image.height > MAX_PIXELS) {
    throw new Error(`Reference image dimensions are invalid or exceed ${MAX_PIXELS} pixels.`)
  }
  if (!fingerprint(image)) throw new Error('The reference image is blank (only white or transparent pixels).')
  return image
}

// ---------- comparing images ----------

// Flattens an RGBA image onto white, trims white margins and box-averages what is left into a
// GRID x GRID thumbnail. Returns null for a blank image.
const fingerprint = (image) => {
  if (image.fingerprint !== undefined) return image.fingerprint
  const { width, height, data } = image
  const rgb = new Float32Array(width * height * 3)
  const rowInk = new Uint32Array(height)
  const columnInk = new Uint32Array(width)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const alpha = data[pixel * 4 + 3] / 255
    let darkest = 255
    for (let channel = 0; channel < 3; channel += 1) {
      const value = data[pixel * 4 + channel] * alpha + 255 * (1 - alpha)
      rgb[pixel * 3 + channel] = value
      if (value < darkest) darkest = value
    }
    if (darkest < 232) {
      rowInk[Math.floor(pixel / width)] += 1
      columnInk[pixel % width] += 1
    }
  }
  // A row or column only counts as content when enough of it is inked, so JPEG speckles in a margin
  // do not stop the margin being trimmed.
  const span = (ink, length) => {
    const needed = Math.max(1, Math.floor(length * 0.01))
    let first = 0
    while (first < ink.length && ink[first] < needed) first += 1
    let last = ink.length - 1
    while (last >= first && ink[last] < needed) last -= 1
    return first > last ? null : [first, last + 1]
  }
  const ys = span(rowInk, width)
  const xs = span(columnInk, height)
  if (!xs || !ys) {
    image.fingerprint = null
    return null
  }
  const [x0, x1] = xs
  const [y0, y1] = ys
  const cells = new Float32Array(GRID * GRID * 3)
  for (let gy = 0; gy < GRID; gy += 1) {
    const top = y0 + Math.floor(gy * (y1 - y0) / GRID)
    const bottom = Math.max(top + 1, y0 + Math.floor((gy + 1) * (y1 - y0) / GRID))
    for (let gx = 0; gx < GRID; gx += 1) {
      const left = x0 + Math.floor(gx * (x1 - x0) / GRID)
      const right = Math.max(left + 1, x0 + Math.floor((gx + 1) * (x1 - x0) / GRID))
      const sums = [0, 0, 0]
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const offset = (y * width + x) * 3
          sums[0] += rgb[offset]
          sums[1] += rgb[offset + 1]
          sums[2] += rgb[offset + 2]
        }
      }
      const count = (bottom - top) * (right - left)
      const cell = (gy * GRID + gx) * 3
      cells[cell] = sums[0] / count
      cells[cell + 1] = sums[1] / count
      cells[cell + 2] = sums[2] / count
    }
  }
  const gray = new Float32Array(GRID * GRID)
  let mean = 0
  for (let cell = 0; cell < GRID * GRID; cell += 1) {
    gray[cell] = 0.299 * cells[cell * 3] + 0.587 * cells[cell * 3 + 1] + 0.114 * cells[cell * 3 + 2]
    mean += gray[cell]
  }
  mean /= GRID * GRID
  let variance = 0
  for (const value of gray) variance += (value - mean) ** 2
  image.fingerprint = { ratio: (x1 - x0) / (y1 - y0), cells, gray, mean, deviation: Math.sqrt(variance / (GRID * GRID)) }
  return image.fingerprint
}

export const compareImages = (reference, candidate) => {
  const a = fingerprint(reference)
  const b = fingerprint(candidate)
  if (!a || !b) return { match: false, reason: 'blank image' }
  const ratioDifference = Math.abs(a.ratio - b.ratio) / Math.min(a.ratio, b.ratio)
  let colorDifference = 0
  for (let index = 0; index < a.cells.length; index += 1) colorDifference += Math.abs(a.cells[index] - b.cells[index])
  colorDifference /= a.cells.length
  let correlation = 0
  if (a.deviation > 1 && b.deviation > 1) {
    for (let index = 0; index < a.gray.length; index += 1) correlation += (a.gray[index] - a.mean) * (b.gray[index] - b.mean)
    correlation /= a.gray.length * a.deviation * b.deviation
  }
  const limits = MATCH_LIMITS
  const flat = a.deviation <= 1 || b.deviation <= 1
  const match = ratioDifference <= limits.aspectTolerance && (flat
    ? colorDifference <= limits.flatColorDifference
    : (colorDifference <= limits.maxColorDifference && correlation >= limits.minCorrelation)
      || (correlation >= limits.strongCorrelation && colorDifference <= limits.maxColorDifferenceStrong))
  return { match, ratioDifference, colorDifference, correlation }
}

export const imagesAreSimilar = (reference, candidate) => compareImages(reference, candidate).match

// ---------- decoding PDF images ----------

const numberIn = (doc, dict, key) => {
  const value = dict && doc.context.lookup(dict.get(PDFName.of(key)))
  return value instanceof PDFNumber ? value.asNumber() : undefined
}

const nameText = (value) => (value instanceof PDFName ? value.decodeText() : undefined)

const filtersOf = (doc, dict) => {
  const filter = doc.context.lookup(dict.get(PDFName.of('Filter')))
  const filters = filter instanceof PDFArray
    ? filter.asArray().map((entry) => nameText(doc.context.lookup(entry)))
    : filter ? [nameText(filter)] : []
  const parms = doc.context.lookup(dict.get(PDFName.of('DecodeParms')))
  const parmsList = filters.map((_, index) => {
    const entry = parms instanceof PDFArray ? doc.context.lookup(parms.get(index)) : index === 0 ? parms : undefined
    return entry instanceof PDFDict ? entry : undefined
  })
  return { filters, parmsList }
}

const unpredict = (doc, data, parms) => {
  const predictor = numberIn(doc, parms, 'Predictor') ?? 1
  if (predictor <= 1) return { data }
  const colors = numberIn(doc, parms, 'Colors') ?? 1
  const bits = numberIn(doc, parms, 'BitsPerComponent') ?? 8
  const columns = numberIn(doc, parms, 'Columns') ?? 1
  const bytesPerPixel = Math.max(1, Math.ceil(colors * bits / 8))
  const rowLength = Math.ceil(colors * bits * columns / 8)
  if (predictor === 2) {
    if (bits !== 8) return { reason: `unsupported TIFF predictor with ${bits}-bit samples` }
    const output = Buffer.from(data)
    for (let row = 0; row + rowLength <= output.length; row += rowLength) {
      for (let index = row + colors; index < row + rowLength; index += 1) {
        output[index] = (output[index] + output[index - colors]) & 0xff
      }
    }
    return { data: output }
  }
  const rows = Math.floor(data.length / (rowLength + 1))
  const output = Buffer.alloc(rows * rowLength)
  for (let row = 0; row < rows; row += 1) {
    const type = data[row * (rowLength + 1)]
    const source = row * (rowLength + 1) + 1
    const target = row * rowLength
    for (let index = 0; index < rowLength; index += 1) {
      const raw = data[source + index]
      const left = index >= bytesPerPixel ? output[target + index - bytesPerPixel] : 0
      const up = row ? output[target - rowLength + index] : 0
      const upLeft = row && index >= bytesPerPixel ? output[target - rowLength + index - bytesPerPixel] : 0
      let value = raw
      if (type === 1) value = raw + left
      else if (type === 2) value = raw + up
      else if (type === 3) value = raw + Math.floor((left + up) / 2)
      else if (type === 4) {
        const estimate = left + up - upLeft
        const pa = Math.abs(estimate - left)
        const pb = Math.abs(estimate - up)
        const pc = Math.abs(estimate - upLeft)
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
      }
      output[target + index] = value & 0xff
    }
  }
  return { data: output }
}

// Undoes the general-purpose filters of a stream. An image codec (DCT, JPX, ...) may only be the last
// filter; it is returned undecoded together with its name.
const decodeFilters = (doc, dict, contents) => {
  const { filters, parmsList } = filtersOf(doc, dict)
  let data = contents
  for (let index = 0; index < filters.length; index += 1) {
    const filter = filters[index]
    if (!filter) return { reason: 'unreadable filter' }
    if (IMAGE_FILTERS.has(filter)) {
      if (index !== filters.length - 1) return { reason: `${filter} is not the last filter` }
      return { data, codec: filter }
    }
    const single = doc.context.obj({ Filter: filter })
    if (parmsList[index]) single.set(PDFName.of('DecodeParms'), parmsList[index])
    try {
      data = decodePDFRawStream(PDFRawStream.of(single, data)).decode()
    } catch (error) {
      return { reason: `${filter} could not be decoded (${error.message})` }
    }
    if (filter === 'FlateDecode' || filter === 'LZWDecode') {
      const result = unpredict(doc, data, parmsList[index])
      if (result.reason) return result
      data = result.data
    }
  }
  return { data }
}

const streamText = (doc, stream) => {
  if (!(stream instanceof PDFRawStream)) return { text: Buffer.from(stream.getContents()).toString('latin1') }
  const result = decodeFilters(doc, stream.dict, stream.contents)
  if (result.reason || result.codec) return { reason: result.reason ?? `content stream uses ${result.codec}` }
  return { text: Buffer.from(result.data).toString('latin1') }
}

const DEVICE_SPACES = {
  DeviceGray: { kind: 'gray', components: 1 }, G: { kind: 'gray', components: 1 },
  DeviceRGB: { kind: 'rgb', components: 3 }, RGB: { kind: 'rgb', components: 3 },
  DeviceCMYK: { kind: 'cmyk', components: 4 }, CMYK: { kind: 'cmyk', components: 4 },
}

const bytesOf = (doc, value) => {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.asBytes()
  if (value instanceof PDFRawStream) return decodeFilters(doc, value.dict, value.contents).data
  return undefined
}

// Describes a colour space as { kind, components, ... } or { reason } when it cannot be converted.
const colorSpaceOf = (doc, value, resources, depth = 0) => {
  const space = doc.context.lookup(value)
  if (depth > 4) return { reason: 'colour space nests too deeply' }
  if (space instanceof PDFName) {
    const name = space.decodeText()
    if (DEVICE_SPACES[name]) return DEVICE_SPACES[name]
    const named = resources?.lookupMaybe(PDFName.of('ColorSpace'), PDFDict)?.get(space)
    if (named) return colorSpaceOf(doc, named, resources, depth + 1)
    return { reason: `unknown colour space "${name}"` }
  }
  if (!(space instanceof PDFArray)) return { reason: 'missing colour space' }
  const family = nameText(doc.context.lookup(space.get(0)))
  if (family === 'CalGray') return DEVICE_SPACES.DeviceGray
  if (family === 'CalRGB') return DEVICE_SPACES.DeviceRGB
  if (family === 'ICCBased') {
    const profile = doc.context.lookup(space.get(1))
    const components = profile instanceof PDFRawStream ? numberIn(doc, profile.dict, 'N') : undefined
    if (components === 1) return DEVICE_SPACES.DeviceGray
    if (components === 3) return DEVICE_SPACES.DeviceRGB
    if (components === 4) return DEVICE_SPACES.DeviceCMYK
    const alternate = profile instanceof PDFRawStream && profile.dict.get(PDFName.of('Alternate'))
    return alternate ? colorSpaceOf(doc, alternate, resources, depth + 1) : { reason: 'ICC profile without N' }
  }
  if (family === 'Indexed' || family === 'I') {
    const base = colorSpaceOf(doc, space.get(1), resources, depth + 1)
    if (base.reason) return base
    const highest = doc.context.lookup(space.get(2))
    const lookup = bytesOf(doc, doc.context.lookup(space.get(3)))
    if (!(highest instanceof PDFNumber) || !lookup) return { reason: 'unreadable indexed colour table' }
    return { kind: 'indexed', components: 1, base, highest: highest.asNumber(), lookup }
  }
  if (family === 'Separation') return { kind: 'tint', components: 1 }
  if (family === 'DeviceN') {
    const names = doc.context.lookup(space.get(1))
    return names instanceof PDFArray ? { kind: 'tint', components: names.size() } : { reason: 'unreadable DeviceN' }
  }
  return { reason: `unsupported colour space "${family ?? 'unknown'}"` }
}

// Converts normalised components (0..1) of a colour space to 0..255 RGB.
const toRgb = (space, values, target, offset) => {
  if (space.kind === 'gray') {
    target[offset] = target[offset + 1] = target[offset + 2] = values[0] * 255
  } else if (space.kind === 'rgb') {
    target[offset] = values[0] * 255
    target[offset + 1] = values[1] * 255
    target[offset + 2] = values[2] * 255
  } else if (space.kind === 'cmyk') {
    target[offset] = 255 * (1 - values[0]) * (1 - values[3])
    target[offset + 1] = 255 * (1 - values[1]) * (1 - values[3])
    target[offset + 2] = 255 * (1 - values[2]) * (1 - values[3])
  } else {
    // Separation / DeviceN: more tint is darker. Good enough to compare shapes.
    const tint = Math.min(1, values.slice(0, space.components).reduce((sum, value) => sum + value, 0))
    target[offset] = target[offset + 1] = target[offset + 2] = 255 * (1 - tint)
  }
}

const readSamples = (data, width, height, components, bits) => {
  const rowBytes = Math.ceil(width * components * bits / 8)
  if (data.length < rowBytes * height) return null
  const samples = new Uint16Array(width * height * components)
  const perRow = width * components
  for (let y = 0; y < height; y += 1) {
    const row = y * rowBytes
    for (let index = 0; index < perRow; index += 1) {
      let value
      if (bits === 8) value = data[row + index]
      else if (bits === 16) value = data[row + index * 2]
      else {
        const bit = index * bits
        value = (data[row + (bit >> 3)] >> (8 - bits - (bit & 7))) & ((1 << bits) - 1)
      }
      samples[y * perRow + index] = value
    }
  }
  return samples
}

const decodeJpeg = (data) => {
  try {
    const image = jpeg.decode(Buffer.from(data), { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 200 })
    return { image: { width: image.width, height: image.height, data: image.data } }
  } catch (error) {
    return { reason: `JPEG could not be decoded (${error.message})` }
  }
}

const resampleChannel = (image, width, height, channel) => {
  if (image.width === width && image.height === height) return (index) => image.data[index * 4 + channel]
  return (index) => {
    const x = Math.min(image.width - 1, Math.floor((index % width) * image.width / width))
    const y = Math.min(image.height - 1, Math.floor(Math.floor(index / width) * image.height / height))
    return image.data[(y * image.width + x) * 4 + channel]
  }
}

// Decodes an image dictionary + data into { image: { width, height, data: RGBA } } or { reason }.
const decodeImage = (doc, dict, contents, resources, depth = 0) => {
  const width = numberIn(doc, dict, 'Width')
  const height = numberIn(doc, dict, 'Height')
  if (!width || !height || width * height > MAX_PIXELS) return { reason: 'invalid or oversized image dimensions' }
  const isMask = doc.context.lookup(dict.get(PDFName.of('ImageMask'))) === PDFBool.True
  const bits = isMask ? 1 : numberIn(doc, dict, 'BitsPerComponent') ?? 8

  const decoded = decodeFilters(doc, dict, contents)
  if (decoded.reason) return decoded
  let pixels
  if (decoded.codec === 'DCTDecode') {
    const result = decodeJpeg(decoded.data)
    if (result.reason) return result
    if (result.image.width !== width || result.image.height !== height) return { reason: 'JPEG size differs from the PDF image size' }
    pixels = result.image.data
  } else if (decoded.codec) {
    return { reason: `${decoded.codec} images are not supported` }
  } else {
    const space = isMask ? { kind: 'gray', components: 1 } : colorSpaceOf(doc, dict.get(PDFName.of('ColorSpace')), resources)
    if (space.reason) return space
    if (![1, 2, 4, 8, 16].includes(bits)) return { reason: `unsupported ${bits}-bit image samples` }
    const samples = readSamples(decoded.data, width, height, space.components, bits)
    if (!samples) return { reason: 'image data is shorter than its dimensions' }
    const maxSample = bits === 16 ? 255 : (1 << bits) - 1
    const decodeArray = doc.context.lookup(dict.get(PDFName.of('Decode')))
    const ranges = decodeArray instanceof PDFArray ? decodeArray.asArray().map((entry) => doc.context.lookup(entry).asNumber?.() ?? 0) : null
    pixels = new Uint8Array(width * height * 4)
    const values = new Array(space.components)
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const target = pixel * 4
      pixels[target + 3] = 255
      if (isMask) {
        // Stencil masks paint where the sample is 0 (or 1 with Decode [1 0]).
        const painted = (samples[pixel] === 0) !== (ranges?.[0] === 1)
        if (!painted) pixels[target + 3] = 0
        continue
      }
      if (space.kind === 'indexed') {
        const low = ranges?.[0] ?? 0
        const high = ranges?.[1] ?? maxSample
        const index = Math.max(0, Math.min(space.highest, Math.round(low + samples[pixel] * (high - low) / maxSample)))
        const base = space.base.components
        for (let channel = 0; channel < base; channel += 1) values[channel] = (space.lookup[index * base + channel] ?? 0) / 255
        toRgb(space.base, values, pixels, target)
        continue
      }
      for (let channel = 0; channel < space.components; channel += 1) {
        const raw = samples[pixel * space.components + channel] / maxSample
        const low = ranges?.[channel * 2] ?? 0
        const high = ranges?.[channel * 2 + 1] ?? 1
        values[channel] = Math.max(0, Math.min(1, low + raw * (high - low)))
      }
      toRgb(space, values, pixels, target)
    }
  }

  if (isMask || depth > 0) return { image: { width, height, data: pixels } }

  // Transparency: a soft mask gives alpha from its gray level; a stencil /Mask (decoded like an image
  // mask, opaque where the image shows) gives alpha from its own alpha.
  for (const [key, channel] of [['SMask', 0], ['Mask', 3]]) {
    const mask = doc.context.lookup(dict.get(PDFName.of(key)))
    if (!(mask instanceof PDFRawStream)) continue
    const result = decodeImage(doc, mask.dict, mask.contents, resources, depth + 1)
    if (result.reason) continue
    const read = resampleChannel(result.image, width, height, channel)
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      pixels[pixel * 4 + 3] = Math.min(pixels[pixel * 4 + 3], read(pixel))
    }
  }
  return { image: { width, height, data: pixels } }
}

// ---------- inline images ----------

const inlineValue = (doc, tokens, position) => {
  const token = tokens[position]
  if (token.type === 'name') return [PDFName.of(INLINE_VALUES[token.value] ?? token.value), position + 1]
  if (token.type === 'number') return [PDFNumber.of(token.value), position + 1]
  if (token.type === 'string') return [PDFHexString.of(Buffer.from(token.value, 'latin1').toString('hex')), position + 1]
  if (token.type === 'op' && (token.value === 'true' || token.value === 'false')) return [PDFBool[token.value === 'true' ? 'True' : 'False'], position + 1]
  if (token.type === 'arrayOpen') {
    const array = doc.context.obj([])
    let next = position + 1
    while (next < tokens.length && tokens[next].type !== 'arrayClose') {
      const [value, after] = inlineValue(doc, tokens, next)
      array.push(value)
      next = after
    }
    return [array, next + 1]
  }
  if (token.type === 'dictOpen') {
    const dict = doc.context.obj({})
    let next = position + 1
    while (next < tokens.length && tokens[next].type === 'name') {
      const key = tokens[next].value
      const [value, after] = inlineValue(doc, tokens, next + 1)
      dict.set(PDFName.of(INLINE_KEYS[key] ?? key), value)
      next = after
    }
    return [dict, next + 1]
  }
  return [doc.context.obj(null), position + 1]
}

const parseInlineImage = (doc, content, token) => {
  const text = content.slice(token.start, token.end)
  const marker = text.search(/\sID\s/)
  const end = text.search(/\sEI\s*$/)
  if (marker < 0 || end < marker) return { reason: 'unreadable inline image' }
  const dictTokens = tokenize(text.slice(2, marker))
  const dict = doc.context.obj({})
  for (let position = 0; position < dictTokens.length;) {
    if (dictTokens[position].type !== 'name') {
      position += 1
      continue
    }
    const key = dictTokens[position].value
    const [value, next] = inlineValue(doc, dictTokens, position + 1)
    dict.set(PDFName.of(INLINE_KEYS[key] ?? key), value)
    position = next
  }
  return { dict, data: Buffer.from(text.slice(marker + 4, end), 'latin1') }
}

// ---------- removing placements ----------

const isImage = (object) => object instanceof PDFRawStream
  && nameText(object.dict.lookup(PDFName.of('Subtype'))) === 'Image'

const imageMatches = (doc, ref, reference, resources, state) => {
  const key = ref.toString()
  if (!state.images.has(key)) {
    const object = doc.context.lookup(ref)
    const decoded = decodeImage(doc, object.dict, object.contents, resources)
    const comparison = decoded.reason ? null : compareImages(reference, decoded.image)
    const result = decoded.reason ? { reason: decoded.reason } : { match: comparison.match }
    if (process.env.REMOVE_IMAGE_DEBUG && comparison) {
      const { width, height } = decoded.image
      const metrics = ['ratioDifference', 'colorDifference', 'correlation'].map((name) => `${name}=${comparison[name]?.toFixed(3)}`)
      console.error(`image ${key} ${width}x${height}: match=${comparison.match} ${metrics.join(' ')}`)
    }
    state.images.set(key, result)
    if (result.reason) state.unsupported.add(`image ${key}: ${result.reason}`)
  }
  return state.images.get(key).match === true
}

const replaceStream = (doc, ref, stream, text) => {
  const replacement = doc.context.flateStream(Buffer.from(text, 'latin1'))
  for (const [key, value] of stream.dict.entries()) {
    if (!['Length', 'Filter', 'DecodeParms', 'DL'].includes(key.decodeText())) replacement.dict.set(key, value)
  }
  doc.context.assign(ref, replacement)
}

// Visits the nested content streams a resource dictionary can paint: form XObjects and tiling patterns.
const processNestedStream = (doc, ref, inheritedResources, reference, state) => {
  const key = ref.toString()
  if (state.streams.has(key)) return state.streams.get(key)
  state.streams.set(key, false)
  const stream = doc.context.lookup(ref)
  const read = streamText(doc, stream)
  if (read.reason) {
    state.unsupported.add(`content ${key}: ${read.reason}`)
    return false
  }
  const resources = stream.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) ?? inheritedResources
  const result = processContent(doc, read.text, resources, reference, state)
  if (result.removed) replaceStream(doc, ref, stream, result.text)
  // Remembered so every page that paints this (possibly shared) stream counts as cleaned.
  state.streams.set(key, result.affected)
  return result.affected
}

const processContent = (doc, text, resources, reference, state) => {
  const tokens = tokenize(text)
  const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  const edits = []
  let nestedAffected = false
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type !== 'op') continue
    if (token.value === 'BI') {
      const inline = parseInlineImage(doc, text, token)
      const decoded = inline.reason ? inline : decodeImage(doc, inline.dict, inline.data, resources)
      if (decoded.reason) state.unsupported.add(`inline image: ${decoded.reason}`)
      else if (compareImages(reference, decoded.image).match) {
        edits.push({ start: token.start, end: token.end })
        state.inlineMatches += 1
      }
      continue
    }
    const operand = tokens[index - 1]
    if (token.value !== 'Do' || operand?.type !== 'name') continue
    const ref = xObjects?.get(PDFName.of(operand.value))
    const object = ref && doc.context.lookup(ref)
    if (isImage(object)) {
      if (ref instanceof PDFRef && imageMatches(doc, ref, reference, resources, state)) {
        edits.push({ start: operand.start, end: token.end })
        state.matched.add(ref.toString())
        state.cleanedResources.add(xObjects)
      }
    } else if (ref instanceof PDFRef && object instanceof PDFRawStream) {
      nestedAffected = processNestedStream(doc, ref, resources, reference, state) || nestedAffected
    }
  }
  const patterns = resources?.lookupMaybe(PDFName.of('Pattern'), PDFDict)
  for (const ref of patterns?.values() ?? []) {
    const pattern = doc.context.lookup(ref)
    if (ref instanceof PDFRef && pattern instanceof PDFRawStream) {
      nestedAffected = processNestedStream(doc, ref, resources, reference, state) || nestedAffected
    }
  }
  let result = text
  for (const { start, end } of edits.reverse()) result = `${result.slice(0, start)} ${result.slice(end)}`
  state.removed += edits.length
  return { text: result, removed: edits.length, affected: edits.length > 0 || nestedAffected }
}

const annotationStreams = (doc, page) => {
  const refs = []
  const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
  for (const entry of annotations?.asArray() ?? []) {
    const annotation = doc.context.lookup(entry)
    const appearance = annotation instanceof PDFDict && annotation.lookupMaybe(PDFName.of('AP'), PDFDict)
    for (const state of appearance ? appearance.values() : []) {
      if (state instanceof PDFRef && doc.context.lookup(state) instanceof PDFRawStream) refs.push(state)
      const states = doc.context.lookup(state)
      if (states instanceof PDFDict) for (const ref of states.values()) if (ref instanceof PDFRef) refs.push(ref)
    }
  }
  return refs
}

// Deletes every object that the document no longer references, so erased images leave no data behind.
const dropUnreachableObjects = (doc) => {
  const reachable = new Set()
  const pending = Object.values(doc.context.trailerInfo).filter(Boolean)
  while (pending.length) {
    const value = pending.pop()
    if (value instanceof PDFRef) {
      const key = value.toString()
      if (reachable.has(key)) continue
      reachable.add(key)
      const object = doc.context.lookup(value)
      if (object) pending.push(object)
    } else if (value instanceof PDFDict) {
      pending.push(...value.values())
    } else if (value instanceof PDFArray) {
      pending.push(...value.asArray())
    } else if (value?.dict instanceof PDFDict) {
      pending.push(value.dict)
    }
  }
  for (const [ref] of doc.context.enumerateIndirectObjects()) {
    if (!reachable.has(ref.toString())) doc.context.delete(ref)
  }
}

export const removeMatchingImagesFromPdf = async (bytes, reference) => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const state = {
    images: new Map(),
    streams: new Map(),
    matched: new Set(),
    cleanedResources: new Set(),
    unsupported: new Set(),
    inlineMatches: 0,
    removed: 0,
    pages: 0,
  }
  for (const page of doc.getPages()) {
    const resources = page.node.Resources()
    const contents = page.node.Contents()
    let affected = false
    if (contents) {
      const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents]
      const texts = streams.map((stream) => streamText(doc, stream))
      const failed = texts.find((entry) => entry.reason)
      if (failed) state.unsupported.add(`page content: ${failed.reason}`)
      else {
        const result = processContent(doc, texts.map((entry) => entry.text).join('\n'), resources, reference, state)
        affected = result.affected
        if (result.removed) {
          page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(Buffer.from(result.text, 'latin1'))))
        }
      }
    }
    for (const ref of annotationStreams(doc, page)) {
      affected = processNestedStream(doc, ref, resources, reference, state) || affected
    }
    if (affected) state.pages += 1
  }

  if (state.removed) {
    // Every draw of a matched image was cut, so its resource names can go and the data with them.
    for (const xObjects of state.cleanedResources) {
      for (const [name, ref] of xObjects.entries()) {
        if (ref instanceof PDFRef && state.matched.has(ref.toString())) xObjects.delete(name)
      }
    }
    dropUnreachableObjects(doc)
  }
  return {
    bytes: state.removed ? Buffer.from(await doc.save()) : Buffer.from(bytes),
    removed: state.removed,
    pagesCleaned: state.pages,
    matchedImages: state.matched.size + state.inlineMatches,
    unsupportedImages: [...state.unsupported],
  }
}

// ---------- files ----------

const pdfFilesAt = async (target) => {
  if ((await stat(target)).isFile()) return [target]
  return (await readdir(target, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
    .map((entry) => path.join(target, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

// Writes next to the original first and renames over it, so a crash never leaves a half-written PDF.
const overwrite = async (filePath, bytes) => {
  const temporary = `${filePath}.${process.pid}.tmp`
  try {
    await writeFile(temporary, bytes)
    await rename(temporary, filePath)
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

export const removeMatchingImagesInFolder = async (referencePath, target, { dryRun = false } = {}) => {
  const reference = await loadReferenceImage(referencePath)
  const pdfFiles = await pdfFilesAt(target)
  if (!pdfFiles.length) throw new Error(`No PDF files found in "${target}".`)

  const results = []
  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath)
    try {
      const { bytes, ...summary } = await removeMatchingImagesFromPdf(await readFile(filePath), reference)
      const saved = summary.removed > 0 && !dryRun
      if (saved) await overwrite(filePath, bytes)
      results.push({ fileName, filePath, saved, ...summary })
    } catch (error) {
      results.push({ fileName, filePath, saved: false, removed: 0, pagesCleaned: 0, matchedImages: 0, unsupportedImages: [], error: error.message })
    }
  }
  return results
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const [referencePath, target] = args.filter((arg) => arg !== '--dry-run')
  try {
    if (!referencePath || !target) {
      throw new Error('Usage: node remove-matching-image.js <reference.png|reference.jpg> <pdf-file-or-folder> [--dry-run]')
    }
    const results = await removeMatchingImagesInFolder(path.resolve(referencePath), path.resolve(target), { dryRun })
    for (const result of results) {
      if (result.error) {
        console.error(`${result.fileName}: FAILED - ${result.error}`)
        process.exitCode = 1
      } else if (result.removed) {
        const action = result.saved ? 'erased; PDF saved in place' : 'would be erased (dry run, file not changed)'
        console.log(`${result.fileName}: matching image ${action} on ${result.pagesCleaned} page(s)`)
      } else {
        console.log(`${result.fileName}: no matching image found; file left unchanged`)
      }
      if (result.unsupportedImages.length) {
        console.warn(`${result.fileName}: could not check ${result.unsupportedImages.length} item(s): ${result.unsupportedImages.slice(0, 5).join('; ')}${result.unsupportedImages.length > 5 ? '; ...' : ''}`)
      }
    }
    console.log(`Checked ${results.length} PDF(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
