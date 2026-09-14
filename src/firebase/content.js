import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './config'

const resultsCollection = collection(db, 'results')
const papersCollection = collection(db, 'pastPaperResources')
const publicPapersCollection = collection(db, 'publicPastPapers')

const parseLegacyPaperMetadata = (data = {}) => {
	const subjectText = String(data.subjectName || data.subject || '').trim()
	const subjectName = String(data.subjectName || (subjectText.includes('-') ? subjectText.split('-').slice(-1)[0].trim() : subjectText) || 'Untitled subject').trim()
	const subjectCode = data.subjectCode || null
	const yearMatch = String(data.title || data.fileName || '').match(/(19|20)\d{2}/)
	const year = data.year ?? (yearMatch ? Number(yearMatch[0]) : null)
	const session = data.session ?? (() => {
		const text = String(data.title || data.fileName || '').toLowerCase()
		if (text.includes('october') || text.includes('november')) return 'Oct-Nov'
		if (text.includes('may') || text.includes('june')) return 'May-June'
		if (text.includes('feb') || text.includes('march')) return 'Feb-March'
		return null
	})()
	const paperType = data.paperType || (data.topic ? 'topic-wise' : (year || session ? 'year-wise' : 'year-wise'))
	const topic = data.topic || (paperType === 'topic-wise' ? subjectName : null)
	return {
		...data,
		subjectName,
		subjectCode,
		subject: `${subjectName}${subjectCode ? ` ${subjectCode}` : ''}`,
		paperType,
		year,
		session,
		topic,
		access: data.access || 'premium',
		published: data.published !== false,
		status: data.status || 'published',
		previewAvailable: Boolean(data.previewAvailable),
	}
}

const normalize = (snapshot, publicView = false) => snapshot.docs.map((item) => {
	const data = parseLegacyPaperMetadata(item.data())
	if (publicView) return { id: item.id, title: data.title, pathway: data.pathway, subjectName: data.subjectName, subjectCode: data.subjectCode, subject: data.subject, paperType: data.paperType, year: data.year, session: data.session, topic: data.topic, access: data.access || 'premium', freeDownloadUrl: data.access === 'free' ? data.freeDownloadUrl : undefined, published: data.published, status: data.status, previewAvailable: Boolean(data.previewAvailable) }
	return { id: item.id, ...data }
})

export const subscribeToPublishedResults = (onChange, onError) => onSnapshot(query(resultsCollection, where('published', '==', true), orderBy('sortOrder'), limit(100)), (snapshot) => onChange(normalize(snapshot)), onError)
export const subscribeToPublishedPapers = (onChange, onError) => onSnapshot(query(publicPapersCollection, where('published', '==', true), limit(250)), (snapshot) => onChange(normalize(snapshot, true).filter((paper) => paper.status === 'published')), onError)
export const getAdminResults = async () => normalize(await getDocs(query(resultsCollection, orderBy('sortOrder'), limit(250))))
export const getAdminPapers = async () => normalize(await getDocs(query(papersCollection, limit(250)))).sort((first, second) => (second.updatedAt?.seconds || 0) - (first.updatedAt?.seconds || 0))
export const ensurePublicPaper = (paper, freeDownloadUrl) => {
	const normalized = parseLegacyPaperMetadata(paper)
	return setDoc(doc(db, 'publicPastPapers', paper.id), { title: normalized.title, pathway: normalized.pathway, subjectName: normalized.subjectName, subjectCode: normalized.subjectCode || null, subject: normalized.subject, paperType: normalized.paperType, year: normalized.paperType === 'year-wise' ? Number(normalized.year) : null, session: normalized.paperType === 'year-wise' ? normalized.session : null, topic: normalized.paperType === 'topic-wise' ? normalized.topic : null, access: normalized.access || 'premium', freeDownloadUrl: normalized.access === 'free' ? (freeDownloadUrl || null) : null, status: normalized.status || 'published', published: normalized.published !== false, previewAvailable: false, resourceId: paper.id, version: normalized.version || 1, updatedAt: serverTimestamp() }, { merge: true })
}

export const createResult = (values, uid) => addDoc(resultsCollection, { ...values, published: Boolean(values.published), sortOrder: Number(values.sortOrder) || 0, version: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
export const updateResult = (id, values, uid, version) => runTransaction(db, async (transaction) => { const resultRef = doc(db, 'results', id); const snapshot = await transaction.get(resultRef); if (!snapshot.exists() || snapshot.data().version !== version) throw new Error('CONFLICT'); transaction.update(resultRef, { ...values, published: Boolean(values.published), sortOrder: Number(values.sortOrder) || 0, version: version + 1, updatedBy: uid, updatedAt: serverTimestamp() }) })
export const removeResult = (id) => deleteDoc(doc(db, 'results', id))

const paperFields = (values) => ({
	title: values.title.trim(),
	pathway: values.pathway,
	subjectName: values.subjectName.trim(),
	subjectCode: values.subjectCode?.trim() || null,
	subject: `${values.subjectName.trim()}${values.subjectCode?.trim() ? ` ${values.subjectCode.trim()}` : ''}`,
	paperType: values.paperType,
	year: values.paperType === 'year-wise' ? Number(values.year) : null,
	session: values.paperType === 'year-wise' ? values.session : null,
	topic: values.paperType === 'topic-wise' ? values.topic.trim() : null,
	access: values.access,
})
const publicPaper = (values, id, version) => ({ ...paperFields(values), status: 'published', published: true, previewAvailable: false, resourceId: id, version, updatedAt: serverTimestamp() })
export const createPaper = (values, uid, filePath, fileName, fileSize) => { const paperRef = doc(papersCollection); const batch = writeBatch(db); batch.set(paperRef, { ...paperFields(values), filePath, fileName, fileSize, contentType: 'application/pdf', status: 'published', published: true, version: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); batch.set(doc(publicPapersCollection, paperRef.id), publicPaper(values, paperRef.id, 1)); return batch.commit() }
export const updatePaper = (id, values, uid, version, fileDetails = {}) => runTransaction(db, async (transaction) => { const paperRef = doc(db, 'pastPaperResources', id); const publicRef = doc(db, 'publicPastPapers', id); const snapshot = await transaction.get(paperRef); if (!snapshot.exists() || snapshot.data().version !== version) throw new Error('CONFLICT'); transaction.update(paperRef, { ...paperFields(values), ...fileDetails, status: 'published', published: true, version: version + 1, updatedBy: uid, updatedAt: serverTimestamp() }); transaction.set(publicRef, publicPaper(values, id, version + 1)) })
export const removePaper = (id) => { const batch = writeBatch(db); batch.delete(doc(db, 'pastPaperResources', id)); batch.delete(doc(db, 'publicPastPapers', id)); return batch.commit() }
