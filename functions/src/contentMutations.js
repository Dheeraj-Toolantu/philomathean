const admin = require('firebase-admin')

const db = admin.firestore()
const bucket = admin.storage().bucket()
const MAX_PDF_BYTES = 25 * 1024 * 1024
const pathways = new Set(['IGCSE', 'AS & A Level', 'SAT / ACT', 'IBDP', 'MYP'])

const assertAdmin = (context) => {
  if (!context.auth?.token?.admin) throw new Error('admin access required')
}
const audit = (actorUid, action, entityType, entityId, version, summary) => db.collection('auditLogs').add({ actorUid, action, entityType, entityId, version, summary, occurredAt: admin.firestore.FieldValue.serverTimestamp() })

exports.createResult = async (data, context) => { assertAdmin(context); const ref = db.collection('results').doc(); const record = { studentName: String(data.studentName || '').trim(), score: String(data.score || '').trim(), subjects: String(data.subjects || '').trim(), school: String(data.school || '').trim(), published: Boolean(data.published), sortOrder: Number(data.sortOrder) || 0, version: 1, createdBy: context.auth.uid, updatedBy: context.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }; await ref.set(record); await audit(context.auth.uid, 'create', 'studentResult', ref.id, 1, { after: record }); return { id: ref.id, version: 1 } }
exports.deleteResult = async (data, context) => { assertAdmin(context); const ref = db.collection('results').doc(data.id); await db.runTransaction(async (transaction) => { const snapshot = await transaction.get(ref); if (!snapshot.exists || snapshot.data().version !== data.version) throw new Error('conflict'); transaction.delete(ref) }); await audit(context.auth.uid, 'delete', 'studentResult', data.id, data.version, {}) }
exports.createPastPaper = async (data, context) => { assertAdmin(context); if (!pathways.has(data.pathway) || data.contentType !== 'application/pdf' || data.fileSize > MAX_PDF_BYTES) throw new Error('invalid past paper'); const ref = db.collection('pastPaperResources').doc(); const record = { title: String(data.title || '').trim(), pathway: data.pathway, subject: String(data.subject || '').trim(), filePath: `past-papers/${ref.id}/current.pdf`, fileName: String(data.fileName || '').trim(), fileSize: data.fileSize, contentType: 'application/pdf', status: 'published', published: true, version: 1, createdBy: context.auth.uid, updatedBy: context.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }; await ref.set(record); await audit(context.auth.uid, 'create', 'pastPaperResource', ref.id, 1, { after: { title: record.title, pathway: record.pathway, subject: record.subject } }); return { id: ref.id, version: 1 } }
exports.deletePastPaper = async (data, context) => { assertAdmin(context); const ref = db.collection('pastPaperResources').doc(data.id); const snapshot = await ref.get(); if (!snapshot.exists || snapshot.data().version !== data.version) throw new Error('conflict'); await ref.delete(); if (snapshot.data().filePath) await bucket.file(snapshot.data().filePath).delete({ ignoreNotFound: true }); await audit(context.auth.uid, 'delete', 'pastPaperResource', data.id, data.version, {}) }
