import { addDoc, collection, deleteDoc, doc, documentId, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, startAfter, where, writeBatch } from 'firebase/firestore'
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
	if (publicView) return { id: item.id, title: data.title, pathway: data.pathway, subjectName: data.subjectName, subjectCode: data.subjectCode, subject: data.subject, paperType: data.paperType, resourceType: data.resourceType, year: data.year, session: data.session, topic: data.topic, access: data.access || 'premium', freeDownloadUrl: data.access === 'free' ? data.freeDownloadUrl : undefined, published: data.published, status: data.status, previewAvailable: Boolean(data.previewAvailable) }
	return { id: item.id, ...data }
})

export const subscribeToPublishedResults = (onChange, onError) => onSnapshot(query(resultsCollection, where('published', '==', true), orderBy('sortOrder'), limit(100)), (snapshot) => onChange(normalize(snapshot)), onError)
// Loads every published paper (no hard cap). The document-id space is split into ranges that load at the same time,
// each in pages, so the whole library (with every mark scheme and solved paper paired up) arrives in a few seconds
// instead of one page after another. Progress is first reported once every range has its first page, so cards don't
// appear before their mark scheme or solved paper has loaded.
const PUBLIC_PAGE_SIZE = 500
// Firestore auto-ids use 0-9, A-Z and a-z (in that sort order); any other id still falls into the first or last range.
// 31 ranges keep each one well under a page today (largest ~310 of ~6,200 records), so most finish in a single request.
const ID_BOUNDARIES = [...'3579BDFHJLNPRTVXZbdfhjlnprtvxz']
export const loadPublishedPapers = async (onProgress) => {
	const bounds = [null, ...ID_BOUNDARIES, null]
	const ranges = bounds.slice(0, -1).map((low, index) => ({ low, high: bounds[index + 1], papers: [], started: false, done: false }))
	const report = () => { if (ranges.every((range) => range.started)) onProgress?.(ranges.flatMap((range) => range.papers), ranges.every((range) => range.done)) }
	await Promise.all(ranges.map(async (range) => {
		let cursor
		for (;;) {
			const inRange = [...(range.low ? [where(documentId(), '>=', range.low)] : []), ...(range.high ? [where(documentId(), '<', range.high)] : [])]
			const snapshot = await getDocs(query(publicPapersCollection, where('published', '==', true), ...inRange, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(PUBLIC_PAGE_SIZE)))
			range.papers.push(...normalize(snapshot, true).filter((paper) => paper.status === 'published'))
			range.started = true
			range.done = snapshot.size < PUBLIC_PAGE_SIZE
			report()
			if (range.done) return
			cursor = snapshot.docs.at(-1)
		}
	}))
	return ranges.flatMap((range) => range.papers)
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
const memberLinks = collection(db, 'memberPaperLinks')
// A premium paper's download link is readable only by Gold members (see firestore.rules); free papers carry theirs publicly.
const writeMemberLink = (writer, id, values, downloadUrl) => values.access === 'premium' && values.published !== false && downloadUrl
	? writer.set(doc(memberLinks, id), { url: downloadUrl, updatedAt: serverTimestamp() })
	: writer.delete(doc(memberLinks, id))
const publicPaper = (values, id, version, freeDownloadUrl) => ({ ...paperFields(values), freeDownloadUrl: values.access === 'free' ? (freeDownloadUrl || null) : null, status: 'published', published: values.published !== false, previewAvailable: false, resourceId: id, version, updatedAt: serverTimestamp() })
export const createPaper = async (values, uid, filePath, fileName, fileSize, freeDownloadUrl) => { const paperRef = doc(papersCollection); const batch = writeBatch(db); batch.set(paperRef, { ...paperFields(values), filePath, fileName, fileSize, contentType: 'application/pdf', status: 'published', published: values.published !== false, version: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); batch.set(doc(publicPapersCollection, paperRef.id), publicPaper(values, paperRef.id, 1, freeDownloadUrl)); writeMemberLink(batch, paperRef.id, values, freeDownloadUrl); await batch.commit(); return paperRef.id }
export const updatePaper = (id, values, uid, version, fileDetails = {}, freeDownloadUrl) => runTransaction(db, async (transaction) => { const paperRef = doc(db, 'pastPaperResources', id); const publicRef = doc(db, 'publicPastPapers', id); const snapshot = await transaction.get(paperRef); if (!snapshot.exists() || snapshot.data().version !== version) throw new Error('CONFLICT'); transaction.update(paperRef, { ...paperFields(values), ...fileDetails, status: 'published', published: values.published !== false, version: version + 1, updatedBy: uid, updatedAt: serverTimestamp() }); transaction.set(publicRef, publicPaper(values, id, version + 1, freeDownloadUrl)); writeMemberLink(transaction, id, values, freeDownloadUrl) })
export const removePaper = (id) => { const batch = writeBatch(db); batch.delete(doc(db, 'pastPaperResources', id)); batch.delete(doc(db, 'publicPastPapers', id)); batch.delete(doc(memberLinks, id)); return batch.commit() }

// Admin listing. Papers are listed from the normalised public mirror (every paper has one, hidden ones
// included) so filters work on legacy records too; the full private record is loaded only when needed.
const paperConstraints = (filters = {}) => Object.entries(filters).filter(([, value]) => value !== '' && value != null).map(([field, value]) => where(field, '==', field === 'year' ? Number(value) : value))
const pageRow = (item) => ({ id: item.id, ...parseLegacyPaperMetadata(item.data()) })
const updatedAtSeconds = (item) => item.updatedAt?.seconds || 0

export const getAdminPapersPage = async ({ filters, pageSize, cursor }) => {
	const constraints = paperConstraints(filters)
	try {
		const snapshot = await getDocs(query(publicPapersCollection, ...constraints, orderBy('updatedAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)))
		return { items: snapshot.docs.map(pageRow), cursor: snapshot.docs.at(-1) }
	} catch (error) {
		// Until the composite indexes in firestore.indexes.json are deployed, filter on the server and order in memory.
		if (error.code !== 'failed-precondition' || !constraints.length) throw error
		const offset = typeof cursor === 'number' ? cursor : 0
		const items = (await getDocs(query(publicPapersCollection, ...constraints))).docs.map(pageRow).sort((first, second) => updatedAtSeconds(second) - updatedAtSeconds(first))
		return { items: items.slice(offset, offset + pageSize), cursor: offset + pageSize }
	}
}
export const countAdminPapers = async (filters) => (await getCountFromServer(query(publicPapersCollection, ...paperConstraints(filters)))).data().count
// The download link of a members-only paper; Firestore refuses the read unless the student's Gold plan is active.
export const getMemberPaperLink = async (id) => { const snapshot = await getDoc(doc(memberLinks, id)); if (!snapshot.exists()) throw new Error('NOT_FOUND'); return snapshot.data().url }
export const getAdminPaper = async (id) => { const snapshot = await getDoc(doc(db, 'pastPaperResources', id)); if (!snapshot.exists()) throw new Error('NOT_FOUND'); return { id: snapshot.id, ...parseLegacyPaperMetadata(snapshot.data()) } }

export const getAdminResultsPage = async ({ pageSize, cursor }) => { const snapshot = await getDocs(query(resultsCollection, orderBy('sortOrder'), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize))); return { items: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), cursor: snapshot.docs.at(-1) } }
export const countAdminResults = async () => (await getCountFromServer(resultsCollection)).data().count
