// Student accounts: authentication, profile, photo, enrolments, quiz attempts and public progress shares.
// Data model (enforced by firestore.rules / storage.rules):
//   students/{uid}                       profile + plan (plan fields are admin-only)
//   students/{uid}/enrollments/{course}  courses the student follows
//   students/{uid}/attempts/{id}         one document per finished quiz or exam (immutable)
//   progressShares/{shareId}             public, read-only snapshot the student chooses to share
//   student-photos/{uid}/avatar.jpg      profile photo
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from './config'

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const PROFILE_FIELDS = ['displayName', 'phone', 'grade', 'school', 'curriculum', 'targetSession', 'bio', 'parentEmail']

const studentRef = (uid) => doc(db, 'students', uid)

// ---------- Session store: one auth + profile listener shared by every component ----------
let state = { status: 'loading', user: null, profile: null }
const listeners = new Set()
let stopProfile = null
let started = false
const emit = (next) => { state = { ...state, ...next }; listeners.forEach((listener) => listener()) }

const start = () => {
  if (started) return
  started = true
  onAuthStateChanged(auth, (user) => {
    stopProfile?.()
    stopProfile = null
    if (!user) return emit({ status: 'signed-out', user: null, profile: null })
    emit({ status: 'loading', user, profile: null })
    stopProfile = onSnapshot(studentRef(user.uid),
      (snapshot) => emit({ status: 'ready', user, profile: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null }),
      () => emit({ status: 'ready', user, profile: null }))
  })
}
export const subscribeSession = (listener) => { start(); listeners.add(listener); return () => listeners.delete(listener) }
export const getSession = () => state

// ---------- Authentication ----------
const AUTH_ERRORS = {
  'auth/invalid-credential': 'That email and password don’t match an account.',
  'auth/wrong-password': 'That email and password don’t match an account.',
  'auth/user-not-found': 'That email and password don’t match an account.',
  'auth/email-already-in-use': 'An account with this email already exists — log in instead.',
  'auth/weak-password': 'Use a password of at least 8 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.',
  'auth/network-request-failed': 'Network error — check your connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please contact the institute.',
}
export const authErrorMessage = (error) => AUTH_ERRORS[error?.code] || 'Something went wrong. Please try again.'

// Creates the profile document the first time a student signs in. Plan always starts as free.
export const ensureStudentProfile = async (user, extra = {}) => {
  const snapshot = await getDoc(studentRef(user.uid))
  if (snapshot.exists()) return
  await setDoc(studentRef(user.uid), {
    uid: user.uid,
    email: user.email || '',
    displayName: extra.displayName || user.displayName || (user.email || 'Student').split('@')[0],
    photoURL: user.photoURL || '',
    photoPath: '',
    phone: '', grade: extra.grade || '', school: '', curriculum: extra.curriculum || '', targetSession: '', bio: '', parentEmail: '',
    plan: 'free',
    planRequest: null,
    shareId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const signUpStudent = async ({ name, email, password, curriculum, grade }) => {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(user, { displayName: name.trim() })
  await ensureStudentProfile(user, { displayName: name.trim(), curriculum, grade })
  return user
}
export const signInStudent = async (email, password) => {
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password)
  await ensureStudentProfile(user)
  return user
}
export const signInStudentWithGoogle = async () => {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
  await ensureStudentProfile(user)
  return user
}
export const resetStudentPassword = (email) => sendPasswordResetEmail(auth, email.trim())
export const signOutStudent = () => signOut(auth)

// ---------- Profile ----------
export const updateStudentProfile = async (uid, values) => {
  const patch = Object.fromEntries(PROFILE_FIELDS.filter((key) => key in values).map((key) => [key, String(values[key] ?? '').trim()]))
  await updateDoc(studentRef(uid), { ...patch, updatedAt: serverTimestamp() })
  if (patch.displayName && auth.currentUser?.uid === uid) await updateProfile(auth.currentUser, { displayName: patch.displayName })
}

// Square-crops and downsizes the photo in the browser so uploads are small (≈30–60 KB) and load fast.
const resizeImage = (file, size = 360) => new Promise((resolve, reject) => {
  const image = new Image()
  const url = URL.createObjectURL(file)
  image.onload = () => {
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    canvas.getContext('2d').drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('IMAGE_ENCODE_FAILED')), 'image/jpeg', 0.88)
  }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMAGE_READ_FAILED')) }
  image.src = url
})

export const uploadStudentPhoto = async (uid, file) => {
  if (!file || !file.type.startsWith('image/')) throw new Error('PHOTO_TYPE')
  if (file.size > MAX_PHOTO_BYTES) throw new Error('PHOTO_SIZE')
  const blob = await resizeImage(file)
  const path = `student-photos/${uid}/avatar.jpg`
  const photoRef = ref(storage, path)
  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' })
  const photoURL = await getDownloadURL(photoRef)
  await updateDoc(studentRef(uid), { photoURL, photoPath: path, updatedAt: serverTimestamp() })
  if (auth.currentUser?.uid === uid) await updateProfile(auth.currentUser, { photoURL })
  return photoURL
}
export const removeStudentPhoto = async (uid, photoPath) => {
  if (photoPath) await deleteObject(ref(storage, photoPath)).catch(() => {})
  await updateDoc(studentRef(uid), { photoURL: '', photoPath: '', updatedAt: serverTimestamp() })
  if (auth.currentUser?.uid === uid) await updateProfile(auth.currentUser, { photoURL: '' })
}

// ---------- Subscription ----------
// Students can only *request* an upgrade; an administrator activates the plan.
export const requestPlanUpgrade = (uid, plan, note = '') => updateDoc(studentRef(uid), { planRequest: { plan, note: note.trim().slice(0, 500), at: new Date().toISOString() }, updatedAt: serverTimestamp() })
export const cancelPlanRequest = (uid) => updateDoc(studentRef(uid), { planRequest: null, updatedAt: serverTimestamp() })

// ---------- Enrolments ----------
export const subscribeEnrollments = (uid, onChange) => onSnapshot(collection(db, 'students', uid, 'enrollments'), (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => onChange([]))
export const enrollInCourse = (uid, course) => setDoc(doc(db, 'students', uid, 'enrollments', course.id), { courseId: course.id, tier: course.tier, enrolledAt: serverTimestamp() })
export const leaveCourse = (uid, courseId) => deleteDoc(doc(db, 'students', uid, 'enrollments', courseId))

// ---------- Attempts ----------
export const saveAttempt = (uid, attempt) => addDoc(collection(db, 'students', uid, 'attempts'), { ...attempt, createdAt: serverTimestamp() })
export const subscribeAttempts = (uid, onChange, max = 500) => onSnapshot(query(collection(db, 'students', uid, 'attempts'), orderBy('createdAt', 'desc'), limit(max)),
  (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), createdAt: item.data().createdAt?.toDate?.() || new Date() }))), () => onChange([]))

// ---------- Progress sharing ----------
const newShareId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 16)
export const publishProgressShare = async (uid, profile, snapshot) => {
  const shareId = profile.shareId || newShareId()
  await setDoc(doc(db, 'progressShares', shareId), { ownerUid: uid, ...snapshot, updatedAt: serverTimestamp() })
  if (!profile.shareId) await updateDoc(studentRef(uid), { shareId, updatedAt: serverTimestamp() })
  return shareId
}
export const stopProgressShare = async (uid, shareId) => {
  if (shareId) await deleteDoc(doc(db, 'progressShares', shareId))
  await updateDoc(studentRef(uid), { shareId: '', updatedAt: serverTimestamp() })
}
export const loadProgressShare = async (shareId) => {
  const snapshot = await getDoc(doc(db, 'progressShares', shareId))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data(), updatedAt: snapshot.data().updatedAt?.toDate?.() || null } : null
}

// ---------- Administration ----------
export const listStudents = async (max = 200) => (await getDocs(query(collection(db, 'students'), orderBy('createdAt', 'desc'), limit(max)))).docs.map((item) => ({ id: item.id, ...item.data() }))
export const setStudentPlan = (uid, plan, months = 12) => {
  const expires = new Date(); expires.setMonth(expires.getMonth() + months)
  return updateDoc(studentRef(uid), { plan, planExpiresAt: plan === 'free' ? null : expires.toISOString(), planRequest: null, updatedAt: serverTimestamp() })
}
