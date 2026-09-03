import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from './config'

export const subscribeToAdmin = (onChange) => onAuthStateChanged(auth, async (user) => {
  if (!user) return onChange(null)
  const token = await user.getIdTokenResult(true)
  onChange(token.claims.admin === true ? user : null)
})

export const signInAdmin = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password)
  const token = await result.user.getIdTokenResult(true)
  if (token.claims.admin !== true) {
    await signOut(auth)
    throw new Error('ADMIN_ACCESS_REQUIRED')
  }
  return result.user
}

export const signOutAdmin = () => signOut(auth)
