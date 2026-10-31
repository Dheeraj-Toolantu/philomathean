// Accounts an administrator creates for students and teachers (login ID + password).
//
// Creating a Firebase Auth user with the client SDK normally signs the browser in as that new user, which would
// sign the administrator out. To avoid that, accounts are created on a separate, in-memory Firebase app
// instance: the new user is signed in there only long enough to write their own profile (so the existing
// Firestore rules apply unchanged), then signed out. The administrator's own session is never touched, and no
// Cloud Functions deployment or Blaze plan is needed.
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, inMemoryPersistence, initializeAuth, signOut, updateProfile } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { firebaseConfig } from './config'
import { setStudentPlan } from './student'
import { saveTeacher } from './teaching'
import { loginIdError, loginIdToEmail, normaliseLoginId } from './loginId'

const env = typeof import.meta.env === 'object' ? import.meta.env : {}
const clean = (value, max) => String(value ?? '').trim().slice(0, max)

const withCreatorApp = async (task) => {
  const app = initializeApp(firebaseConfig, `account-creator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const creatorAuth = initializeAuth(app, { persistence: inMemoryPersistence })
  const creatorDb = getFirestore(app)
  if (env.DEV && env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(creatorAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(creatorDb, '127.0.0.1', 8080)
  }
  try { return await task(creatorAuth, creatorDb) } finally {
    await signOut(creatorAuth).catch(() => {})
    await deleteApp(app).catch(() => {})
  }
}

const ACCOUNT_ERRORS = {
  'auth/email-already-in-use': 'That login ID is already taken. Choose another one.',
  'auth/weak-password': 'Use a password of at least 8 characters.',
  'auth/invalid-email': 'That login ID can’t be used. Try letters and numbers only.',
  'auth/operation-not-allowed': 'Email/password sign-in is turned off in Firebase Authentication. Turn it on, then try again.',
  'auth/too-many-requests': 'Firebase is limiting new accounts from this browser for a few minutes. Try again shortly.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'permission-denied': 'The account was created, but its profile was refused. Check that the latest Firestore rules are deployed.',
}
export const accountErrorMessage = (error) => error?.message?.startsWith('INVALID:') ? error.message.slice(8) : ACCOUNT_ERRORS[error?.code] || 'The account could not be created. Please try again.'

// role: 'student' | 'teacher'. Returns { uid, loginId, email }.
export const createAccount = async ({ role, loginId, password, name, curriculum = '', grade = '', phone = '', school = '', plan = 'free', subjects = '', order = 99 }) => {
  const idProblem = loginIdError(loginId)
  if (idProblem) throw new Error(`INVALID:${idProblem}`)
  if (String(password).length < 8) throw new Error('INVALID:Use a password of at least 8 characters.')
  if (!clean(name, 80)) throw new Error(`INVALID:Add the ${role}’s name.`)
  const email = loginIdToEmail(loginId)
  const displayName = clean(name, 80)

  const uid = await withCreatorApp(async (creatorAuth, creatorDb) => {
    const { user } = await createUserWithEmailAndPassword(creatorAuth, email, password)
    await updateProfile(user, { displayName })
    if (role === 'student') {
      // Written as the new student, so it passes the normal "create your own profile" rule (plan starts free).
      await setDoc(doc(creatorDb, 'students', user.uid), {
        uid: user.uid, email: user.email, loginId: normaliseLoginId(loginId), createdByAdmin: true,
        displayName, photoURL: '', photoPath: '', phone: clean(phone, 20), grade: clean(grade, 40), school: clean(school, 120), curriculum: clean(curriculum, 40),
        targetSession: '', bio: '', parentEmail: '', plan: 'free', planRequest: null, shareId: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    }
    return user.uid
  })

  // Back on the administrator's own session.
  if (role === 'teacher') await saveTeacher(uid, { name: displayName, email, subjects, order })
  if (role === 'student' && plan === 'gold') await setStudentPlan(uid, 'gold')
  return { uid, loginId: normaliseLoginId(loginId), email }
}
