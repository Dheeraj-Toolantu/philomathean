// PDF question-paper parsing engine (pure layout logic; works in the browser and in Node tests).
// Input: the positioned text items PDF.js returns for each page. Output: questions with their stem,
// options, answer and the page regions they occupy (used later to crop diagrams from the rendered page).
//
// Built for multiple-choice papers such as Cambridge Paper 1: questions numbered 1, 2, 3… at the left
// margin, options labelled A–D (text options, options on one line, or picture options under a diagram).

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E']
const HEADER_FOOTER = /(©|UCLES|Cambridge (University Press|International|Assessment)|\[Turn over|Turn over|BLANK PAGE|Page \d+ of \d+|^\d{4}\/\d{2}\/[A-Z]\/[A-Z]\/\d{2}$|Permission to reproduce|This document (consists|has))/i

// PDF.js text items → { str, x, top, bottom, width, height } in top-left page coordinates (PDF points).
// Watermarks ("PHILOMATHEAN", "SPECIMEN"…) are dropped: rotated text, and text far larger than the page's
// usual size, which would otherwise merge into the lines it overlaps.
export const normaliseItems = (textContent, viewport) => {
  const items = readItems(textContent, viewport)
  const sizes = items.map((item) => item.height).sort((a, b) => a - b)
  const typical = sizes[Math.floor(sizes.length / 2)] || 10
  return items.filter((item) => item.height <= typical * 3)
}
const readItems = (textContent, viewport) => textContent.items
  // Skip empty items and rotated text (diagonal watermarks such as "PHILOMATHEAN" or "SPECIMEN").
  .filter((item) => item.str && item.str.trim() && Math.abs(item.transform[1]) < 0.01 && Math.abs(item.transform[2]) < 0.01)
  .map((item) => {
    const height = Math.abs(item.height || item.transform[3] || 10)
    const x = item.transform[4]
    const baseline = viewport.height - item.transform[5]
    return { str: item.str, x, top: baseline - height * 0.85, bottom: baseline + height * 0.2, width: item.width, height }
  })

// Groups items that share a baseline into lines, left to right, top to bottom.
export const groupLines = (items) => {
  const sorted = [...items].sort((a, b) => a.top - b.top || a.x - b.x)
  const lines = []
  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.mid - (item.top + item.bottom) / 2) < Math.max(candidate.height, item.height) * 0.45)
    if (line) { line.items.push(item); line.top = Math.min(line.top, item.top); line.bottom = Math.max(line.bottom, item.bottom); line.height = Math.max(line.height, item.height) }
    else lines.push({ items: [item], top: item.top, bottom: item.bottom, height: item.height, mid: (item.top + item.bottom) / 2 })
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    line.x = line.items[0].x
    line.right = Math.max(...line.items.map((item) => item.x + item.width))
    // Join with a space where there is a visible gap between items.
    line.text = line.items.reduce((text, item, index) => {
      if (!index) return item.str
      const previous = line.items[index - 1]
      const gap = item.x - (previous.x + previous.width)
      // A space for visible gaps, and for overlapping items (two separate pieces of text drawn on top of each other).
      const separate = gap > item.height * 0.15 || gap < -item.height * 0.5
      return text + (separate && !text.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str
    }, '').replace(/\s+/g, ' ').trim()
  }
  return lines.sort((a, b) => a.top - b.top)
}

const isChrome = (line, page) => line.bottom < page.height * 0.07 || line.top > page.height * 0.93 || HEADER_FOOTER.test(line.text) || /^\d{1,2}$/.test(line.text) && line.top < page.height * 0.08

const numberToken = (line) => {
  const first = line.items[0].str.trim()
  const match = first.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]?$/i) || line.text.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]?\s/i)
  return match ? Number(match[1]) : null
}

// Finds question starts: numbers 1, 2, 3… in order, at a consistent left margin.
const findStarts = (pages) => {
  const candidates = []
  pages.forEach((page, pageIndex) => page.lines.forEach((line) => {
    if (line.chrome) return
    const number = numberToken(line)
    if (number != null && line.x < page.width * 0.25) candidates.push({ number, pageIndex, line })
  }))
  if (!candidates.length) return []
  // The question-number column is the most common x among candidates.
  const columns = {}
  for (const candidate of candidates) { const key = Math.round(candidate.line.x / 6); columns[key] = (columns[key] || 0) + 1 }
  const column = Number(Object.entries(columns).sort((a, b) => b[1] - a[1])[0][0]) * 6
  const starts = []
  let expected = null
  for (const candidate of candidates) {
    if (Math.abs(candidate.line.x - column) > 14) continue
    if (expected == null || candidate.number === expected) { starts.push(candidate); expected = candidate.number + 1 }
  }
  return starts
}

// Splits a line into option parts when several options share it ("A 2 B 4 C 6 D 8").
const optionParts = (line) => {
  const parts = []
  line.items.forEach((item, index) => {
    const token = item.str.trim().replace(/^\(?([A-E])[.)]?$/, '$1')
    if (OPTION_LETTERS.includes(token)) parts.push({ letter: token, items: [], top: line.top, bottom: line.bottom, x: item.x, index })
    else if (parts.length) parts.at(-1).items.push(item)
  })
  return parts.map((part) => ({ ...part, text: part.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim() }))
}

const startsWithOption = (line) => {
  const token = line.items[0].str.trim().replace(/^\(?([A-E])[.)]?$/, '$1')
  return OPTION_LETTERS.includes(token)
}

// Collects options A, B, C, D in order from the question's lines.
const findOptions = (lines) => {
  const options = []
  const optionLines = new Set()
  for (const line of lines) {
    const looksLikeOptions = startsWithOption(line) || optionParts(line).length >= 2
    if (!looksLikeOptions) continue
    const parts = optionParts(line)
    const next = OPTION_LETTERS[options.length]
    if (!parts.length || parts[0].letter !== next) continue
    let added = 0
    for (const part of parts) { if (part.letter === OPTION_LETTERS[options.length]) { options.push({ ...part, pageIndex: line.pageIndex }); added += 1 } }
    if (added) optionLines.add(line)
  }
  return options.length >= 2 ? { options, optionLines } : { options: [], optionLines: new Set() }
}

// pages: [{ width, height, items }] → { questions, warnings }
export const parseQuestionPaper = (pages) => {
  const laidOut = pages.map((page) => {
    const lines = groupLines(page.items)
    lines.forEach((line) => { line.chrome = isChrome(line, page) })
    const content = lines.filter((line) => !line.chrome)
    return { ...page, lines, contentTop: content[0]?.top ?? page.height * 0.07, contentBottom: content.at(-1)?.bottom ?? page.height * 0.93 }
  })
  const starts = findStarts(laidOut)
  const questions = starts.map((start, index) => {
    const end = starts[index + 1]
    const segments = []
    // The last question stays on its own page unless its options run onto the next one (anything after
    // the last question is usually a blank page or a data sheet such as the Periodic Table).
    // A multiple-choice question never runs over more than two pages; anything longer is not a question.
    let lastPage = end ? Math.min(end.pageIndex, start.pageIndex + 1) : start.pageIndex
    if (!end && start.pageIndex + 1 < laidOut.length) {
      const own = laidOut[start.pageIndex].lines.filter((line) => !line.chrome && line.top >= start.line.top)
      const next = laidOut[start.pageIndex + 1].lines.filter((line) => !line.chrome)
      if (findOptions(own).options.length < 2 && next.length && startsWithOption(next[0])) lastPage = start.pageIndex + 1
    }
    for (let p = start.pageIndex; p <= lastPage; p += 1) {
      const page = laidOut[p]
      const top = p === start.pageIndex ? start.line.top - 4 : page.contentTop - 4
      const bottom = end && p === end.pageIndex ? end.line.top - 6 : page.contentBottom + 6
      if (bottom <= top && p === start.pageIndex) continue
      if (bottom - top > 8) segments.push({ pageIndex: p, top, bottom, left: 0, right: page.width })
    }
    // The last question on a paper only spans its own page (anything after it is usually blank or chrome).
    const lines = segments.flatMap((segment) => laidOut[segment.pageIndex].lines
      .filter((line) => !line.chrome && line.top >= segment.top - 1 && line.bottom <= segment.bottom + 1)
      .map((line) => ({ ...line, pageIndex: segment.pageIndex })))
    // Drop the question number itself from the first line (kept as numberBox for masking and cropping).
    const first = lines[0]
    const numberBox = first && /^(?:Q(?:uestion)?\s*)?\d{1,3}[.)]?$/i.test(first.items[0].str.trim()) ? first.items[0] : null
    if (first) {
      const numberItem = first.items[0]
      const rest = numberItem.str.trim().match(/^\d{1,3}[.)]?$/) ? first.items.slice(1) : first.items
      first.items = rest.length ? rest : first.items
      first.text = numberItem.str.trim().match(/^\d{1,3}[.)]?$/) ? first.text.replace(/^\S+\s*/, '') : first.text.replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}[.)]?\s*/i, '')
    }
    const { options, optionLines } = findOptions(lines)
    const firstOption = lines.findIndex((line) => optionLines.has(line))
    const stemLines = (firstOption >= 0 ? lines.slice(0, firstOption) : lines).filter((line) => line.text)
    const pictureOptions = options.length > 0 && options.every((option) => !option.text)
    return {
      number: start.number,
      segments,
      lines,
      stemLines,
      stem: stemLines.map((line) => line.text).join('\n').trim(),
      options: options.map((option) => ({ letter: option.letter, text: option.text, pageIndex: option.pageIndex, top: option.top, bottom: option.bottom, x: option.x })),
      pictureOptions,
      numberBox,
      textBoxes: [...lines.map((line) => ({ pageIndex: line.pageIndex, items: line.items.map((item) => ({ x: item.x, top: item.top, bottom: item.bottom, width: item.width })) })),
        ...(numberBox ? [{ pageIndex: start.pageIndex, items: [numberBox] }] : [])],
    }
  })
  const warnings = []
  if (!pages.some((page) => page.items.length)) warnings.push('No text was found in this PDF. It is probably a scanned image; the importer needs a PDF with selectable text.')
  else if (!questions.length) warnings.push('No numbered questions were found. The importer looks for questions numbered 1, 2, 3… at the left margin.')
  else {
    const withOptions = questions.filter((question) => question.options.length >= 2).length
    if (withOptions < questions.length * 0.5) warnings.push(`Only ${withOptions} of ${questions.length} questions have options A–D. This looks like a written-answer paper or a mark scheme; only multiple-choice questions can be imported (others are unticked — you can add options yourself or import them as images).`)
  }
  return { questions, warnings }
}

// Answer keys from a mark scheme ("1 B 1" table rows, two-column tables) or a pasted list
// ("1 B, 2 C" / "1-B 2-C" / "BCDA…"). Returns { questionNumber: 'B' }.
export const parseAnswerKey = (text) => {
  const key = {}
  const source = String(text || '')
  const compact = source.replace(/\s+/g, '')
  if (/^[A-E]{3,}$/i.test(compact)) { [...compact.toUpperCase()].forEach((letter, index) => { key[index + 1] = letter }); return key }
  for (const match of source.matchAll(/(?:^|[\s,;|])(\d{1,3})\s*[-–:.)]?\s*([A-E])(?=$|[\s,;|])/gim)) {
    const number = Number(match[1])
    if (number > 0 && number < 200 && !key[number]) key[number] = match[2].toUpperCase()
  }
  return key
}

// Mark-scheme pages → text with one table row per line, ready for parseAnswerKey.
export const pagesToText = (pages) => pages.map((page) => groupLines(page.items).map((line) => line.text).join('\n')).join('\n')
