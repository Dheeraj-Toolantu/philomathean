import test from 'node:test'
import assert from 'node:assert/strict'
import { BANKS } from '../../src/student/questionBank.js'
import { buildQuiz, COURSES, FAMILIES, getCourse, ladderQuizzes, mockQuizzes, predictionQuiz, previewQuizId, SUBJECTS } from '../../src/student/catalog.js'
import { canEnroll, canOpenQuiz, hasGold } from '../../src/student/access.js'
import { courseProgress, dailyActivity, shareSnapshot, studyStreak, summarise } from '../../src/student/progress.js'

const gold = { plan: 'gold', planExpiresAt: '2999-01-01T00:00:00.000Z' }
const expired = { plan: 'gold', planExpiresAt: '2000-01-01T00:00:00.000Z' }
const free = { plan: 'free' }

test('every question bank entry is well formed', () => {
  for (const [id, bank] of Object.entries(BANKS)) {
    assert.ok(bank.length >= 5, `${id} has at least five questions`)
    for (const question of bank) {
      assert.equal(question.options.length, 4, `${id}: four options`)
      assert.equal(new Set(question.options).size, 4, `${id}: options are distinct — "${question.prompt}"`)
      assert.ok(question.answer >= 0 && question.answer < 4)
      assert.ok([1, 2, 3].includes(question.difficulty))
      assert.ok(question.explain.length > 3)
    }
  }
})

test('catalog references only known subjects, families and banks', () => {
  const subjects = new Set(SUBJECTS.map((item) => item.id))
  for (const family of FAMILIES) family.subjects.forEach((id) => assert.ok(subjects.has(id), id))
  for (const course of COURSES) {
    assert.ok(course.title && course.fullTitle && course.programme)
    for (const topic of course.topics) for (const quiz of topic.quizzes) assert.ok(BANKS[quiz.bank], `${course.id}: ${quiz.bank}`)
  }
  assert.equal(new Set(COURSES.map((course) => course.id)).size, COURSES.length)
})

test('buildQuiz keeps the right answer attached after shuffling options', () => {
  const course = getCourse('ib-math-aa-sl')
  const quiz = buildQuiz(course, 'topic:number-algebra:sequences', 42)
  assert.equal(quiz.questions.length, BANKS.sequences.length)
  quiz.questions.forEach((question, index) => assert.equal(question.options[question.answer], BANKS.sequences[index].options[BANKS.sequences[index].answer]))
  const positions = new Set(quiz.questions.map((question) => question.answer))
  assert.ok(positions.size > 1, 'correct answers are not all in the same position')
})

test('ladder, mock, prediction and custom quizzes are buildable for every course', () => {
  for (const course of COURSES) {
    const mocks = mockQuizzes(course)
    const mockTotal = mocks.reduce((sum, quiz) => sum + buildQuiz(course, quiz.id, 1).questions.length, 0)
    assert.equal(mockTotal, mocks[0].count + mocks[1].count)
    for (const quiz of ladderQuizzes(course).filter((item) => item.count)) assert.equal(buildQuiz(course, quiz.id, 1).questions.length, quiz.count)
    assert.equal(buildQuiz(course, predictionQuiz(course).id, 1).questions.length, predictionQuiz(course).count)
    const custom = buildQuiz(course, `custom:${course.topics[0].id}:5:99`, 1)
    assert.ok(custom.questions.length > 0 && custom.questions.length <= 5)
    assert.ok(custom.questions.every((question) => question.topicId === course.topics[0].id))
  }
  assert.equal(buildQuiz(getCourse('ib-math-aa-sl'), 'topic:nope:missing'), null)
})

test('access: free courses open, premium needs Gold beyond the preview, prediction is Gold-only', () => {
  const freeCourse = getCourse('ib-math-aa-sl')
  const premium = getCourse('ib-math-aa-hl')
  assert.ok(canOpenQuiz(freeCourse, 'topic:functions:quadratics', free))
  assert.ok(!canOpenQuiz(freeCourse, 'prediction:1', free))
  assert.ok(canOpenQuiz(premium, previewQuizId(premium), free))
  assert.ok(!canOpenQuiz(premium, 'mock:1', free))
  assert.ok(canOpenQuiz(premium, 'mock:1', gold))
  assert.ok(!canOpenQuiz(premium, 'mock:1', expired))
  assert.ok(canEnroll(freeCourse, null) && !canEnroll(premium, free) && canEnroll(premium, gold))
  assert.ok(hasGold(gold) && !hasGold(expired) && !hasGold(free) && !hasGold(null))
})

const at = (iso) => new Date(iso)
const attempts = [
  { courseId: 'ib-math-aa-sl', quizId: 'topic:number-algebra:sequences', kind: 'topic', total: 5, answered: 5, correct: 5, scorePct: 100, durationSec: 300, createdAt: at('2026-10-11T09:00:00') },
  { courseId: 'ib-math-aa-sl', quizId: 'topic:number-algebra:sequences', kind: 'topic', total: 5, answered: 5, correct: 3, scorePct: 60, durationSec: 240, createdAt: at('2026-10-10T09:00:00') },
  { courseId: 'ib-math-aa-sl', quizId: 'mock:1', kind: 'mock', total: 20, answered: 18, correct: 12, scorePct: 60, durationSec: 1800, createdAt: at('2026-10-09T09:00:00') },
  { courseId: 'igcse-math-ext', quizId: 'topic:number:percentages', kind: 'topic', total: 5, answered: 4, correct: 2, scorePct: 40, durationSec: 200, createdAt: at('2026-10-05T09:00:00') },
]
const now = at('2026-10-11T18:00:00')

test('study streak counts consecutive days and survives until the day ends', () => {
  assert.equal(studyStreak(attempts, now), 3)
  assert.equal(studyStreak(attempts, at('2026-10-12T10:00:00')), 3, 'yesterday still counts before practising today')
  assert.equal(studyStreak(attempts, at('2026-10-14T10:00:00')), 0)
})

test('summary totals, course progress and best scores', () => {
  const summary = summarise(attempts, [{ id: 'ib-math-aa-sl', courseId: 'ib-math-aa-sl' }], now)
  assert.equal(summary.answered, 32)
  assert.equal(summary.correct, 22)
  assert.equal(summary.accuracy, 69)
  assert.equal(summary.exams, 1)
  assert.equal(summary.examAverage, 60)
  assert.equal(summary.perfect, 1)
  assert.equal(summary.courses.length, 2)
  const aa = summary.courses.find((item) => item.courseId === 'ib-math-aa-sl')
  assert.equal(aa.enrolled, true)
  assert.equal(aa.completed, 1)
  assert.equal(aa.best['topic:number-algebra:sequences'], 100)
  assert.equal(summary.achievements.find((item) => item.id === 'perfect').earned, true)
  assert.equal(summary.achievements.find((item) => item.id === 'streak-7').earned, false)
  const daily = dailyActivity(attempts, 14, now)
  assert.equal(daily.length, 14)
  assert.equal(daily.at(-1).questions, 5)
  assert.equal(courseProgress(getCourse('ib-math-aa-hl'), attempts).progress, 0)
})

test('share snapshot never includes contact details', () => {
  const snapshot = shareSnapshot({ displayName: 'Asha', email: 'asha@example.com', phone: '+91 99999 99999', parentEmail: 'p@example.com', plan: 'gold' }, summarise(attempts, [], now))
  const text = JSON.stringify(snapshot)
  assert.ok(!text.includes('example.com') && !text.includes('99999'))
  assert.equal(snapshot.stats.answered, 32)
})
