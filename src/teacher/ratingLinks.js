import { everyTeacher } from '../components/site/faculty.js'

// Shareable teacher-rating links. The administrator sends /rate/{teacherUid} over WhatsApp; whoever opens it
// logs in with their student account and rates that teacher (one rating per student, which they can change).
export const ratingPath = (teacherUid) => `/rate/${encodeURIComponent(teacherUid)}`
export const ratingUrl = (teacherUid, origin = window.location.origin) => `${origin}${ratingPath(teacherUid)}`
export const ratingShareText = (teacher, origin) => `Please rate ${teacher.name || 'your teacher'}${teacher.subjects ? ` (${teacher.subjects})` : ''} at Philomathean. Log in with your student account and tap the stars — it takes 10 seconds:\n${ratingUrl(teacher.id, origin)}`
export const whatsappShareUrl = (teacher, origin) => `https://wa.me/?text=${encodeURIComponent(ratingShareText(teacher, origin))}`

// The public faculty entry (photo, role, description) for a teacher account, matched by name.
const simplify = (name) => String(name || '').toLowerCase().replace(/[^a-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean)
export const facultyEntryFor = (name) => {
  const words = simplify(name)
  if (!words.length) return null
  const exact = everyTeacher.find((member) => simplify(member[0]).join(' ') === words.join(' '))
  if (exact) return exact
  // "Pawan" or "Pawan Sir" still finds "Pawan Yadav" when only one teacher has that first name.
  const sameFirst = everyTeacher.filter((member) => simplify(member[0])[0] === words[0])
  return sameFirst.length === 1 ? sameFirst[0] : null
}
