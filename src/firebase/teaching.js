// Teachers, test marks, the test schedule, teaching material and teacher ratings.
// Data model (enforced by firestore.rules):
//   teachers/{uid}                        teacher accounts, set up by an administrator (any signed-in user can read names)
//   testMarks/{id}                        one student's marks in one test; teachers and administrators write, the student reads their own
//   testSchedule/{id}                     upcoming tests; teachers and administrators write, signed-in users read
//   teachingMaterials/{id}                material for teachers to follow; administrators write, teachers read
//   teacherRatings/{studentUid_teacherUid} a student's 1–5 rating of a teacher; the student writes, the teacher and administrators read
//   teacherRequests/{uid}                 a teacher's request for portal access (from sign-up at /login); an administrator approves it
//   leaderboards/{weekStart}              the week's top 10 by average test %; written by staff when marks change, signed-in users read
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './config'
import { leaderboardDoc, weekOf } from '../teacher/marks'

const rows = (snapshot) => snapshot.docs.map((item) => {
  const data = item.data()
  return { id: item.id, ...data, createdAtMs: data.createdAt?.toMillis?.() || 0 }
})
const clean = (value, max) => String(value ?? '').trim().slice(0, max)
const numberOrNull = (value) => value === '' || value === null || value === undefined ? null : Number(value)
const blank = (value) => value === '' || value === null || value === undefined

// ---------- Staff access ----------
// Resolves to { user, teacher, admin } for whoever is signed in: teacher is their teachers/{uid} record (or null).
export const subscribeStaff = (onChange) => {
  let stopTeacher = null
  const stopAuth = onAuthStateChanged(auth, async (user) => {
    stopTeacher?.(); stopTeacher = null
    if (!user) return onChange({ status: 'signed-out', user: null, teacher: null, admin: false })
    const admin = (await user.getIdTokenResult().catch(() => null))?.claims?.admin === true
    // Student accounts (those with a student profile) never get the teacher portal or a teacher request form.
    const student = !admin && (await getDoc(doc(db, 'students', user.uid)).catch(() => null))?.exists() === true
    if (auth.currentUser?.uid !== user.uid) return
    stopTeacher = onSnapshot(doc(db, 'teachers', user.uid),
      (snapshot) => onChange({ status: 'ready', user, admin, student, teacher: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null }),
      () => onChange({ status: 'ready', user, admin, student, teacher: null }))
  })
  return () => { stopTeacher?.(); stopAuth() }
}

// ---------- Teachers ----------
export const listTeachers = async () => rows(await getDocs(query(collection(db, 'teachers'), orderBy('order'))))
export const saveTeacher = (uid, values) => setDoc(doc(db, 'teachers', uid), {
  uid, name: clean(values.name, 80), email: clean(values.email, 120), subjects: clean(values.subjects, 120), order: Number(values.order) || 99, updatedAt: serverTimestamp(),
}, { merge: true })
export const removeTeacher = (uid) => deleteDoc(doc(db, 'teachers', uid))

// ---------- Test marks ----------
// Saves one test for many students at once. `entries` = [{ studentUid, studentName, score, schoolScore, note, remedial, remedialDone }];
// blank scores are skipped. `test.passMark` is optional; the teacher ticks who goes to remedial (it is never automatic).
// `previousDate` is the test's date before editing, so a test moved to another week updates both leaderboards.
export const saveTestMarks = async (test, entries, teacher, previousDate = null) => {
  const testId = test.testId || doc(collection(db, 'testMarks')).id
  const batch = writeBatch(db)
  for (const entry of entries) {
    if (blank(entry.score)) continue
    const ref = entry.id ? doc(db, 'testMarks', entry.id) : doc(collection(db, 'testMarks'))
    const remedial = Boolean(entry.remedial)
    const data = {
      testId, studentUid: entry.studentUid, studentName: clean(entry.studentName, 80), subject: clean(test.subject, 60), testTitle: clean(test.testTitle, 120),
      testDate: clean(test.testDate, 10), score: Number(entry.score), maxScore: Number(test.maxScore), schoolScore: numberOrNull(entry.schoolScore),
      passMark: numberOrNull(test.passMark), note: clean(entry.note, 500),
      remedial, remedialWork: remedial ? clean(test.remedialWork, 300) : '', remedialDone: remedial && Boolean(entry.remedialDone),
      teacherUid: teacher.uid, teacherName: clean(teacher.name, 80), updatedAt: serverTimestamp(),
    }
    if (entry.id) batch.update(ref, data)
    else batch.set(ref, { ...data, createdAt: serverTimestamp() })
  }
  await batch.commit()
  await refreshLeaderboards([test.testDate, previousDate])
  return testId
}
export const deleteTestMark = (id) => deleteDoc(doc(db, 'testMarks', id))
// Deletes every mark of one test, then updates that week's leaderboard.
export const deleteTest = async (marks) => {
  await Promise.all(marks.map((mark) => deleteTestMark(mark.id)))
  await refreshLeaderboards(marks.map((mark) => mark.testDate))
}
// The teacher records that a student finished their remedial worksheet (or undoes it).
export const setRemedialDone = (mark, done, teacher) => updateDoc(doc(db, 'testMarks', mark.id), {
  remedialDone: Boolean(done), teacherUid: teacher.uid, teacherName: clean(teacher.name, 80), updatedAt: serverTimestamp(),
})
export const listAllMarks = async (max = 2000) => rows(await getDocs(query(collection(db, 'testMarks'), orderBy('testDate', 'desc'), limit(max))))
// The signed-in student's own marks (sorted in the browser, so no composite index is needed).
export const subscribeStudentMarks = (uid, onChange) => onSnapshot(query(collection(db, 'testMarks'), where('studentUid', '==', uid)), (snapshot) => onChange(rows(snapshot)), () => onChange([]))

// ---------- Weekly leaderboard ----------
// Students can only read their own marks, so staff publish each week's top 10 whenever marks change.
// A leaderboard failure never undoes saved marks: the next save for that week rebuilds it.
export const refreshLeaderboards = async (dates) => {
  const weeks = [...new Set(dates.filter(Boolean).map((date) => weekOf(date).start))]
  await Promise.all(weeks.map(async (start) => {
    const { end } = weekOf(start)
    const marks = rows(await getDocs(query(collection(db, 'testMarks'), where('testDate', '>=', start), where('testDate', '<=', end))))
    const ref = doc(db, 'leaderboards', start)
    if (!marks.length) return deleteDoc(ref)
    return setDoc(ref, { ...leaderboardDoc(marks, start), updatedAt: serverTimestamp() })
  })).catch((error) => console.error('Leaderboard could not be updated:', error))
}
export const subscribeLeaderboards = (onChange, max = 12) => onSnapshot(query(collection(db, 'leaderboards'), orderBy('weekStart', 'desc'), limit(max)), (snapshot) => onChange(rows(snapshot)), () => onChange([]))

// ---------- Teacher access requests ----------
const requestRef = (uid) => doc(db, 'teacherRequests', uid)
export const requestTeacherAccess = (user, values) => setDoc(requestRef(user.uid), {
  uid: user.uid, email: user.email || '', name: clean(values.name || user.displayName, 80), phone: clean(values.phone, 20), subjects: clean(values.subjects, 120),
  message: clean(values.message, 500), status: 'pending', createdAt: serverTimestamp(),
})
export const getTeacherRequest = async (uid) => { const snapshot = await getDoc(requestRef(uid)).catch(() => null); return snapshot?.exists() ? { id: snapshot.id, ...snapshot.data() } : null }
export const withdrawTeacherRequest = (uid) => deleteDoc(requestRef(uid))
export const listTeacherRequests = async () => rows(await getDocs(collection(db, 'teacherRequests'))).sort((a, b) => b.createdAtMs - a.createdAtMs)
// Approving gives the account teacher access and clears the request.
export const approveTeacherRequest = async (request, order) => {
  await saveTeacher(request.uid, { name: request.name, email: request.email, subjects: request.subjects, order })
  await deleteDoc(requestRef(request.uid))
}
export const declineTeacherRequest = (uid) => updateDoc(requestRef(uid), { status: 'declined' })

// ---------- Test schedule ----------
export const listSchedule = async (max = 300) => rows(await getDocs(query(collection(db, 'testSchedule'), orderBy('date', 'desc'), limit(max))))
export const subscribeUpcomingTests = (fromDate, onChange) => onSnapshot(query(collection(db, 'testSchedule'), where('date', '>=', fromDate), orderBy('date'), limit(20)), (snapshot) => onChange(rows(snapshot)), () => onChange([]))
export const saveScheduledTest = (values, teacher) => {
  const ref = values.id ? doc(db, 'testSchedule', values.id) : doc(collection(db, 'testSchedule'))
  const data = {
    title: clean(values.title, 120), subject: clean(values.subject, 60), batch: clean(values.batch, 80), date: clean(values.date, 10), time: clean(values.time, 5),
    maxScore: Number(values.maxScore) || 100, notes: clean(values.notes, 500), teacherUid: teacher.uid, teacherName: clean(teacher.name, 80), updatedAt: serverTimestamp(),
  }
  return values.id ? updateDoc(ref, data) : setDoc(ref, { ...data, createdAt: serverTimestamp() })
}
export const deleteScheduledTest = (id) => deleteDoc(doc(db, 'testSchedule', id))

// ---------- Teaching material ----------
export const listMaterials = async () => rows(await getDocs(query(collection(db, 'teachingMaterials'), orderBy('programme'))))
export const saveMaterial = (values) => {
  const ref = values.id ? doc(db, 'teachingMaterials', values.id) : doc(collection(db, 'teachingMaterials'))
  const data = { title: clean(values.title, 120), programme: clean(values.programme, 60), grade: clean(values.grade, 40), description: clean(values.description, 1000), url: clean(values.url, 1000), updatedAt: serverTimestamp() }
  return values.id ? updateDoc(ref, data) : setDoc(ref, { ...data, createdAt: serverTimestamp() })
}
export const deleteMaterial = (id) => deleteDoc(doc(db, 'teachingMaterials', id))

// ---------- Teacher ratings ----------
const ratingId = (studentUid, teacherUid) => `${studentUid}_${teacherUid}`
export const rateTeacher = (studentUid, teacher, rating, comment = '') => setDoc(doc(db, 'teacherRatings', ratingId(studentUid, teacher.id)), {
  studentUid, teacherUid: teacher.id, teacherName: clean(teacher.name, 80), rating: Math.round(Number(rating)), comment: clean(comment, 500), updatedAt: serverTimestamp(),
})
export const subscribeMyRatings = (studentUid, onChange) => onSnapshot(query(collection(db, 'teacherRatings'), where('studentUid', '==', studentUid)), (snapshot) => onChange(rows(snapshot)), () => onChange([]))
export const listRatingsForTeacher = async (teacherUid) => rows(await getDocs(query(collection(db, 'teacherRatings'), where('teacherUid', '==', teacherUid))))
export const listAllRatings = async () => rows(await getDocs(collection(db, 'teacherRatings')))
