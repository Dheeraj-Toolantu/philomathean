// Turns a student's attempt history into dashboard numbers. Pure functions: no Firebase, easy to test.
import { COURSE_MAP, isExamKind } from './catalog.js'

const dayKey = (date) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const pct = (part, whole) => whole ? Math.round(part / whole * 100) : 0

// Consecutive days with at least one attempt, counting back from today (or yesterday, so a streak
// is not lost before the student has practised today).
export const studyStreak = (attempts, now = new Date()) => {
  const days = new Set(attempts.map((attempt) => dayKey(attempt.createdAt)))
  const cursor = new Date(now)
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) }
  return streak
}

export const dailyActivity = (attempts, days = 14, now = new Date()) => {
  const totals = new Map()
  attempts.forEach((attempt) => { const key = dayKey(attempt.createdAt); totals.set(key, (totals.get(key) || 0) + (attempt.answered || 0)) })
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now); date.setDate(date.getDate() - (days - 1 - index))
    return { date, key: dayKey(date), questions: totals.get(dayKey(date)) || 0 }
  })
}

// Per-course progress = share of the course's topic quizzes completed at least once.
export const courseProgress = (course, attempts) => {
  const quizIds = course.topics.flatMap((item) => item.quizzes.map((quiz) => quiz.id))
  const mine = attempts.filter((attempt) => attempt.courseId === course.id)
  const done = new Set(mine.filter((attempt) => attempt.kind === 'topic').map((attempt) => attempt.quizId))
  const best = {}
  mine.forEach((attempt) => { best[attempt.quizId] = Math.max(best[attempt.quizId] ?? 0, attempt.scorePct || 0) })
  const answered = mine.reduce((sum, attempt) => sum + (attempt.answered || 0), 0)
  const correct = mine.reduce((sum, attempt) => sum + (attempt.correct || 0), 0)
  const topics = course.topics.map((item) => {
    const scores = item.quizzes.map((quiz) => best[quiz.id]).filter((score) => score != null)
    return { id: item.id, number: item.number, title: item.title, completed: scores.length, total: item.quizzes.length, mastery: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / item.quizzes.length) : 0 }
  })
  return {
    courseId: course.id,
    completed: quizIds.filter((id) => done.has(id)).length,
    total: quizIds.length,
    progress: pct(quizIds.filter((id) => done.has(id)).length, quizIds.length),
    accuracy: pct(correct, answered),
    answered,
    attempts: mine.length,
    best,
    topics,
    lastActivity: mine[0]?.createdAt || null,
  }
}

export const ACHIEVEMENTS = [
  { id: 'first-steps', title: 'First steps', text: 'Finish your first quiz', test: (s) => s.attempts >= 1 },
  { id: 'fifty', title: 'Half century', text: 'Answer 50 questions', test: (s) => s.answered >= 50 },
  { id: 'two-hundred', title: 'Question machine', text: 'Answer 200 questions', test: (s) => s.answered >= 200 },
  { id: 'perfect', title: 'Perfect score', text: 'Score 100% on any quiz', test: (s) => s.perfect >= 1 },
  { id: 'exam-ready', title: 'Exam ready', text: 'Complete a mock or prediction exam', test: (s) => s.exams >= 1 },
  { id: 'streak-3', title: 'On a roll', text: 'Practise 3 days in a row', test: (s) => s.streak >= 3 },
  { id: 'streak-7', title: 'Week warrior', text: 'Practise 7 days in a row', test: (s) => s.streak >= 7 },
  { id: 'sharp', title: 'Sharp shooter', text: '80%+ accuracy over 30 questions', test: (s) => s.answered >= 30 && s.accuracy >= 80 },
]

export const summarise = (attempts, enrollments = [], now = new Date()) => {
  const answered = attempts.reduce((sum, attempt) => sum + (attempt.answered || 0), 0)
  const correct = attempts.reduce((sum, attempt) => sum + (attempt.correct || 0), 0)
  const exams = attempts.filter((attempt) => isExamKind(attempt.kind))
  const enrolledIds = enrollments.map((item) => item.courseId || item.id)
  // A course appears on the dashboard when enrolled in, or practised without enrolling.
  const courseIds = [...new Set([...enrolledIds, ...attempts.map((attempt) => attempt.courseId)])].filter((id) => COURSE_MAP[id])
  const stats = {
    attempts: attempts.length,
    answered,
    correct,
    accuracy: pct(correct, answered),
    exams: exams.length,
    examAverage: exams.length ? Math.round(exams.reduce((sum, attempt) => sum + (attempt.scorePct || 0), 0) / exams.length) : 0,
    perfect: attempts.filter((attempt) => attempt.scorePct === 100).length,
    streak: studyStreak(attempts, now),
    minutes: Math.round(attempts.reduce((sum, attempt) => sum + (attempt.durationSec || 0), 0) / 60),
  }
  return {
    ...stats,
    daily: dailyActivity(attempts, 14, now),
    courses: courseIds.map((id) => ({ ...courseProgress(COURSE_MAP[id], attempts), enrolled: enrolledIds.includes(id) })),
    achievements: ACHIEVEMENTS.map((item) => ({ id: item.id, title: item.title, text: item.text, earned: item.test(stats) })),
  }
}

// The subset that goes into a public share: no email, phone or per-question detail.
export const shareSnapshot = (profile, summary) => ({
  displayName: profile.displayName || 'Student',
  photoURL: profile.photoURL || '',
  curriculum: profile.curriculum || '',
  grade: profile.grade || '',
  plan: profile.plan === 'gold' ? 'gold' : 'free',
  stats: { answered: summary.answered, accuracy: summary.accuracy, exams: summary.exams, examAverage: summary.examAverage, streak: summary.streak, minutes: summary.minutes },
  courses: summary.courses.map((item) => ({ courseId: item.courseId, title: COURSE_MAP[item.courseId].title, progress: item.progress, accuracy: item.accuracy })),
  achievements: summary.achievements.filter((item) => item.earned).map((item) => item.title),
})
