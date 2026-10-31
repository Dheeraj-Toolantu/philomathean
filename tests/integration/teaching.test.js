import test from 'node:test'
import assert from 'node:assert/strict'
import { markError, percent, progressCard, ratingSummary, studentSummaries, testSummaries, upcoming } from '../../src/teacher/marks.js'
import { everyTeacher, faculty, TEACHER_HIERARCHY } from '../../src/components/site/faculty.js'
import { COURSES, PROGRAMMES } from '../../src/student/catalog.js'

const mark = (studentUid, subject, testDate, score, maxScore = 50, schoolScore = null, testId = `${subject}-${testDate}`) => ({ id: `${studentUid}-${testId}`, testId, studentUid, studentName: studentUid.toUpperCase(), subject, testTitle: `Test ${testDate}`, testDate, score, maxScore, schoolScore })

test('progress card compares the first test (before) with the latest (after)', () => {
  const marks = [mark('a', 'Maths', '2026-09-20', 40), mark('a', 'Maths', '2026-07-01', 20), mark('a', 'Physics', '2026-08-01', 30, 60)]
  const card = progressCard(marks)
  assert.equal(card.count, 3)
  assert.equal(card.overall.before, 40)
  assert.equal(card.overall.after, 80)
  assert.equal(card.overall.change, 40)
  const maths = card.subjects.find((item) => item.subject === 'Maths')
  assert.deepEqual([maths.before, maths.after, maths.change, maths.average], [40, 80, 40, 60])
})

test('test score vs school score only uses tests that have a school score', () => {
  const card = progressCard([mark('a', 'Maths', '2026-07-01', 30, 50, 70), mark('a', 'Maths', '2026-08-01', 50, 50), mark('a', 'Biology', '2026-08-01', 25, 50)])
  assert.deepEqual(card.vsSchool, [{ subject: 'Maths', test: 60, school: 70, gap: -10 }])
})

test('tests and students are summarised for the teacher portal', () => {
  const marks = [mark('a', 'Maths', '2026-07-01', 45), mark('b', 'Maths', '2026-07-01', 25), mark('a', 'Maths', '2026-08-01', 50)]
  const tests = testSummaries(marks)
  assert.equal(tests[0].testDate, '2026-08-01')
  assert.deepEqual([tests[1].count, tests[1].average, tests[1].highest, tests[1].lowest], [2, 70, 90, 50])
  const students = studentSummaries(marks)
  assert.equal(students[0].studentUid, 'b', 'weakest average first')
  assert.equal(students[1].change, 10)
})

test('marks are validated against the maximum', () => {
  assert.equal(markError({ score: '45', maxScore: 50, schoolScore: '' }), null)
  assert.match(markError({ score: '55', maxScore: 50 }), /between 0 and 50/)
  assert.match(markError({ score: '10', maxScore: 0 }), /Maximum/)
  assert.match(markError({ score: '10', maxScore: 50, schoolScore: '120' }), /School score/)
  assert.equal(percent({ score: 7, maxScore: 8 }), 88)
})

test('upcoming tests and ratings', () => {
  const tests = [{ id: 1, date: '2026-10-30' }, { id: 2, date: '2026-11-05' }, { id: 3, date: '2026-11-01', time: '10:00' }]
  assert.deepEqual(upcoming(tests, '2026-10-31').map((item) => item.id), [3, 2])
  assert.deepEqual(ratingSummary([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { count: 3, average: 4.3 })
  assert.deepEqual(ratingSummary([]), { count: 0, average: null })
})

test('teachers follow the institute hierarchy', () => {
  assert.deepEqual(faculty.slice(0, TEACHER_HIERARCHY.length).map((member) => member[0]), TEACHER_HIERARCHY)
  assert.equal(new Set(everyTeacher.map((member) => member[0])).size, everyTeacher.length)
  assert.equal(everyTeacher[0][0], 'Satish Vishwakarma')
  assert.deepEqual(everyTeacher.slice(-2).map((member) => member[0]), ['Deepak Tripathi', 'Ashish Jha'])
  assert.equal(faculty.length, 8)
  assert.equal(faculty[7][0], 'Akshara Agarwal', 'Akshara Agarwal takes the eighth home-page card')
})

test('IGCSE Mathematics comes first and includes 0607 and 0606', () => {
  assert.equal(PROGRAMMES[0].id, 'igcse')
  for (const id of ['igcse-0607-ext', 'igcse-0607-core', 'igcse-0606', 'igcse-math-ext']) assert.ok(COURSES.some((course) => course.id === id), id)
})
