// Bulk-uploads past-paper PDFs from a local folder, skipping anything already in Firebase.
// Dry run by default; pass --upload to write. See `--help` for options.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DEFAULT_PROJECT = 'philomathean-a2c93'
const DEFAULT_BUCKET = 'philomathean-a2c93.firebasestorage.app'
const MAX_PDF_BYTES = 25 * 1024 * 1024

const PATHWAYS = { IGCSE: 'IGCSE', AS: 'AS & A Level', A: 'AS & A Level', ALEVEL: 'AS & A Level', ASALEVEL: 'AS & A Level', SAT: 'SAT / ACT', ACT: 'SAT / ACT', IBDP: 'IBDP', MYP: 'MYP' }
const SUBJECTS = { MATHS: 'MATHEMATICS', MATH: 'MATHEMATICS', ADDMATHS: 'ADDITIONAL MATHEMATICS', CHEM: 'CHEMISTRY', PHY: 'PHYSICS', BIO: 'BIOLOGY', ECO: 'ECONOMICS', CS: 'COMPUTER SCIENCE' }
const SESSIONS = [
  { value: 'Feb-March', names: ['february-march', 'feb-march', 'feb-mar', 'february/march'], cover: /february\s*\/\s*march/i },
  { value: 'May-June', names: ['may-june', 'may-jun', 'may/june'], cover: /may\s*\/\s*june/i },
  { value: 'Oct-Nov', names: ['october-november', 'oct-nov', 'october/november'], cover: /october\s*\/\s*november/i },
]

// "119 - IGCSE-MATHS - 0607-62 - October-November 2016.pdf" (serial and extension optional, so titles parse too)
const NAME_PATTERN = /^(?:(\d+)\s*-\s*)?([A-Za-z&]+)-([A-Za-z& ]+?)\s*-\s*(\d{4})[-/](\d{2})\s*-\s*([A-Za-z/-]+)\s+((?:19|20)\d{2})(?:\.pdf)?$/i

const parsePaperName = (name) => {
  const match = String(name || '').trim().match(NAME_PATTERN)
  if (!match) return null
  const [, serial, pathwayToken, subjectToken, syllabus, variant, sessionToken, year] = match
  const pathway = PATHWAYS[pathwayToken.toUpperCase().replace(/[^A-Z]/g, '')]
  const session = SESSIONS.find((item) => item.names.includes(sessionToken.toLowerCase()))
  if (!pathway || !session) return null
  const subjectKey = subjectToken.toUpperCase().replace(/\s+/g, '')
  return {
    serial: serial ? Number(serial) : null,
    title: `${pathwayToken}-${subjectToken.trim()} - ${syllabus}-${variant} - ${sessionToken} ${year}`,
    pathway,
    subjectName: SUBJECTS[subjectKey] || subjectToken.trim().toUpperCase(),
    syllabus,
    variant,
    paperCode: `${syllabus}-${variant}`,
    session: session.value,
    year: Number(year),
  }
}

const paperKey = (paper) => [paper.pathway, paper.paperCode, paper.session, paper.year].join('|')
const paperCodeOf = (text) => String(text || '').match(/\b(\d{4})-(\d{2})\b/)?.[0] || null
const md5Base64 = (buffer) => crypto.createHash('md5').update(buffer).digest('base64')

// Reads the first pages and checks the printed paper code and session match the file name.
const verifyPdfContent = async (buffer, parsed) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  let text = ''
  try {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false, disableFontFace: true }).promise
    for (let page = 1; page <= Math.min(pdf.numPages, 2); page += 1) {
      const content = await (await pdf.getPage(page)).getTextContent()
      text += ` ${content.items.map((item) => item.str).join(' ')}`
    }
    await pdf.destroy()
  } catch (error) {
    return { status: 'unreadable', detail: `PDF could not be read: ${error.message}` }
  }
  text = text.replace(/\s+/g, ' ')
  if (!text.trim()) return { status: 'no-text', detail: 'No text layer (scanned PDF); content not verified' }
  const codes = [...new Set([...text.matchAll(/\b(\d{4})\s*\/\s*(\d{2})\b/g)].map((item) => `${item[1]}-${item[2]}`))]
  if (codes.length && !codes.includes(parsed.paperCode)) return { status: 'mismatch', detail: `PDF shows paper ${codes.join(', ')}, file name says ${parsed.paperCode}` }
  const session = SESSIONS.find((item) => item.value === parsed.session)
  const sessionFound = new RegExp(`${session.cover.source}\\s*${parsed.year}`, 'i').test(text)
  const otherSession = SESSIONS.find((item) => item !== session && new RegExp(`${item.cover.source}\\s*(19|20)\\d{2}`, 'i').test(text))
  if (!sessionFound && otherSession) return { status: 'mismatch', detail: `PDF shows ${otherSession.value} session, file name says ${parsed.session} ${parsed.year}` }
  if (!codes.length) return { status: 'unverified', detail: 'Paper code not found in PDF text' }
  return { status: 'verified', detail: sessionFound ? 'Paper code and session match' : 'Paper code matches (session not printed)' }
}

const parseArgs = (argv) => {
  const args = { upload: false, access: 'premium', force: false, contentCheck: true, adminEmail: process.env.ADMIN_EMAIL || 'admin@philomathean.in', project: process.env.GCLOUD_PROJECT || DEFAULT_PROJECT, bucket: process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET, report: 'past-paper-upload-report.csv' }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const next = () => argv[++index]
    if (flag === '--dir') args.dir = next()
    else if (flag === '--upload') args.upload = true
    else if (flag === '--access') args.access = next()
    else if (flag === '--force') args.force = true
    else if (flag === '--skip-content-check') args.contentCheck = false
    else if (flag === '--admin-email') args.adminEmail = next()
    else if (flag === '--project') args.project = next()
    else if (flag === '--bucket') args.bucket = next()
    else if (flag === '--report') args.report = next()
    else if (flag === '--help' || flag === '-h') args.help = true
    else throw new Error(`Unknown option ${flag}`)
  }
  return args
}

const usage = `Usage: node scripts/bulk-upload-past-papers.cjs --dir "<folder with PDFs>" [options]

  --upload               Actually upload (default is a dry run that only reports)
  --access premium|free  Permission for new papers (default premium, like the dashboard)
  --force                Upload even when the PDF text contradicts the file name
  --skip-content-check   Do not read PDF text
  --admin-email <email>  Account recorded as createdBy (default admin@philomathean.in)
  --report <file.csv>    Where to write the report (default past-paper-upload-report.csv)
  --project / --bucket   Firebase project id and Storage bucket

Credentials: set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON key.`

const loadExisting = async (db, bucket) => {
  const snapshot = await db.collection('pastPaperResources').get()
  const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  await Promise.all(records.map(async (record) => {
    record.parsed = parsePaperName(record.title)
    if (record.contentMd5) return
    if (!record.filePath) return
    try {
      const [metadata] = await bucket.file(record.filePath).getMetadata()
      record.contentMd5 = metadata.md5Hash
    } catch {
      record.missingFile = true
    }
  }))
  const issues = []
  const byMd5 = new Map()
  for (const record of records) {
    const titleCode = paperCodeOf(record.title)
    const fileCode = paperCodeOf(record.fileName)
    if (titleCode && fileCode && titleCode !== fileCode) { record.wrongFile = true; issues.push(`"${record.title}" has file "${record.fileName}" attached (paper ${fileCode}, not ${titleCode})`) }
    if (record.missingFile) issues.push(`"${record.title}" points to a missing PDF (${record.filePath})`)
    if (record.contentMd5) {
      const other = byMd5.get(record.contentMd5)
      if (other) issues.push(`"${record.title}" and "${other.title}" contain the identical PDF`)
      else byMd5.set(record.contentMd5, record)
    }
  }
  return { records, byMd5, issues }
}

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.dir) { console.log(usage); if (!args.help) process.exitCode = 1; return }
  if (!['free', 'premium'].includes(args.access)) throw new Error('--access must be free or premium')
  const folder = path.resolve(args.dir)
  const files = fs.readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.pdf'))
  console.log(`${args.upload ? 'UPLOAD' : 'DRY RUN'}: ${files.length} PDF files in ${folder}`)

  const admin = require('firebase-admin')
  const { getDownloadURL } = require('firebase-admin/storage')
  admin.initializeApp({ projectId: args.project, storageBucket: args.bucket })
  const db = admin.firestore()
  const bucket = admin.storage().bucket()
  const { FieldValue } = admin.firestore

  const existing = await loadExisting(db, bucket)
  console.log(`Firebase already has ${existing.records.length} past papers`)
  if (existing.issues.length) { console.log('\nProblems found in papers already uploaded:'); existing.issues.forEach((issue) => console.log(`  ! ${issue}`)) }
  const byKey = new Map(existing.records.filter((record) => record.parsed).map((record) => [paperKey(record.parsed), record]))
  const subjectFor = (parsed) => existing.records.find((record) => record.pathway === parsed.pathway && record.parsed?.syllabus === parsed.syllabus)

  let createdBy = 'bulk-upload-script'
  try { createdBy = (await admin.auth().getUserByEmail(args.adminEmail)).uid } catch { console.log(`Note: ${args.adminEmail} not found in Auth; recording createdBy as "${createdBy}"`) }

  const rows = []
  const seenKeys = new Map()
  const seenMd5 = new Map()
  const entries = files.map((fileName) => ({ fileName, parsed: parsePaperName(fileName) })).sort((a, b) => (a.parsed?.serial ?? Infinity) - (b.parsed?.serial ?? Infinity) || a.fileName.localeCompare(b.fileName))

  for (const { fileName, parsed } of entries) {
    const row = { fileName, title: parsed?.title || '', status: '', detail: '' }
    rows.push(row)
    const report = (status, detail) => { row.status = status; row.detail = detail; console.log(`${status.padEnd(18)} ${fileName}${detail ? `\n${' '.repeat(19)}${detail}` : ''}`) }
    if (!parsed) { report('SKIP bad-name', 'Expected "<n> - IGCSE-MATHS - 0607-62 - October-November 2016.pdf"'); continue }

    const buffer = fs.readFileSync(path.join(folder, fileName))
    if (buffer.length > MAX_PDF_BYTES) { report('SKIP too-large', `${(buffer.length / 1048576).toFixed(1)} MB, limit is 25 MB`); continue }
    if (buffer.subarray(0, 5).toString() !== '%PDF-') { report('SKIP not-pdf', 'File does not start with a PDF header'); continue }
    const md5 = md5Base64(buffer)
    const key = paperKey(parsed)

    const sameContent = existing.byMd5.get(md5)
    if (sameContent) { report('SKIP duplicate', `Identical PDF already uploaded as "${sameContent.title}"`); continue }
    const sameKey = byKey.get(key)
    if (sameKey) { report('SKIP exists', sameKey.wrongFile ? `"${sameKey.title}" exists but has the WRONG file (${sameKey.fileName}); replace it with this PDF via Edit in the dashboard` : `Already uploaded as "${sameKey.title}"`); continue }
    if (seenMd5.has(md5)) { report('SKIP duplicate', `Same PDF as "${seenMd5.get(md5)}" in this folder`); continue }
    if (seenKeys.has(key)) { report('SKIP duplicate', `Same paper as "${seenKeys.get(key)}" in this folder`); continue }

    let check = { status: 'skipped', detail: 'Content check disabled' }
    if (args.contentCheck) check = await verifyPdfContent(buffer, parsed)
    if ((check.status === 'mismatch' || check.status === 'unreadable') && !args.force) { report('SKIP content', check.detail); continue }
    seenMd5.set(md5, fileName)
    seenKeys.set(key, fileName)

    const known = subjectFor(parsed)
    const subjectName = known?.subjectName || parsed.subjectName
    const subjectCode = known ? (known.subjectCode || null) : null
    const fields = { title: parsed.title, pathway: parsed.pathway, subjectName, subjectCode, subject: `${subjectName}${subjectCode ? ` ${subjectCode}` : ''}`, paperType: 'year-wise', year: parsed.year, session: parsed.session, topic: null, access: args.access }

    if (!args.upload) { report('WOULD UPLOAD', `${fields.pathway} · ${fields.subject} · ${parsed.year} ${parsed.session} · ${args.access} · ${check.detail}`); continue }

    const paperRef = db.collection('pastPaperResources').doc()
    const filePath = `past-papers/${paperRef.id}/current.pdf`
    const file = bucket.file(filePath)
    try {
      await file.save(buffer, { resumable: false, contentType: 'application/pdf', metadata: { contentType: 'application/pdf', metadata: { access: args.access, published: 'true' } } })
      const freeDownloadUrl = args.access === 'free' ? `${await getDownloadURL(file)}#toolbar=1&navpanes=0&view=FitH` : null
      const batch = db.batch()
      batch.set(paperRef, { ...fields, filePath, fileName, fileSize: buffer.length, contentType: 'application/pdf', contentMd5: md5, status: 'published', published: true, version: 1, createdBy, updatedBy: createdBy, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
      batch.set(db.collection('publicPastPapers').doc(paperRef.id), { ...fields, freeDownloadUrl, status: 'published', published: true, previewAvailable: false, resourceId: paperRef.id, version: 1, updatedAt: FieldValue.serverTimestamp() })
      await batch.commit()
      report('UPLOADED', `${fields.title} · ${check.detail}`)
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => {})
      report('FAILED', error.message)
    }
  }

  const counts = rows.reduce((totals, row) => ({ ...totals, [row.status]: (totals[row.status] || 0) + 1 }), {})
  fs.writeFileSync(args.report, ['file,title,status,detail', ...rows.map((row) => [row.fileName, row.title, row.status, row.detail].map(csvCell).join(','))].join('\n'))
  console.log('\nSummary:', Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(', ') || 'nothing to do')
  console.log(`Report written to ${path.resolve(args.report)}`)
  if (!args.upload && counts['WOULD UPLOAD']) console.log('Dry run only. Re-run with --upload to upload the files marked WOULD UPLOAD.')
}

module.exports = { parsePaperName, verifyPdfContent }

if (require.main === module) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => { const admin = require('firebase-admin'); if (admin.apps.length) admin.app().delete() })
}
