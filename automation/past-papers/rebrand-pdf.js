// Rebrands a PDF downloaded from PapaCambridge: removes the PapaCambridge watermark (the tiled
// background logo, the faint diagonal overlay, the footer and its hidden "Licensed for hosting on
// papacambridge.com" trace text, the "www.PapaCambridge.com" corner ribbon on older papers and its
// link, and the PapaCambridge document properties and XMP metadata), then
// stamps every page with the Philomathean watermark: the logo (<repo>/logo.png) and the name
// "PHILOMATHEAN", centred and faint, plus a small "Philomathean Career Institute" footer.
//
// Also names the file after its year and content, e.g.
//   0452_s23_ms_12.pdf → "2023 May-June - Accounting 0452 - Mark Scheme - Paper 12.pdf"
//
// Usage (rebrands a folder of PDFs that were downloaded earlier, renaming them in place and
// updating the folder's manifest.json):
//   node rebrand-pdf.js <folder> [--subject "Accounting"]
import { existsSync } from 'node:fs'
import { readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream, degrees, rgb } from 'pdf-lib'
import { PNG } from 'pngjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const DEFAULT_LOGO = path.join(repoRoot, 'logo.png')
const BRAND = 'Philomathean'
const BRAND_COLOR = rgb(0x24 / 255, 0x44 / 255, 0x9a / 255)
const WATERMARK_MARKER = /papacambridge|\/FormXob\.pcm\s+Do|\/gRLs[\w-]*\s+gs/i
// PapaCambridge stamps its overlays with ReportLab, whose canvas always opens with this preamble.
const OVERLAY_PREAMBLE = /^\s*(?:[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+re\s+W\*?\s+n\s+)?1 0 0 1 0 0 cm\s+BT\s+\/[\w.+-]+\s+12\s+Tf\s+14\.4\s+TL\s+ET/

// ---------------------------------------------------------------------------------------------
// File names

const SESSIONS = { m: 'Feb-March', s: 'May-June', w: 'Oct-Nov', y: 'Specimen' }
const CONTENT_TYPES = {
  qp: 'Question Paper',
  ms: 'Mark Scheme',
  er: 'Examiner Report',
  gt: 'Grade Thresholds',
  in: 'Insert',
  ci: 'Confidential Instructions',
  ir: 'Instructions',
  pm: 'Pre-release Material',
  sf: 'Source Files',
  sp: 'Specimen Paper',
  sm: 'Specimen Mark Scheme',
  si: 'Specimen Insert',
  sr: 'Specimen Report',
  sy: 'Syllabus',
}
const CAIE_NAME = /^(\d{4})_([mswy])(\d{2})_([a-z]{2})(?:_(\w{1,3}))?\.pdf$/i

const cleanFileName = (value) => value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()

// "Mathematics 0444" → "Mathematics"; "business studies" → "Business Studies".
export const subjectLabel = (searchTerm = '') =>
  String(searchTerm)
    .split(/\s+/)
    .filter((word) => word && !/^\(?\d{4}\)?$/.test(word))
    .map((word) => (/^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')

// Builds a readable name from a CAIE file name (0452_s23_ms_12.pdf). Other names fall back to the
// PDF's own title, prefixed with the year it mentions; returns null when neither says anything useful.
export const brandedFileName = (fileName, { subject = '', title = '' } = {}) => {
  const match = path.basename(fileName).match(CAIE_NAME)
  if (match) {
    const [, syllabus, session, year, type, variant] = match
    const content = CONTENT_TYPES[type.toLowerCase()] || type.toUpperCase()
    const subjectPart = [subjectLabel(subject), syllabus].filter(Boolean).join(' ')
    const parts = [`20${year} ${SESSIONS[session.toLowerCase()]}`, subjectPart, content]
    if (variant) parts.push(`Paper ${variant}`)
    return cleanFileName(`${parts.join(' - ')}.pdf`)
  }
  const cleanTitle = String(title).replace(/\s*[-|–]\s*papacambridge.*$/i, '').replace(/papacambridge/gi, '').trim()
  if (!cleanTitle) return null
  const year = cleanTitle.match(/\b(?:19|20)\d{2}\b/)?.[0]
  return cleanFileName(`${year && !cleanTitle.startsWith(year) ? `${year} - ` : ''}${cleanTitle}.pdf`)
}

// ---------------------------------------------------------------------------------------------
// Content-stream surgery

// Returns every q … Q block of a content stream as [start, end) offsets, skipping strings,
// hex strings, comments and inline images so their bytes are never mistaken for operators.
export const graphicsStateBlocks = (content) => {
  const blocks = []
  const open = []
  const isDelimiter = (ch) => ch === undefined || /[\s()<>[\]{}/%]/.test(ch)
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    if (ch === '(') {
      let depth = 1
      i += 1
      while (i < content.length && depth) {
        if (content[i] === '\\') i += 1
        else if (content[i] === '(') depth += 1
        else if (content[i] === ')') depth -= 1
        i += 1
      }
    } else if (ch === '<' || ch === '>') {
      if (content[i + 1] === ch) i += 2
      else if (ch === '<') i = content.indexOf('>', i) + 1 || content.length
      else i += 1
    } else if (ch === '/') {
      i += 1
      while (i < content.length && !isDelimiter(content[i])) i += 1
    } else if (ch === '%') {
      while (i < content.length && content[i] !== '\n' && content[i] !== '\r') i += 1
    } else if (isDelimiter(content[i - 1]) && isDelimiter(content[i + 1]) && (ch === 'q' || ch === 'Q')) {
      if (ch === 'q') open.push(i)
      else if (open.length) blocks.push({ start: open.pop(), end: i + 1, depth: open.length })
      i += 1
    } else if (ch === 'B' && content.startsWith('BI', i) && isDelimiter(content[i - 1]) && isDelimiter(content[i + 2])) {
      const data = content.slice(i).search(/\sID\s/)
      const endImage = data < 0 ? -1 : content.slice(i + data + 4).search(/\sEI(?=[\s]|$)/)
      i = endImage < 0 ? content.length : i + data + 4 + endImage + 3
    } else {
      i += 1
    }
  }
  return blocks
}

// Removes PapaCambridge's overlay blocks: the outermost q … Q blocks that open with the overlay
// preamble and draw its logo, its faint diagonal text or its footer.
export const stripWatermarkFromContent = (content) => {
  const watermarks = graphicsStateBlocks(content)
    .filter(({ start, end }) => {
      const body = content.slice(start + 1, end - 1)
      return OVERLAY_PREAMBLE.test(body) && WATERMARK_MARKER.test(body)
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((block, index, all) => !all.slice(0, index).some((outer) => outer.start <= block.start && block.end <= outer.end))
  let result = content
  for (const { start, end } of [...watermarks].reverse()) result = `${result.slice(0, start)}${result.slice(end)}`
  return { content: result, removed: watermarks.length }
}

// Splits a content stream into tokens with their offsets. Strings are decoded so that text drawn
// as "(www.PapaCambridge.com) Tj" or with escapes like "papacambridge\\056com" can be recognised;
// an inline image (BI … ID … EI) is kept as one token.
export const tokenize = (content) => {
  const tokens = []
  const isSpace = (ch) => /[\0\t\n\f\r ]/.test(ch)
  const isDelimiter = (ch) => ch === undefined || isSpace(ch) || /[()<>[\]{}/%]/.test(ch)
  const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    const start = i
    if (isSpace(ch)) {
      i += 1
    } else if (ch === '%') {
      while (i < content.length && content[i] !== '\n' && content[i] !== '\r') i += 1
    } else if (ch === '(') {
      let depth = 1
      let value = ''
      i += 1
      while (i < content.length && depth) {
        const c = content[i]
        if (c === '\\') {
          const next = content[i + 1]
          const octal = content.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0]
          if (octal) {
            value += String.fromCharCode(parseInt(octal, 8) & 0xff)
            i += 1 + octal.length
          } else {
            if (next !== '\n' && next !== '\r') value += escapes[next] ?? next ?? ''
            i += 2
          }
          continue
        }
        if (c === '(') depth += 1
        else if (c === ')') depth -= 1
        if (depth) value += c
        i += 1
      }
      tokens.push({ type: 'string', value, start, end: i })
    } else if (ch === '<' && content[i + 1] === '<') {
      tokens.push({ type: 'dictOpen', start, end: (i += 2) })
    } else if (ch === '>' && content[i + 1] === '>') {
      tokens.push({ type: 'dictClose', start, end: (i += 2) })
    } else if (ch === '<') {
      const close = content.indexOf('>', i)
      i = close < 0 ? content.length : close + 1
      const hex = content.slice(start + 1, i - 1).replace(/[^0-9a-f]/gi, '')
      tokens.push({ type: 'string', value: Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex').toString('latin1'), start, end: i })
    } else if (ch === '[' || ch === ']') {
      tokens.push({ type: ch === '[' ? 'arrayOpen' : 'arrayClose', start, end: (i += 1) })
    } else if (ch === '/') {
      i += 1
      while (i < content.length && !isDelimiter(content[i])) i += 1
      tokens.push({ type: 'name', value: content.slice(start + 1, i), start, end: i })
    } else {
      while (i < content.length && !isDelimiter(content[i])) i += 1
      if (i === start) i += 1
      const word = content.slice(start, i)
      if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(word)) {
        tokens.push({ type: 'number', value: Number(word), start, end: i })
      } else if (word === 'BI') {
        const data = content.slice(i).search(/\sID\s/)
        const endImage = data < 0 ? -1 : content.slice(i + data + 4).search(/\sEI(?=\s|$)/)
        i = endImage < 0 ? content.length : i + data + 4 + endImage + 3
        tokens.push({ type: 'op', value: 'BI', start, end: i })
      } else {
        tokens.push({ type: 'op', value: word, start, end: i })
      }
    }
  }
  return tokens
}

const PAPACAMBRIDGE = /papa\s*cambridge/i
// Text may be stored as two-byte characters, so the check ignores the zero bytes between letters.
const mentionsPapaCambridge = (text) => PAPACAMBRIDGE.test(text) || PAPACAMBRIDGE.test(text.replace(/\0/g, ''))
const multiply = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
]
const boundsOf = (matrix, [x0, y0, x1, y1]) => {
  const points = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]])
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

// True when a box sits in the top-left or top-right corner of the page as it is viewed (taking
// /Rotate into account), touching both edges like a corner ribbon, while covering only a small part
// of the page, so full-page scans and the paper's own logos and diagrams are never matched.
export const isCornerRibbon = (bounds, [px0, py0, px1, py1], rotation = 0) => {
  const view = ([x, y]) => ({
    0: [x - px0, y - py0],
    90: [y - py0, px1 - x],
    180: [px1 - x, py1 - y],
    270: [py1 - y, x - px0],
  })[((rotation % 360) + 360) % 360]
  const [vx0, vy0] = view([bounds[0], bounds[1]])
  const [vx1, vy1] = view([bounds[2], bounds[3]])
  const [left, right, bottom, top] = [Math.min(vx0, vx1), Math.max(vx0, vx1), Math.min(vy0, vy1), Math.max(vy0, vy1)]
  const turned = rotation % 180 !== 0
  const [width, height] = turned ? [py1 - py0, px1 - px0] : [px1 - px0, py1 - py0]
  const tolerance = Math.min(width, height) * 0.04
  const boxWidth = Math.min(right, width) - Math.max(left, 0)
  const boxHeight = Math.min(top, height) - Math.max(bottom, 0)
  if (boxWidth <= 0 || boxHeight <= 0) return false
  const small = boxWidth <= width * 0.45 && boxHeight <= height * 0.4 && boxWidth * boxHeight <= width * height * 0.12
  return small && top >= height - tolerance && (right >= width - tolerance || left <= tolerance)
}

// Removes the "www.PapaCambridge.com" corner ribbon of older papers, however it was drawn:
// - an image or form placed in a top corner, touching both edges;
// - a form whose own text mentions PapaCambridge;
// - text mentioning PapaCambridge: its q … Q block (with the ribbon shape behind it) is removed when
//   that block draws no other text, otherwise only the PapaCambridge words are blanked.
// `xObjects` maps resource names to { subtype, bbox, matrix, mentionsPapaCambridge }.
export const stripRibbonFromContent = (content, { xObjects = {}, pageBox = [0, 0, 595.32, 841.92], rotation = 0 } = {}) => {
  const edits = []
  const stack = []
  let ctm = [1, 0, 0, 1, 0, 0]
  let operands = []
  const textOperands = () => operands.filter((token) => token.type === 'string')
  const markText = (strings) => {
    if (!strings.length) return
    const text = strings.map((token) => token.value).join('')
    const block = stack.at(-1)
    if (mentionsPapaCambridge(text)) {
      if (block) block.watermarkText = true
      const array = [operands.find((token) => token.type === 'arrayOpen'), operands.findLast((token) => token.type === 'arrayClose')]
      if (array[0] && array[1]) edits.push({ start: array[0].start, end: array[1].end, text: '[]' })
      else edits.push({ start: strings[0].start, end: strings[0].end, text: '()' })
    } else if (text.replace(/\0/g, '').trim() && block) {
      block.otherText = true
    }
  }
  for (const token of tokenize(content)) {
    if (token.type !== 'op') {
      operands.push(token)
      continue
    }
    const numbers = operands.filter((item) => item.type === 'number').map((item) => item.value)
    switch (token.value) {
      case 'q':
        stack.push({ start: token.start, ctm, watermarkText: false, otherText: false })
        break
      case 'Q': {
        const block = stack.pop()
        if (!block) break
        ctm = block.ctm
        if (block.watermarkText && !block.otherText) edits.push({ start: block.start, end: token.end, text: '' })
        if (block.otherText && stack.length) stack.at(-1).otherText = true
        break
      }
      case 'cm':
        if (numbers.length === 6) ctm = multiply(numbers, ctm)
        break
      case 'Do': {
        const name = operands.at(-1)?.type === 'name' ? operands.at(-1).value : null
        const xObject = name && xObjects[name]
        if (!xObject) break
        const bounds = xObject.subtype === 'Form'
          ? boundsOf(multiply(xObject.matrix ?? [1, 0, 0, 1, 0, 0], ctm), xObject.bbox ?? [0, 0, 1, 1])
          : boundsOf(ctm, [0, 0, 1, 1])
        if (xObject.mentionsPapaCambridge || isCornerRibbon(bounds, pageBox, rotation)) edits.push({ start: operands.at(-1).start, end: token.end, text: '', xObject: name })
        break
      }
      case 'Tj':
      case "'":
      case '"':
      case 'TJ':
        markText(textOperands())
        break
      default:
        break
    }
    operands = []
  }
  // Apply from the end, skipping edits inside a block that is removed as a whole.
  const ordered = edits.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept = ordered.filter((edit, index) => !ordered.slice(0, index).some((outer) => outer.start <= edit.start && edit.end <= outer.end && outer !== edit))
  let result = content
  for (const { start, end, text } of [...kept].reverse()) result = `${result.slice(0, start)}${text}${result.slice(end)}`
  return { content: result, removed: kept.length, xObjects: [...new Set(kept.map((edit) => edit.xObject).filter(Boolean))] }
}

const decodeStream = (stream) => Buffer.from(stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents())

const pageContent = (doc, page) => {
  const contents = page.node.Contents()
  if (!contents) return ''
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents]
  return streams.map((stream) => decodeStream(stream).toString('latin1')).join('\n')
}

// Drops the watermark's resources (its logo form, ribbon images and transparency states) once
// nothing uses them.
const dropUnusedWatermarkResources = (doc, page, content, removedXObjects = []) => {
  const resources = page.node.Resources()
  if (!resources) return
  const removedNames = new Set(removedXObjects)
  for (const [category, matches] of [['XObject', (name) => name === 'FormXob.pcm' || removedNames.has(name)], ['ExtGState', (name) => /^gRLs/.test(name)]]) {
    const dict = resources.lookupMaybe(PDFName.of(category), PDFDict)
    if (!dict) continue
    for (const key of dict.keys()) {
      const name = key.decodeText()
      if (matches(name) && !new RegExp(`/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`).test(content)) dict.delete(key)
    }
  }
}

// Describes the page's images and forms for stripRibbonFromContent.
const pageXObjects = (doc, page) => {
  const dict = page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  const result = {}
  if (!dict) return result
  for (const [key, ref] of dict.entries()) {
    const stream = doc.context.lookup(ref)
    if (!(stream instanceof PDFRawStream)) continue
    const subtype = stream.dict.lookup(PDFName.of('Subtype'))?.decodeText?.()
    const numbers = (name) => stream.dict.lookupMaybe(PDFName.of(name), PDFArray)?.asArray().map((item) => doc.context.lookup(item)?.asNumber?.() ?? 0)
    const entry = { subtype, bbox: numbers('BBox'), matrix: numbers('Matrix') }
    if (subtype === 'Form') {
      try {
        const formContent = decodeStream(stream).toString('latin1')
        entry.mentionsPapaCambridge = tokenize(formContent).some((token) => token.type === 'string' && mentionsPapaCambridge(token.value))
      } catch {
        entry.mentionsPapaCambridge = false
      }
    }
    result[key.decodeText()] = entry
  }
  return result
}

// Removes links to papacambridge.com (the ribbon is usually clickable) and stamp-style annotations
// that carry PapaCambridge's name.
const removePapaCambridgeAnnotations = (doc, page) => {
  const annots = page.node.Annots()
  if (!annots) return 0
  const keep = annots.asArray().filter((ref) => {
    const annot = doc.context.lookup(ref)
    if (!(annot instanceof PDFDict)) return true
    const action = annot.lookupMaybe(PDFName.of('A'), PDFDict)
    const texts = [action?.lookup(PDFName.of('URI')), annot.lookup(PDFName.of('Contents')), annot.lookup(PDFName.of('NM'))]
      .map((value) => value?.decodeText?.() ?? '')
    return !texts.some(mentionsPapaCambridge)
  })
  const removed = annots.size() - keep.length
  if (removed) page.node.set(PDFName.of('Annots'), doc.context.obj(keep))
  return removed
}

const removeWatermark = (doc) => {
  let removed = 0
  for (const page of doc.getPages()) {
    removed += removePapaCambridgeAnnotations(doc, page)
    const original = pageContent(doc, page)
    const overlay = stripWatermarkFromContent(original)
    const { x, y, width, height } = page.getCropBox()
    const ribbon = stripRibbonFromContent(overlay.content, {
      xObjects: pageXObjects(doc, page),
      pageBox: [x, y, x + width, y + height],
      rotation: page.getRotation().angle,
    })
    if (!overlay.removed && !ribbon.removed) continue
    removed += overlay.removed + ribbon.removed
    page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(Buffer.from(ribbon.content, 'latin1'))))
    dropUnusedWatermarkResources(doc, page, ribbon.content, ribbon.xObjects)
  }
  return removed
}

// ---------------------------------------------------------------------------------------------
// Philomathean watermark

const logoCache = new Map()

// The source logo is a large 1024 px PNG; a 360 px copy is plenty for a faint watermark and keeps
// every PDF from growing by over a megabyte.
export const loadWatermarkLogo = async (logoPath = DEFAULT_LOGO, maxSize = 360) => {
  if (logoCache.has(logoPath)) return logoCache.get(logoPath)
  if (!existsSync(logoPath)) throw new Error(`Watermark logo not found: ${logoPath}`)
  const source = PNG.sync.read(await readFile(logoPath))
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const target = new PNG({ width, height })
  // Box filter: each target pixel averages the source pixels it covers (premultiplied by alpha).
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [x0, x1] = [Math.floor(x / scale), Math.min(source.width, Math.ceil((x + 1) / scale))]
      const [y0, y1] = [Math.floor(y / scale), Math.min(source.height, Math.ceil((y + 1) / scale))]
      let [r, g, b, a, count] = [0, 0, 0, 0, 0]
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const index = (sy * source.width + sx) * 4
          const alpha = source.data[index + 3]
          r += source.data[index] * alpha
          g += source.data[index + 1] * alpha
          b += source.data[index + 2] * alpha
          a += alpha
          count += 1
        }
      }
      const index = (y * width + x) * 4
      target.data[index] = a ? Math.round(r / a) : 0
      target.data[index + 1] = a ? Math.round(g / a) : 0
      target.data[index + 2] = a ? Math.round(b / a) : 0
      target.data[index + 3] = Math.round(a / count)
    }
  }
  const png = PNG.sync.write(target)
  logoCache.set(logoPath, png)
  return png
}

const addWatermark = async (doc, logoPng) => {
  const logo = await doc.embedPng(logoPng)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  for (const page of doc.getPages()) {
    const { x: left, y: bottom, width, height } = page.getCropBox()
    const rotation = ((page.getRotation().angle % 360) + 360) % 360
    const turned = rotation === 90 || rotation === 270
    const [viewWidth, viewHeight] = turned ? [height, width] : [width, height]
    const centre = { x: left + width / 2, y: bottom + height / 2 }
    // Positions are worked out in the page as viewed, then turned to match /Rotate so the
    // watermark always appears upright.
    const place = (dx, dy) => {
      const radians = (rotation * Math.PI) / 180
      return { x: centre.x + dx * Math.cos(radians) - dy * Math.sin(radians), y: centre.y + dx * Math.sin(radians) + dy * Math.cos(radians) }
    }

    const logoSize = Math.min(viewWidth, viewHeight) * 0.42
    const nameSize = logoSize * 0.17
    const nameWidth = bold.widthOfTextAtSize(BRAND.toUpperCase(), nameSize)
    const groupHeight = logoSize + nameSize * 1.2
    const logoAt = place(-logoSize / 2, groupHeight / 2 - logoSize)
    page.drawImage(logo, { ...logoAt, width: logoSize, height: logoSize, opacity: 0.08, rotate: degrees(rotation) })
    page.drawText(BRAND.toUpperCase(), {
      ...place(-nameWidth / 2, -groupHeight / 2),
      size: nameSize,
      font: bold,
      color: BRAND_COLOR,
      opacity: 0.1,
      rotate: degrees(rotation),
    })

    const footer = `${BRAND} Career Institute`
    const footerSize = 7
    const footerWidth = regular.widthOfTextAtSize(footer, footerSize)
    page.drawText(footer, {
      ...place(-footerWidth / 2, -viewHeight / 2 + 8),
      size: footerSize,
      font: regular,
      color: BRAND_COLOR,
      opacity: 0.55,
      rotate: degrees(rotation),
    })
  }
}

// ---------------------------------------------------------------------------------------------
// Whole document

const setProperties = (doc, title) => {
  const info = doc.getInfoDict()
  for (const key of info.keys()) if (/^PC_/i.test(key.decodeText())) info.delete(key)
  doc.catalog.delete(PDFName.of('Metadata'))
  if (title) doc.setTitle(title)
  doc.setAuthor(BRAND)
  doc.setCreator(BRAND)
  doc.setProducer(BRAND)
  doc.setSubject(`${BRAND} Career Institute past papers`)
  doc.setKeywords([BRAND, 'past papers'])
  doc.setModificationDate(new Date())
}

const documentTitle = (doc) => {
  try {
    return doc.getTitle() || ''
  } catch {
    return ''
  }
}

// Removes the PapaCambridge watermark from `bytes`, adds the Philomathean one and returns the new
// PDF together with a suggested file name.
export const rebrandPdf = async (bytes, { fileName = '', subject = '', logoPath = DEFAULT_LOGO } = {}) => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const originalTitle = documentTitle(doc)
  const removed = removeWatermark(doc)
  await addWatermark(doc, await loadWatermarkLogo(logoPath))
  const name = brandedFileName(fileName, { subject, title: originalTitle }) || cleanFileName(path.basename(fileName || 'paper.pdf'))
  setProperties(doc, `${name.replace(/\.pdf$/i, '')} | ${BRAND}`)
  return { bytes: Buffer.from(await doc.save()), name, removed }
}

// ---------------------------------------------------------------------------------------------
// Command line: rebrand a folder that was downloaded before rebranding existed.

export const rebrandFolder = async (folder, { subject = '', logoPath = DEFAULT_LOGO } = {}) => {
  const manifestPath = path.join(folder, 'manifest.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { files: {} }
  const results = []
  for (const [original, entry] of Object.entries(manifest.files)) {
    if (entry.savedAs || !existsSync(path.join(folder, original))) continue
    const result = await rebrandPdf(await readFile(path.join(folder, original)), { fileName: original, subject, logoPath })
    await writeFile(path.join(folder, original), result.bytes)
    await rename(path.join(folder, original), path.join(folder, result.name))
    Object.assign(entry, { savedAs: result.name, watermarkRemoved: result.removed > 0, savedBytes: result.bytes.length })
    results.push({ from: original, to: result.name, removed: result.removed })
  }
  // PDFs not listed in a manifest are rebranded too, unless they already carry a branded name.
  const listed = new Set(Object.values(manifest.files).map((entry) => entry.savedAs).filter(Boolean))
  for (const original of (await readdir(folder)).filter((name) => /\.pdf$/i.test(name) && !listed.has(name) && !manifest.files[name])) {
    if (!CAIE_NAME.test(original)) continue
    const result = await rebrandPdf(await readFile(path.join(folder, original)), { fileName: original, subject, logoPath })
    await writeFile(path.join(folder, original), result.bytes)
    await rename(path.join(folder, original), path.join(folder, result.name))
    results.push({ from: original, to: result.name, removed: result.removed })
  }
  if (results.length && existsSync(manifestPath)) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return results
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [folder, flag, value] = process.argv.slice(2)
  try {
    if (!folder || (flag && flag !== '--subject')) throw new Error('Usage: node rebrand-pdf.js <folder> [--subject "Accounting"]')
    const subject = value ?? path.basename(path.resolve(folder)).replace(/-/g, ' ')
    const results = await rebrandFolder(path.resolve(folder), { subject, logoPath: process.env.WATERMARK_LOGO || DEFAULT_LOGO })
    results.forEach(({ from, to, removed }) => console.log(`${from} -> ${to}${removed ? '' : ' (no PapaCambridge watermark found)'}`))
    console.log(`Rebranded ${results.length} PDF(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
