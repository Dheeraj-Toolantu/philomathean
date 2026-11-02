// Which portal an account belongs to. Teacher and student portals are kept apart: a teacher account (approved, or
// waiting for approval) never opens student pages, and a student account never opens the teacher portal.
// Administrators count as staff; they use /admin and the teacher portal, not the student pages.
// The same split is enforced on the data in firestore.rules — this module only decides what the browser shows.

export const STUDENT_PATHS = ['/dashboard', '/courses', '/quiz']
export const TEACHER_PATHS = ['/teacher']

const under = (path, roots) => roots.some((root) => path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}?`))
export const isStudentPath = (path = '') => under(path, STUDENT_PATHS)
export const isTeacherPath = (path = '') => under(path, TEACHER_PATHS)

// 'admin' | 'teacher' | 'student'
export const accountRole = ({ admin = false, teacher = false, teacherRequest = false } = {}) => {
  if (admin) return 'admin'
  if (teacher || teacherRequest) return 'teacher'
  return 'student'
}
export const isStaffRole = (role) => role === 'admin' || role === 'teacher'
export const homeFor = (role) => isStaffRole(role) ? '/teacher' : '/dashboard'

// Where to send an account after it signs in. A requested page is kept only when it belongs to that account's portal.
export const destinationFor = (role, next) => {
  if (!next) return homeFor(role)
  if (isStaffRole(role) && isStudentPath(next)) return homeFor(role)
  if (!isStaffRole(role) && isTeacherPath(next)) return homeFor(role)
  return next
}
