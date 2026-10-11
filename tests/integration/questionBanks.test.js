import test from 'node:test'
import assert from 'node:assert/strict'
import { BANKS } from '../../src/student/questionBank.js'
import { buildQuiz, courseQuestionCount, getCourse, ladderQuizzes, predictionQuiz, topicQuiz } from '../../src/student/catalog.js'
import { blankQuestion, builtInQuestions, cleanQuestion, mergeBanks, parseCsv, questionsFromCsv, validateQuestion } from '../../src/student/questionTools.js'

const q = (over = {}) => cleanQuestion({ prompt: 'What is 2 + 2?', options: ['4', '3', '5', '22'], answer: 0, explain: 'Add.', difficulty: 1, ...over })

test('validation catches missing text, duplicate or empty options and a bad answer', () => {
  assert.deepEqual(validateQuestion(q()), {})
  assert.ok(validateQuestion(blankQuestion()).prompt)
  assert.ok(validateQuestion(q({ options: ['4', '4', '5', '6'] })).options)
  assert.ok(validateQuestion(q({ options: ['4', '', '5', '6'] })).options)
  assert.ok(validateQuestion(q({ options: ['4'] })).options)
  assert.ok(validateQuestion(q({ answer: 7 })).answer)
  assert.ok(validateQuestion(q({ difficulty: 9 })).difficulty)
  assert.deepEqual(validateQuestion(q({ options: ['True', 'False'], answer: 1 })), {}, 'two-option questions are allowed')
})

test('CSV parser handles quotes, commas and newlines inside fields', () => {
  const rows = parseCsv('a,b\r\n"x, y","line1\nline2 ""quoted"""\n')
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'line1\nline2 "quoted"']])
})

test('CSV import turns rows into questions and reports bad rows', () => {
  const csv = 'question,option_a,option_b,option_c,option_d,correct,explanation,difficulty\n'
    + '"Solve 2x = 8",4,2,8,16,A,"Divide by 2",1\n'
    + '"Missing answer",1,2,3,4,,,2\n'
    + '"Pick e",a,b,c,d,C,,3\n'
  const { questions, errors } = questionsFromCsv(csv)
  assert.equal(questions.length, 2)
  assert.equal(questions[0].options[questions[0].answer], '4')
  assert.equal(questions[1].difficulty, 3)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /^Row 3:/)
  assert.ok(questionsFromCsv('just,some,text\n1,2,3').errors[0].includes('header'))
})

test('managed banks replace built-in ones and hide hidden questions from students', () => {
  const merged = mergeBanks({ sequences: { questions: [q(), q({ prompt: 'Draft', hidden: true })] } })
  assert.equal(merged.sequences.length, 1)
  assert.equal(merged.quadratics, BANKS.quadratics, 'untouched banks stay built-in')
  assert.equal(builtInQuestions('sequences').length, BANKS.sequences.length)
  assert.ok(builtInQuestions('sequences').every((question) => question.id.startsWith('sequences-')))
})

test('every format reads from the managed banks', () => {
  const course = getCourse('ib-math-aa-sl')
  const extra = Array.from({ length: 3 }, (_, i) => q({ id: `new${i}`, prompt: `New question ${i}`, difficulty: 3 }))
  const banks = mergeBanks({ sequences: { questions: [...builtInQuestions('sequences'), ...extra] } })
  const quiz = course.topics[0].quizzes[0]
  assert.equal(topicQuiz(quiz, banks).count, BANKS.sequences.length + 3)
  assert.equal(courseQuestionCount(course, banks), courseQuestionCount(course) + 3)
  assert.equal(buildQuiz(course, quiz.id, 1, banks).questions.length, BANKS.sequences.length + 3)
  const level3 = ladderQuizzes(course, banks).find((item) => item.id === 'ladder:3')
  assert.equal(level3.count, ladderQuizzes(course).find((item) => item.id === 'ladder:3').count + 3)
})

test('prediction exam uses hand-picked questions when a teacher picks any', () => {
  const course = getCourse('ib-math-aa-sl')
  const picks = [q({ id: 'p1', prompt: 'Pick one', prediction: true }), q({ id: 'p2', prompt: 'Pick two', prediction: true })]
  const banks = mergeBanks({ sequences: { questions: picks } })
  assert.equal(predictionQuiz(course, banks).count, 2)
  const built = buildQuiz(course, 'prediction:1', 1, banks)
  assert.deepEqual(built.questions.map((question) => question.id).sort(), ['p1', 'p2'])
})

test('an emptied bank shows zero questions and cannot be opened', () => {
  const course = getCourse('ib-math-aa-sl')
  const banks = mergeBanks({ sequences: { questions: [] } })
  const quiz = course.topics[0].quizzes[0]
  assert.equal(topicQuiz(quiz, banks).count, 0)
  assert.equal(buildQuiz(course, quiz.id, 1, banks), null)
})
