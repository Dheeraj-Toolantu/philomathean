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

test('pass marks flag students, but remedial is only what the teacher ticked', async () => {
  const { belowPass, remedials, remedialStatus, passMarkError, splitWorksheet } = await import('../../src/teacher/marks.js')
  assert.equal(belowPass({ score: 18, passMark: 20 }), true)
  assert.equal(belowPass({ score: 20, passMark: 20 }), false)
  assert.equal(belowPass({ score: 5, passMark: null }), false, 'no pass mark, nobody is flagged')
  assert.equal(remedialStatus({ score: 5, passMark: 20 }), null, 'below the pass mark is not remedial by itself')
  assert.equal(remedialStatus({ remedial: true }), 'pending')
  assert.equal(remedialStatus({ remedial: true, remedialDone: true }), 'done')
  const list = remedials([{ id: 1, remedial: true, testDate: '2026-10-05' }, { id: 2, remedial: true, remedialDone: true, testDate: '2026-10-01' }, { id: 3, testDate: '2026-10-01' }, { id: 4, remedial: true, testDate: '2026-09-01' }])
  assert.deepEqual(list.pending.map((mark) => mark.id), [4, 1])
  assert.deepEqual(list.done.map((mark) => mark.id), [2])
  assert.equal(passMarkError('', 50), null)
  assert.match(passMarkError('60', 50), /between 0 and 50/)
  assert.deepEqual(splitWorksheet('Worksheet B · https://drive.google.com/x'), { label: 'Worksheet B', url: 'https://drive.google.com/x' })
  assert.deepEqual(splitWorksheet('Quadratics sheet'), { label: 'Quadratics sheet', url: '' })
})

test('weekly leaderboard ranks by average % within Monday–Sunday, ties share a rank', async () => {
  const { weekOf, weeklyLeaderboard, leaderboardDoc, shortName } = await import('../../src/teacher/marks.js')
  assert.deepEqual(weekOf('2026-11-04'), { start: '2026-11-02', end: '2026-11-08' })
  assert.deepEqual(weekOf('2026-11-08'), { start: '2026-11-02', end: '2026-11-08' }, 'Sunday belongs to the week that started on Monday')
  assert.equal(shortName('Aarav Kumar Sharma'), 'Aarav S.')
  assert.equal(shortName('Riya'), 'Riya')
  const named = (uid, name, date, score) => ({ ...mark(uid, 'Maths', date, score, 50), studentName: name })
  const marks = [
    named('a', 'Aarav Sharma', '2026-11-02', 40), named('a', 'Aarav Sharma', '2026-11-05', 50), // 90%
    named('b', 'Bela Rao', '2026-11-03', 45), // 90%, one test
    named('c', 'Chirag Jain', '2026-11-04', 45), named('c', 'Chirag Jain', '2026-11-06', 45), // 90%, two tests
    named('d', 'Dev Patel', '2026-11-07', 30), // 60%
    named('e', 'Esha Nair', '2026-10-30', 50), // previous week
  ]
  const rows = weeklyLeaderboard(marks, '2026-11-02')
  assert.deepEqual(rows.map((row) => [row.studentUid, row.rank]), [['a', 1], ['c', 1], ['b', 3], ['d', 4]])
  assert.equal(rows[0].name, 'Aarav S.')
  const board = leaderboardDoc(marks, '2026-11-05')
  assert.equal(board.weekStart, '2026-11-02')
  assert.equal(board.participants, 4)
  assert.equal('fullName' in board.entries[0], false, 'only short names are published to students')
})
