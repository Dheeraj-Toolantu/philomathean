import test from 'node:test'
import assert from 'node:assert/strict'
import { describePaper, filterPapers, groupPapers, pairPapers } from '../../src/components/site/paperInfo.js'

const paper = (title, extra = {}) => describePaper({ id: title, title, pathway: 'IGCSE', subjectName: 'MATHEMATICS', paperType: 'year-wise', access: 'free', ...extra })

test('titles become student-friendly paper labels', () => {
  const qp = paper('IGCSE-MATHS - 0607-21 - May-June 2017', { year: 2017, session: 'May-June' })
  assert.equal(qp.name, 'Paper 2 · Variant 1')
  assert.equal(qp.code, '0607/21')
  assert.equal(qp.kind, 'question-paper')
  assert.equal(qp.subjectLabel, 'Mathematics')
  assert.equal(paper('IGCSE-MATHS - 0607-42 - May-June 2017 - Mark Scheme').kind, 'mark-scheme')
  assert.equal(paper('IGCSCE - MATHS - 0607-23 - May-June 2015').name, 'Paper 2 · Variant 3')
})

test('search understands paper codes and years', () => {
  const papers = [paper('IGCSE-MATHS - 0607-21 - May-June 2017', { year: 2017 }), paper('IGCSE-MATHS - 0607-42 - Oct-Nov 2018', { year: 2018 })]
  assert.deepEqual(filterPapers(papers, { query: '0607/42' }).map((item) => item.code), ['0607/42'])
  assert.deepEqual(filterPapers(papers, { query: '2017' }).map((item) => item.year), [2017])
  assert.equal(filterPapers(papers, { kind: 'mark-scheme' }).length, 0)
})

test('groups are newest session first with question papers before mark schemes', () => {
  const groups = groupPapers([
    paper('IGCSE-MATHS - 0607-21 - May-June 2017 - Mark Scheme', { year: 2017, session: 'May-June' }),
    paper('IGCSE-MATHS - 0607-21 - May-June 2017', { year: 2017, session: 'May-June' }),
    paper('IGCSE-MATHS - 0607-21 - October-November 2017', { year: 2017, session: 'Oct-Nov' }),
    paper('IGCSE-MATHS - 0607-21 - May-June 2018', { year: 2018, session: 'May-June' }),
  ])
  assert.deepEqual(groups.map((group) => group.title), ['May / June 2018', 'October / November 2017', 'May / June 2017'])
  assert.deepEqual(groups[2].papers.map((item) => item.kind), ['question-paper', 'mark-scheme'])
})

test('newer "Question Paper 13" titles get paper numbers and the syllabus code', () => {
  const qp = paper('IGCSE Physics 0625 – May-June 2026 – Question Paper 13', { subjectName: 'PHYSICS', year: 2026, session: 'May-June' })
  assert.equal(qp.name, 'Paper 1 · Variant 3')
  assert.equal(qp.code, '0625/13')
  const ms = paper('IGCSE Physics 0625 – May-June 2026 – Mark Scheme 43', { subjectName: 'PHYSICS' })
  assert.equal(ms.kind, 'mark-scheme')
  assert.equal(ms.code, '0625/43')
  // A paper stored without subjectCode lands in the same subject as one stored with it.
  assert.equal(paper('IGCSE Physics 0625 – May-June 2026 – Question Paper 21', { subjectName: 'PHYSICS' }).subjectKey, paper('x', { subjectName: 'PHYSICS', subjectCode: '0625' }).subjectKey)
})

test('question papers and mark schemes pair into one entry per paper', () => {
  const extra = { subjectName: 'PHYSICS', year: 2026, session: 'May-June' }
  const sets = pairPapers([
    paper('IGCSE Physics 0625 – May-June 2026 – Mark Scheme 13', extra),
    paper('IGCSE Physics 0625 – May-June 2026 – Question Paper 13', extra),
    paper('IGCSE Physics 0625 – May-June 2026 – Question Paper 23', extra),
    paper('IGCSE Physics 0625 – Oct-Nov 2026 – Mark Scheme 13', { ...extra, session: 'Oct-Nov' }),
  ])
  assert.equal(sets.length, 3)
  const first = sets.find((set) => set.code === '0625/13' && set.session === 'May-June')
  assert.equal(first.questionPaper.kind, 'question-paper')
  assert.equal(first.markScheme.kind, 'mark-scheme')
  assert.equal(first.kind, 'question-paper')
  assert.equal(sets.find((set) => set.session === 'Oct-Nov').questionPaper, undefined)
  assert.deepEqual(groupPapers(sets).map((group) => group.papers.length), [1, 2])
})
