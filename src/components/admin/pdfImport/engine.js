// Browser side of the PDF importer: loads PDFs with PDF.js, renders pages and crops diagrams.
// Loaded on demand (admin panel only), so PDF.js never reaches students' bundles.
// The legacy build supports older browsers; the modern build needs very new JavaScript features
// (e.g. Map.prototype.getOrInsertComputed) that many admins' browsers don't have yet.
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { normaliseItems, pagesToText, parseAnswerKey, parseQuestionPaper } from './layout'

GlobalWorkerOptions.workerSrc = workerUrl
const SCALE = 2 // render at 2× so cropped diagrams stay sharp
const INK = 200 // pixels darker than this (0–255 luminance) count as ink

export const openPdf = async (file) => getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise

export const readPages = async (pdf, onProgress) => {
  const pages = []
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number)
    const viewport = page.getViewport({ scale: 1 })
    pages.push({ width: viewport.width, height: viewport.height, items: normaliseItems(await page.getTextContent(), viewport) })
    onProgress?.(number, pdf.numPages)
  }
  return pages
}

export const readAnswerKey = async (file) => parseAnswerKey(pagesToText(await readPages(await openPdf(file))))

const renderPage = async (pdf, pageIndex, cache) => {
  if (!cache[pageIndex]) {
    cache[pageIndex] = (async () => {
      const page = await pdf.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: SCALE })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: context, viewport }).promise
      return canvas
    })()
  }
  return cache[pageIndex]
}

// Bounding box (page points) of ink inside `area`, ignoring pixels covered by `masks` (text boxes).
const inkBox = (canvas, area, masks) => {
  const x0 = Math.max(0, Math.floor(area.left * SCALE)), y0 = Math.max(0, Math.floor(area.top * SCALE))
  const w = Math.min(canvas.width, Math.ceil(area.right * SCALE)) - x0, h = Math.min(canvas.height, Math.ceil(area.bottom * SCALE)) - y0
  if (w <= 0 || h <= 0) return null
  const { data } = canvas.getContext('2d').getImageData(x0, y0, w, h)
  const masked = new Uint8Array(w * h)
  for (const box of masks) {
    const bx0 = Math.max(0, Math.floor((box.x - 1.5) * SCALE) - x0), bx1 = Math.min(w, Math.ceil((box.x + box.width + 1.5) * SCALE) - x0)
    const by0 = Math.max(0, Math.floor((box.top - 1.5) * SCALE) - y0), by1 = Math.min(h, Math.ceil((box.bottom + 1.5) * SCALE) - y0)
    for (let y = by0; y < by1; y += 1) masked.fill(1, y * w + bx0, y * w + Math.max(bx0, bx1))
  }
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (masked[y * w + x]) continue
      const i = (y * w + x) * 4
      if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < INK) { count += 1; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    }
  }
  // Ignore specks and stray underline marks.
  if (count < 40 || maxX - minX < 20 || maxY - minY < 12) return null
  return { left: (x0 + minX) / SCALE, top: (y0 + minY) / SCALE, right: (x0 + maxX + 1) / SCALE, bottom: (y0 + maxY + 1) / SCALE }
}

// Copies page regions onto one canvas, stacked vertically, with white padding.
const stack = (crops) => {
  const pad = 12
  const width = Math.max(...crops.map((crop) => crop.w)) + pad * 2
  const height = crops.reduce((sum, crop) => sum + crop.h, 0) + pad * (crops.length + 1)
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'; context.fillRect(0, 0, width, height)
  let y = pad
  for (const crop of crops) {
    context.drawImage(crop.canvas, crop.x, crop.y, crop.w, crop.h, pad, y, crop.w, crop.h)
    for (const cover of crop.covers || []) { context.fillStyle = '#fff'; context.fillRect(pad + cover.x, y + cover.y, cover.w, cover.h) }
    y += crop.h + pad
  }
  return canvas
}
const toImage = (canvas) => new Promise((resolve) => canvas.toBlob((blob) => resolve({ blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height }), 'image/png'))
const grow = (box, by, page) => ({ left: Math.max(0, box.left - by), top: Math.max(0, box.top - by), right: Math.min(page.width, box.right + by), bottom: Math.min(page.height, box.bottom + by) })

// Diagram / chart / picture options for one question: ink that isn't text. Text lines that sit inside the
// diagram (labels such as "air" and "glass") are returned so they can be removed from the question text.
const findFigure = async (pdf, pages, question, cache) => {
  const crops = []
  const labels = new Set()
  for (const segment of question.segments) {
    const page = pages[segment.pageIndex]
    const canvas = await renderPage(pdf, segment.pageIndex, cache)
    const masks = question.textBoxes.filter((box) => box.pageIndex === segment.pageIndex).flatMap((box) => box.items)
    const box = inkBox(canvas, { left: 0, right: page.width, top: segment.top, bottom: segment.bottom }, masks)
    if (!box) continue
    // Include labels that touch the diagram, then pad.
    let area = { ...box }
    for (const line of question.lines.filter((item) => item.pageIndex === segment.pageIndex)) {
      const inside = line.x >= box.left - 6 && line.right <= box.right + 6 && line.top >= box.top - 14 && line.bottom <= box.bottom + 14
      if (inside) { labels.add(line); area = { left: Math.min(area.left, line.x), right: Math.max(area.right, line.right), top: Math.min(area.top, line.top), bottom: Math.max(area.bottom, line.bottom) } }
    }
    // Picture options: the A–D letters under the pictures must be in the image, or students can't tell them apart.
    if (question.pictureOptions) {
      for (const option of question.options.filter((item) => item.pageIndex === segment.pageIndex)) {
        area = { left: Math.min(area.left, option.x - 2), right: Math.max(area.right, option.x + 12), top: Math.min(area.top, option.top), bottom: Math.max(area.bottom, option.bottom) }
      }
    }
    area = grow(area, 6, page)
    crops.push({ canvas, x: area.left * SCALE, y: area.top * SCALE, w: (area.right - area.left) * SCALE, h: (area.bottom - area.top) * SCALE })
  }
  return { image: crops.length ? await toImage(stack(crops)) : null, labels }
}

// The whole question (stem, diagram and options) as one image, with the question number blanked out.
const wholeQuestion = async (pdf, pages, question, cache) => {
  const crops = []
  for (const segment of question.segments) {
    const page = pages[segment.pageIndex]
    const canvas = await renderPage(pdf, segment.pageIndex, cache)
    const box = inkBox(canvas, { left: 0, right: page.width, top: segment.top, bottom: segment.bottom }, [])
    if (!box) continue
    const area = grow(box, 6, page)
    const numberItem = segment === question.segments[0] ? question.numberBox : null
    const covers = numberItem ? [{ x: (numberItem.x - 2 - area.left) * SCALE, y: (numberItem.top - 2 - area.top) * SCALE, w: (numberItem.width + 4) * SCALE, h: (numberItem.bottom - numberItem.top + 4) * SCALE }] : []
    crops.push({ canvas, x: area.left * SCALE, y: area.top * SCALE, w: (area.right - area.left) * SCALE, h: (area.bottom - area.top) * SCALE, covers })
  }
  return crops.length ? toImage(stack(crops)) : null
}

// Full pipeline for the review screen: parse, then crop images for every question.
export const extractQuestions = async (file, { onProgress } = {}) => {
  const pdf = await openPdf(file)
  const pages = await readPages(pdf, (done, total) => onProgress?.(`Reading page ${done} of ${total}`, done / total * 0.4))
  const { questions, warnings } = parseQuestionPaper(pages)
  const cache = {}
  const results = []
  for (const [index, question] of questions.entries()) {
    onProgress?.(`Finding diagrams in question ${question.number}`, 0.4 + (index + 1) / questions.length * 0.6)
    const { image: figure, labels } = await findFigure(pdf, pages, question, cache)
    const stem = question.stemLines.filter((line) => !labels.has(line)).map((line) => line.text).join('\n').trim()
    results.push({ ...question, stem, figure, whole: await wholeQuestion(pdf, pages, question, cache) })
  }
  return { questions: results, warnings, pageCount: pdf.numPages }
}
