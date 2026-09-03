import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './config'

const resultsCollection = collection(db, 'results')
const papersCollection = collection(db, 'pastPaperResources')
const publicPapersCollection = collection(db, 'publicPastPapers')

const normalize = (snapshot, publicView = false) => snapshot.docs.map((item) => {
	const data = item.data()
	if (publicView) return { id: item.id, title: data.title, pathway: data.pathway, subject: data.subject, access: data.access || 'premium', freeDownloadUrl: data.access === 'free' ? data.freeDownloadUrl : undefined, published: data.published, status: data.status, previewAvailable: Boolean(data.previewAvailable) }
	return { id: item.id, ...data }
})

export const subscribeToPublishedResults = (onChange, onError) => onSnapshot(query(resultsCollection, where('published', '==', true), orderBy('sortOrder'), limit(100)), (snapshot) => onChange(normalize(snapshot)), onError)
export const subscribeToPublishedPapers = (onChange, onError) => onSnapshot(query(publicPapersCollection, where('published', '==', true), limit(250)), (snapshot) => onChange(normalize(snapshot, true).filter((paper) => paper.status === 'published')), onError)
export const getAdminResults = async () => normalize(await getDocs(query(resultsCollection, orderBy('sortOrder'), limit(250))))
export const getAdminPapers = async () => normalize(await getDocs(query(papersCollection, limit(250)))).sort((first, second) => (second.updatedAt?.seconds || 0) - (first.updatedAt?.seconds || 0))
export const ensurePublicPaper = (paper, freeDownloadUrl) => setDoc(doc(db, 'publicPastPapers', paper.id), { title: paper.title, pathway: paper.pathway, subject: paper.subject, access: paper.access || 'premium', freeDownloadUrl: paper.access === 'free' ? (freeDownloadUrl || null) : null, status: paper.status || 'published', published: paper.published !== false, previewAvailable: false, resourceId: paper.id, version: paper.version || 1, updatedAt: serverTimestamp() }, { merge: true })

export const createResult = (values, uid) => addDoc(resultsCollection, { ...values, published: Boolean(values.published), sortOrder: Number(values.sortOrder) || 0, version: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
export const updateResult = (id, values, uid, version) => runTransaction(db, async (transaction) => { const resultRef = doc(db, 'results', id); const snapshot = await transaction.get(resultRef); if (!snapshot.exists() || snapshot.data().version !== version) throw new Error('CONFLICT'); transaction.update(resultRef, { ...values, published: Boolean(values.published), sortOrder: Number(values.sortOrder) || 0, version: version + 1, updatedBy: uid, updatedAt: serverTimestamp() }) })
export const removeResult = (id) => deleteDoc(doc(db, 'results', id))

const publicPaper = (values, id, version) => ({ title: values.title.trim(), pathway: values.pathway, subject: values.subject.trim(), access: values.access, status: 'published', published: true, previewAvailable: false, resourceId: id, version, updatedAt: serverTimestamp() })
export const createPaper = (values, uid, filePath, fileName, fileSize) => { const paperRef = doc(papersCollection); const batch = writeBatch(db); batch.set(paperRef, { title: values.title.trim(), pathway: values.pathway, subject: values.subject.trim(), access: values.access, filePath, fileName, fileSize, contentType: 'application/pdf', status: 'published', published: true, version: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); batch.set(doc(publicPapersCollection, paperRef.id), publicPaper(values, paperRef.id, 1)); return batch.commit() }
export const updatePaper = (id, values, uid, version, fileDetails = {}) => runTransaction(db, async (transaction) => { const paperRef = doc(db, 'pastPaperResources', id); const publicRef = doc(db, 'publicPastPapers', id); const snapshot = await transaction.get(paperRef); if (!snapshot.exists() || snapshot.data().version !== version) throw new Error('CONFLICT'); transaction.update(paperRef, { title: values.title.trim(), pathway: values.pathway, subject: values.subject.trim(), access: values.access, ...fileDetails, status: 'published', published: true, version: version + 1, updatedBy: uid, updatedAt: serverTimestamp() }); transaction.set(publicRef, publicPaper(values, id, version + 1)) })
export const removePaper = (id) => { const batch = writeBatch(db); batch.delete(doc(db, 'pastPaperResources', id)); batch.delete(doc(db, 'publicPastPapers', id)); return batch.commit() }
