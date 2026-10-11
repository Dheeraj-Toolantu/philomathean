import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { normaliseItems, pagesToText, parseAnswerKey, parseQuestionPaper } from '../../src/components/admin/pdfImport/layout.js'

const load = async (path) => {
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(new URL(path, import.meta.url))), verbosity: 0 }).promise
  const pages = []
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number)
    const viewport = page.getViewport({ scale: 1 })
    pages.push({ width: viewport.width, height: viewport.height, items: normaliseItems(await page.getTextContent(), viewport) })
  }
  return pages
}

test('multiple-choice paper: every question, its stem and options A–D are found', async () => {
  const { questions, warnings } = parseQuestionPaper(await load('../fixtures/mcq-question-paper.pdf'))
  assert.deepEqual(warnings, [])
  assert.deepEqual(questions.map((question) => question.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(questions[0].stem, 'Which quantity is a vector?')
  assert.deepEqual(questions[0].options.map((option) => option.text), ['energy', 'mass', 'momentum', 'speed'])
  assert.deepEqual(questions[2].options.map((option) => option.text), ['0.040 m/s', '9.0 m/s', '25 m/s', '900 m/s'])
  // Headers, footers and page numbers never leak into questions.
  assert.ok(questions.every((question) => !/UCLES|Turn over/.test(question.stem)))
})

test('picture options and questions that continue onto the next page', async () => {
  const { questions } = parseQuestionPaper(await load('../fixtures/mcq-question-paper.pdf'))
  const graphs = questions.find((question) => question.number === 5)
  assert.equal(graphs.pictureOptions, true)
  assert.deepEqual(graphs.options.map((option) => option.letter), ['A', 'B', 'C', 'D'])
  const split = questions.find((question) => question.number === 10)
  assert.deepEqual(split.segments.map((segment) => segment.pageIndex), [2, 3], 'last question runs onto the next page')
  assert.deepEqual(split.options.map((option) => option.text), ['0.33 V', '3.0 V', '8.0 V', '12 V'])
  assert.ok(questions.find((question) => question.number === 4).segments.length === 2, 'options on the following page are kept')
})

test('answer key from a mark scheme PDF', async () => {
  const key = parseAnswerKey(pagesToText(await load('../fixtures/mcq-mark-scheme.pdf')))
  assert.equal(Object.values(key).join(''), 'CCCBBBDCAD')
})

test('real Cambridge mark scheme with a watermark: all 35 answers', async () => {
  const key = parseAnswerKey(pagesToText(await load('../../past-papers/igcse/accounting-0452/2026 May-June - Accounting 0452 - Mark Scheme - Paper 11.pdf')))
  assert.equal(Object.keys(key).length, 35)
  assert.equal(key[1], 'A')
  assert.equal(key[19], 'A', 'the overlapping PHILOMATHEAN watermark does not swallow the answer')
  assert.equal(key[35], 'A')
})

test('written-answer papers are detected and flagged rather than imported', async () => {
  const { questions, warnings } = parseQuestionPaper(await load('../../015 - source pages 205-380 - 0607-23 - May-June 2018.pdf'))
  assert.ok(questions.length >= 10)
  assert.ok(questions.every((question) => question.options.length === 0))
  assert.match(warnings[0], /written-answer paper/)
})

test('pasted answer keys in common formats', () => {
  assert.deepEqual(parseAnswerKey('1 B, 2 C, 3 A'), { 1: 'B', 2: 'C', 3: 'A' })
  assert.deepEqual(parseAnswerKey('1-B 2-c 3:D'), { 1: 'B', 2: 'C', 3: 'D' })
  assert.deepEqual(parseAnswerKey('BCAD'), { 1: 'B', 2: 'C', 3: 'A', 4: 'D' })
  assert.deepEqual(parseAnswerKey('Question Answer Marks\n1 B 1\n2 D 1\nPage 3 of 3'), { 1: 'B', 2: 'D' })
})
