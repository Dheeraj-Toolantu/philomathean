import admin from 'firebase-admin'

const inferSubjectMeta = (data = {}) => {
  const titleText = String(data.title || data.fileName || '').trim()
  const subjectText = String(data.subjectName || data.subject || '').trim() || titleText
  const subjectNameMatch = subjectText.match(/([A-Za-z& ]+)\s*(\d+)?/i)
  const subjectName = String(data.subjectName || (subjectNameMatch ? subjectNameMatch[1].trim() : 'General Subject')).trim()
  const subjectCode = data.subjectCode || (() => {
    const match = String(subjectText + ' ' + titleText).match(/\b(0\d{3,4})\b/)
    return match ? match[1] : null
  })()
  const yearMatch = String(data.year ?? titleText).match(/(19|20)\d{2}/)
  const year = Number(data.year ?? (yearMatch ? yearMatch[0] : 0)) || null
  const session = data.session || (() => {
    const combined = titleText.toLowerCase()
    if (combined.includes('oct') || combined.includes('nov')) return 'Oct-Nov'
    if (combined.includes('may') || combined.includes('jun')) return 'May-June'
    if (combined.includes('feb') || combined.includes('mar')) return 'Feb-March'
    return null
  })()
  const topic = data.topic || (data.paperType === 'topic-wise' ? (titleText.split('-')[0] || 'Topic').trim() : null)

  return {
    subjectName,
    subjectCode,
    subject: `${subjectName}${subjectCode ? ` ${subjectCode}` : ''}`,
    paperType: data.paperType || (topic ? 'topic-wise' : 'year-wise'),
    year,
    session,
    topic,
  }
}

const normalizeDocument = (doc) => {
  const data = doc.data() || {}
  const inferred = inferSubjectMeta(data)
  const next = {
    ...data,
    title: String(data.title || '').trim() || 'Untitled paper',
    pathway: data.pathway || 'IGCSE',
    subjectName: data.subjectName || inferred.subjectName,
    subjectCode: data.subjectCode || inferred.subjectCode || null,
    subject: data.subject || inferred.subject,
    paperType: data.paperType || inferred.paperType,
    year: data.year ?? inferred.year,
    session: data.session ?? inferred.session,
    topic: data.topic ?? inferred.topic,
    access: data.access || 'premium',
    status: data.status || 'published',
    published: data.published !== false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (!next.filePath && data.filePath) next.filePath = data.filePath
  if (!next.fileName && data.fileName) next.fileName = data.fileName
  if (!next.fileSize && data.fileSize) next.fileSize = data.fileSize
  if (!next.contentType && data.contentType) next.contentType = data.contentType
  return next
}

const run = async () => {
  if (!admin.apps.length) admin.initializeApp()
  const db = admin.firestore()
  const collections = ['pastPaperResources', 'publicPastPapers']

  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get()
    console.log(`Processing ${collectionName}: ${snapshot.size} documents`)

    const batch = db.batch()
    snapshot.forEach((doc) => {
      batch.set(doc.ref, normalizeDocument(doc), { merge: true })
    })

    if (!snapshot.empty) await batch.commit()
    console.log(`Updated ${collectionName}`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
