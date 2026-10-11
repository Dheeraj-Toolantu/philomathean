// Course catalogue for the student portal: programme → subject family → course → topic → quiz.
// Every format (topic quiz, revision ladder, mock, prediction, custom) is assembled from question banks.
// Functions take a `banks` map ({ bankId: [question] }): the admin-managed banks from Firestore merged over
// the built-in ones (questionBank.js), see questions.js. Options are shuffled per attempt.
import { BANKS } from './questionBank.js'

export const PROGRAMMES = [
  { id: 'ib', label: 'IB', title: 'International Baccalaureate', pastPapers: 'IBDP' },
  { id: 'igcse', label: 'IGCSE', title: 'Cambridge IGCSE', pastPapers: 'IGCSE' },
  { id: 'alevel', label: 'A Level', title: 'Cambridge AS & A Level', pastPapers: 'AS & A Level' },
]

// `icon` names a lucide-react icon resolved in the UI; `tone` picks the badge colour.
export const FAMILIES = [
  { id: 'ib-math', programme: 'ib', title: 'IB Mathematics', icon: 'Sigma', tone: 'blue', subjects: ['ib-math-aa', 'ib-math-ai'] },
  { id: 'ib-sciences', programme: 'ib', title: 'IB Sciences', icon: 'FlaskConical', tone: 'navy', subjects: ['ib-physics', 'ib-chemistry'] },
  { id: 'ib-societies', programme: 'ib', title: 'IB Individuals & Societies', icon: 'Users', tone: 'red', subjects: ['ib-economics'] },
  { id: 'igcse-math', programme: 'igcse', title: 'IGCSE Mathematics', icon: 'Sigma', tone: 'blue', subjects: ['igcse-math'] },
  { id: 'igcse-sciences', programme: 'igcse', title: 'IGCSE Sciences', icon: 'FlaskConical', tone: 'navy', subjects: ['igcse-physics', 'igcse-chemistry'], badge: 'New' },
  { id: 'alevel-math', programme: 'alevel', title: 'A Level Mathematics', icon: 'Sigma', tone: 'blue', subjects: ['alevel-math'], badge: 'Beta' },
]

const topic = (id, number, title, quizzes) => ({ id, number, title, quizzes: quizzes.map(([bank, quizTitle]) => ({ bank, title: quizTitle })) })
const NUMBER_ALGEBRA = topic('number-algebra', 1, 'Number & Algebra', [['sequences', 'Sequences & Series'], ['exponents-logs', 'Exponents & Logs'], ['binomial', 'The Binomial Theorem']])
const FUNCTIONS = topic('functions', 2, 'Functions', [['quadratics', 'Quadratics'], ['transformations', 'Transformations'], ['exp-log-functions', 'Exponential & Logarithmic Functions']])
const CALCULUS = topic('calculus', 5, 'Calculus', [['differentiation', 'Differentiation'], ['integration', 'Integration']])
const STATS = topic('statistics-probability', 4, 'Statistics & Probability', [['statistics', 'Descriptive Statistics'], ['probability', 'Probability']])

export const SUBJECTS = [
  { id: 'ib-math-aa', family: 'ib-math', title: 'IB Math AA', longTitle: 'IB Mathematics Analysis & Approaches', icon: 'Sigma' },
  { id: 'ib-math-ai', family: 'ib-math', title: 'IB Math AI', longTitle: 'IB Mathematics Applications & Interpretation', icon: 'ChartLine' },
  { id: 'ib-physics', family: 'ib-sciences', title: 'IB Physics', longTitle: 'IB Physics', icon: 'Atom' },
  { id: 'ib-chemistry', family: 'ib-sciences', title: 'IB Chemistry', longTitle: 'IB Chemistry', icon: 'FlaskConical' },
  { id: 'ib-economics', family: 'ib-societies', title: 'IB Economics', longTitle: 'IB Economics', icon: 'TrendingUp' },
  { id: 'igcse-math', family: 'igcse-math', title: 'IGCSE Mathematics', longTitle: 'Cambridge IGCSE Mathematics (0580)', icon: 'Sigma' },
  { id: 'igcse-physics', family: 'igcse-sciences', title: 'IGCSE Physics', longTitle: 'Cambridge IGCSE Physics (0625)', icon: 'Atom' },
  { id: 'igcse-chemistry', family: 'igcse-sciences', title: 'IGCSE Chemistry', longTitle: 'Cambridge IGCSE Chemistry (0620)', icon: 'FlaskConical' },
  { id: 'alevel-math', family: 'alevel-math', title: 'A Level Mathematics', longTitle: 'Cambridge AS & A Level Mathematics (9709)', icon: 'Sigma' },
]

// `tier: 'premium'` courses need the Gold plan beyond the free preview quiz.
export const COURSES = [
  { id: 'ib-math-aa-sl', subject: 'ib-math-aa', level: 'SL', tier: 'free', session: 'November 2026', topics: [NUMBER_ALGEBRA, FUNCTIONS, CALCULUS] },
  { id: 'ib-math-aa-hl', subject: 'ib-math-aa', level: 'HL', tier: 'premium', session: 'November 2026', topics: [{ ...NUMBER_ALGEBRA, quizzes: [...NUMBER_ALGEBRA.quizzes, { bank: 'complex', title: 'Complex Numbers' }, { bank: 'induction', title: 'Proof by Induction' }] }, FUNCTIONS, CALCULUS] },
  { id: 'ib-math-ai-sl', subject: 'ib-math-ai', level: 'SL', tier: 'free', session: 'November 2026', topics: [topic('number-algebra', 1, 'Number & Algebra', [['financial', 'Financial & Growth Models']]), STATS] },
  { id: 'ib-math-ai-hl', subject: 'ib-math-ai', level: 'HL', tier: 'premium', session: 'November 2026', topics: [topic('number-algebra', 1, 'Number & Algebra', [['financial', 'Financial & Growth Models'], ['complex', 'Complex Numbers']]), STATS, CALCULUS] },
  { id: 'ib-physics-sl', subject: 'ib-physics', level: 'SL', tier: 'premium', session: 'November 2026', topics: [topic('mechanics', 1, 'Space, Time & Motion', [['kinematics', 'Kinematics'], ['forces', 'Forces & Momentum']]), topic('waves', 3, 'Wave Behaviour', [['waves', 'Waves & Optics']])] },
  { id: 'ib-chemistry-sl', subject: 'ib-chemistry', level: 'SL', tier: 'premium', session: 'November 2026', topics: [topic('structure', 1, 'Models of the Particulate Nature of Matter', [['atomic', 'Atomic Structure']]), topic('stoichiometry', 2, 'Reactivity & Quantities', [['stoichiometry', 'The Mole & Stoichiometry']])] },
  { id: 'ib-economics-sl', subject: 'ib-economics', level: 'SL', tier: 'premium', session: 'November 2026', topics: [topic('micro', 2, 'Microeconomics', [['demand-supply', 'Demand & Supply'], ['elasticity', 'Elasticities']])] },
  { id: 'igcse-math-ext', subject: 'igcse-math', level: 'Extended', tier: 'free', session: 'Oct/Nov 2026', topics: [topic('number', 1, 'Number', [['percentages', 'Percentages']]), topic('algebra', 2, 'Algebra & Graphs', [['linear-equations', 'Linear Equations & Graphs'], ['quadratics', 'Quadratics']]), topic('geometry', 4, 'Geometry', [['angles', 'Angles & Circle Theorems']]), topic('probability', 8, 'Probability', [['probability', 'Probability']])] },
  { id: 'igcse-physics-ext', subject: 'igcse-physics', level: 'Extended', tier: 'premium', session: 'Oct/Nov 2026', topics: [topic('motion', 1, 'Motion, Forces & Energy', [['kinematics', 'Motion'], ['forces', 'Forces']]), topic('electricity', 4, 'Electricity & Magnetism', [['electricity', 'Electrical Quantities & Circuits']]), topic('waves', 3, 'Waves', [['waves', 'Properties of Waves']])] },
  { id: 'igcse-chemistry-ext', subject: 'igcse-chemistry', level: 'Extended', tier: 'premium', session: 'Oct/Nov 2026', topics: [topic('atoms', 2, 'Atoms, Elements & Compounds', [['atomic', 'Atomic Structure']]), topic('stoichiometry', 3, 'Stoichiometry', [['stoichiometry', 'The Mole Concept']])] },
  { id: 'alevel-math-p1', subject: 'alevel-math', level: 'Pure 1 & Stats 1', tier: 'premium', session: 'Oct/Nov 2026', topics: [topic('pure', 1, 'Pure Mathematics 1', [['quadratics', 'Quadratics'], ['sequences', 'Series'], ['differentiation', 'Differentiation'], ['integration', 'Integration']]), topic('stats', 5, 'Probability & Statistics 1', [['statistics', 'Representation of Data'], ['probability', 'Probability']])] },
]

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]))
const SUBJECT_MAP = byId(SUBJECTS)
const FAMILY_MAP = byId(FAMILIES)

// Fill in titles and quiz ids/metadata once, so every screen reads the same shape.
for (const course of COURSES) {
  const subject = SUBJECT_MAP[course.subject]
  course.title = `${subject.title} ${course.level}`
  course.fullTitle = `${subject.longTitle} ${course.level}`
  course.family = subject.family
  course.programme = FAMILY_MAP[subject.family].programme
  course.topics = course.topics.map((item) => ({
    ...item,
    quizzes: item.quizzes.map((quiz) => ({ ...quiz, id: `topic:${item.id}:${quiz.bank}`, kind: 'topic' })),
  }))
}
export const COURSE_MAP = byId(COURSES)
export const getCourse = (id) => COURSE_MAP[id]
export const getSubject = (id) => SUBJECT_MAP[id]
export const getFamily = (id) => FAMILY_MAP[id]
export const coursesForSubject = (subjectId) => COURSES.filter((course) => course.subject === subjectId)
export const courseUrl = (course, hash = '') => `/courses/${course.id}${hash}`

export const LADDER_LEVELS = [
  { difficulty: 1, title: 'Level 1 · Foundations', blurb: 'Core skills every student should master first.' },
  { difficulty: 2, title: 'Level 2 · Exam standard', blurb: 'Typical exam-style questions across the syllabus.' },
  { difficulty: 3, title: 'Level 3 · Challenge', blurb: 'The hardest questions — for top grades.' },
]

// Every bank a course uses, in order (a bank can appear in several courses).
export const courseBankIds = (course) => [...new Set(course.topics.flatMap((item) => item.quizzes.map((quiz) => quiz.bank)))]
export const coursesUsingBank = (bankId) => COURSES.filter((course) => courseBankIds(course).includes(bankId))
const bankQuestions = (banks, bankId, topicId) => (banks[bankId] || []).map((question, index) => ({ ...question, id: question.id || `${bankId}-${index}`, topicId }))
export const topicQuiz = (quiz, banks = BANKS) => { const count = (banks[quiz.bank] || []).length; return { ...quiz, count, minutes: count * 6 } }
export const courseQuestionCount = (course, banks = BANKS) => courseBankIds(course).reduce((sum, bank) => sum + (banks[bank] || []).length, 0)

const courseQuestions = (course, banks, topicIds) => {
  const seen = new Set()
  const list = []
  for (const item of course.topics) {
    if (topicIds && !topicIds.includes(item.id)) continue
    for (const quiz of item.quizzes) {
      if (seen.has(quiz.bank)) continue
      seen.add(quiz.bank)
      list.push(...bankQuestions(banks, quiz.bank, item.id))
    }
  }
  return list
}

// Deterministic shuffle (mulberry32) so a seed reproduces the same paper.
const random = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
export const hashSeed = (text) => [...String(text)].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0
export const shuffle = (list, seed) => { const next = random(seed); const copy = [...list]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(next() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }

// The non-topic practice formats offered on every course page.
export const ladderQuizzes = (course, banks = BANKS) => LADDER_LEVELS.map((level) => {
  const count = courseQuestions(course, banks).filter((question) => question.difficulty === level.difficulty).length
  return { id: `ladder:${level.difficulty}`, kind: 'ladder', title: level.title, blurb: level.blurb, count, minutes: count * 5 }
})
export const mockQuizzes = (course, banks = BANKS) => {
  const total = courseQuestions(course, banks).length
  const half = Math.ceil(total / 2)
  return [
    { id: 'mock:1', kind: 'mock', title: 'Mock Exam · Paper 1', blurb: 'Half the syllabus, timed like the real exam.', count: half, minutes: half * 4 },
    { id: 'mock:2', kind: 'mock', title: 'Mock Exam · Paper 2', blurb: 'The other half — sit it after Paper 1.', count: total - half, minutes: (total - half) * 4 },
  ]
}
// Teachers can hand-pick prediction questions in the admin panel; otherwise the exam draws up to 20
// exam-standard and challenge questions from the whole course.
const predictionPool = (course, banks) => {
  const all = courseQuestions(course, banks)
  const picked = all.filter((question) => question.prediction)
  return picked.length ? shuffle(picked, hashSeed(`${course.id}-prediction`)).slice(0, 40)
    : shuffle(all.filter((question) => question.difficulty >= 2), hashSeed(`${course.id}-prediction`)).slice(0, 20)
}
export const predictionQuiz = (course, banks = BANKS) => {
  const count = predictionPool(course, banks).length
  return { id: 'prediction:1', kind: 'prediction', title: `${course.session} Prediction Exam`, blurb: 'Our teachers’ pick of likely exam-standard questions.', count, minutes: count * 5, gold: true }
}
export const isExamKind = (kind) => kind === 'mock' || kind === 'prediction' || kind === 'custom'

export const findQuizMeta = (course, quizId, banks = BANKS) => {
  const topic = course.topics.flatMap((item) => item.quizzes).find((quiz) => quiz.id === quizId)
  return topic ? topicQuiz(topic, banks) : [...ladderQuizzes(course, banks), ...mockQuizzes(course, banks), predictionQuiz(course, banks)].find((quiz) => quiz.id === quizId)
}

// The quizzes a free student may open in a premium course: the first topic quiz, as a preview.
export const previewQuizId = (course) => course.topics[0].quizzes[0].id

// Builds the questions for a quiz id. Custom papers ("Build my Exam") encode their choices in the id:
// custom:<topicIds joined by '+'>:<question count>:<seed>.
export const buildQuiz = (course, quizId, attemptSeed = Date.now(), banks = BANKS) => {
  const [kind, a, b, c] = quizId.split(':')
  let meta = findQuizMeta(course, quizId, banks)
  let questions = []
  if (kind === 'topic') questions = bankQuestions(banks, b, a)
  else if (kind === 'ladder') questions = courseQuestions(course, banks).filter((question) => question.difficulty === Number(a))
  else if (kind === 'mock') {
    const all = shuffle(courseQuestions(course, banks), hashSeed(`${course.id}-mock`))
    const half = Math.ceil(all.length / 2)
    questions = a === '1' ? all.slice(0, half) : all.slice(half)
  } else if (kind === 'prediction') questions = predictionPool(course, banks)
  else if (kind === 'custom') {
    const topicIds = String(a || '').split('+')
    questions = shuffle(courseQuestions(course, banks, topicIds), Number(c) || 1).slice(0, Number(b) || 10)
    meta = { id: quizId, kind: 'custom', title: 'Custom exam', count: questions.length, minutes: questions.length * 4 }
  }
  if (!meta || !questions.length) return null
  // Shuffle each question's options; keep track of where the correct one lands.
  const prepared = questions.map((question, index) => {
    const order = shuffle(question.options.map((_, optionIndex) => optionIndex), hashSeed(`${attemptSeed}-${question.id}-${index}`))
    return { ...question, options: order.map((optionIndex) => question.options[optionIndex]), answer: order.indexOf(question.answer) }
  })
  return { ...meta, questions: prepared, count: prepared.length }
}
