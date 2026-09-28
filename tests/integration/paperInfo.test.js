import test from 'node:test'
import assert from 'node:assert/strict'
import { describePaper, filterPapers, groupPapers } from '../../src/components/site/paperInfo.js'

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
