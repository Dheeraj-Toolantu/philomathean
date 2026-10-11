// Who may open what. Free courses are open to everyone signed in; premium courses offer one preview quiz
// and need Gold for the rest; prediction exams are Gold-only everywhere.
// Note: questions are publicly readable (built-in bundle and the questionBanks collection), so this is a
// product gate, not a security boundary.
import { previewQuizId } from './catalog.js'

export const hasGold = (profile) => profile?.plan === 'gold' && (!profile.planExpiresAt || new Date(profile.planExpiresAt) > new Date())

export const canOpenQuiz = (course, quizId, profile) => {
  if (hasGold(profile)) return true
  if (quizId.startsWith('prediction:')) return false
  if (course.tier === 'free') return true
  return quizId === previewQuizId(course)
}
export const canEnroll = (course, profile) => course.tier === 'free' || hasGold(profile)
export const quizUrl = (course, quizId, mode = 'study') => `/quiz?course=${course.id}&quiz=${encodeURIComponent(quizId)}&mode=${mode}`

export const GOLD_FEATURES = [
  'Every premium course: IB HL, Sciences, Economics, IGCSE Sciences, A Level',
  'Prediction exams for the upcoming session',
  '“Build my Exam” custom papers on every course',
  'Full mock exam papers with worked solutions',
]
