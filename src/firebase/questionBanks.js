// Admin-managed question banks. One Firestore document per bank: questionBanks/{bankId}
//   { questions: [question], version, updatedAt, updatedBy }
// A bank with no document uses its built-in questions (src/student/questionBank.js).
import { collection, deleteDoc, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { cleanQuestion } from '../student/questionTools'
import { db, storage } from './config'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const loadManagedBanks = async () => {
  const snapshot = await getDocs(collection(db, 'questionBanks'))
  return Object.fromEntries(snapshot.docs.map((item) => [item.id, { ...item.data(), updatedAt: item.data().updatedAt?.toDate?.() || null }]))
}

// Saves the whole bank. `expectedVersion` is the version the admin started editing from; if someone else
// saved in the meantime the write is refused instead of silently overwriting their changes.
export const saveBank = (bankId, questions, expectedVersion, user) => runTransaction(db, async (transaction) => {
  const bankRef = doc(db, 'questionBanks', bankId)
  const current = await transaction.get(bankRef)
  const version = current.exists() ? current.data().version || 0 : 0
  if (version !== (expectedVersion || 0)) throw new Error('BANK_CHANGED')
  transaction.set(bankRef, { questions: questions.map(cleanQuestion), version: version + 1, updatedAt: serverTimestamp(), updatedBy: user?.email || '' })
  return version + 1
})

// Removes the managed copy so the site goes back to the built-in questions for this bank.
export const resetBank = async (bankId, questions = []) => {
  await Promise.all(questions.filter((question) => question.imagePath).map((question) => deleteObject(ref(storage, question.imagePath)).catch(() => {})))
  await deleteDoc(doc(db, 'questionBanks', bankId))
}

export const uploadQuestionImage = async (bankId, questionId, file) => {
  if (!file?.type?.startsWith('image/')) throw new Error('IMAGE_TYPE')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_SIZE')
  const extension = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `question-images/${bankId}/${questionId}-${Date.now()}.${extension}`
  const imageRef = ref(storage, path)
  await uploadBytes(imageRef, file, { contentType: file.type })
  return { imageUrl: await getDownloadURL(imageRef), imagePath: path }
}
export const removeQuestionImage = (path) => path ? deleteObject(ref(storage, path)).catch(() => {}) : Promise.resolve()
