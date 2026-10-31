// Teachers, test marks, the test schedule, teaching material and teacher ratings.
// Data model (enforced by firestore.rules):
//   teachers/{uid}                        teacher accounts, set up by an administrator (any signed-in user can read names)
//   testMarks/{id}                        one student's marks in one test; teachers and administrators write, the student reads their own
//   testSchedule/{id}                     upcoming tests; teachers and administrators write, signed-in users read
//   teachingMaterials/{id}                material for teachers to follow; administrators write, teachers read
//   teacherRatings/{studentUid_teacherUid} a student's 1–5 rating of a teacher; the student writes, the teacher and administrators read
import {
  collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './config'

const rows = (snapshot) => snapshot.docs.map((item) => {
  const data = item.data()
  return { id: item.id, ...data, createdAtMs: data.createdAt?.toMillis?.() || 0 }
})
const clean = (value, max) => String(value ?? '').trim().slice(0, max)
const numberOrNull = (value) => value === '' || value === null || value === undefined ? null : Number(value)

// ---------- Staff access ----------
// Resolves to { user, teacher, admin } for whoever is signed in: teacher is their teachers/{uid} record (or null).
export const subscribeStaff = (onChange) => {
  let stopTeacher = null
  const stopAuth = onAuthStateChanged(auth, async (user) => {
    stopTeacher?.(); stopTeacher = null
    if (!user) return onChange({ status: 'signed-out', user: null, teacher: null, admin: false })
    const admin = (await user.getIdTokenResult().catch(() => null))?.claims?.admin === true
    stopTeacher = onSnapshot(doc(db, 'teachers', user.uid),
      (snapshot) => onChange({ status: 'ready', user, admin, teacher: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null }),
      () => onChange({ status: 'ready', user, admin, teacher: null }))
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
// Saves one test for many students at once. `entries` = [{ studentUid, studentName, score, schoolScore }]; blank scores are skipped.
export const saveTestMarks = async (test, entries, teacher) => {
  const testId = test.testId || doc(collection(db, 'testMarks')).id
  const batch = writeBatch(db)
  for (const entry of entries) {
    if (entry.score === '' || entry.score === null || entry.score === undefined) continue
    const ref = entry.id ? doc(db, 'testMarks', entry.id) : doc(collection(db, 'testMarks'))
    const data = {
      testId, studentUid: entry.studentUid, studentName: clean(entry.studentName, 80), subject: clean(test.subject, 60), testTitle: clean(test.testTitle, 120),
      testDate: clean(test.testDate, 10), score: Number(entry.score), maxScore: Number(test.maxScore), schoolScore: numberOrNull(entry.schoolScore),
      note: clean(entry.note, 300), teacherUid: teacher.uid, teacherName: clean(teacher.name, 80), updatedAt: serverTimestamp(),
    }
    if (entry.id) batch.update(ref, data)
    else batch.set(ref, { ...data, createdAt: serverTimestamp() })
  }
  await batch.commit()
  return testId
}
export const deleteTestMark = (id) => deleteDoc(doc(db, 'testMarks', id))
export const listAllMarks = async (max = 2000) => rows(await getDocs(query(collection(db, 'testMarks'), orderBy('testDate', 'desc'), limit(max))))
// The signed-in student's own marks (sorted in the browser, so no composite index is needed).
export const subscribeStudentMarks = (uid, onChange) => onSnapshot(query(collection(db, 'testMarks'), where('studentUid', '==', uid)), (snapshot) => onChange(rows(snapshot)), () => onChange([]))

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
