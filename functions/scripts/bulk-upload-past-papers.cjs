// Bulk-uploads past-paper PDFs from a local folder. Dry run by default; pass --upload to write.
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

const RESOURCE_TYPES = {
  qp: 'question-paper',
  ms: 'mark-scheme',
  er: 'examiner-report',
  gt: 'grade-thresholds',
}
const ACCESS_BY_TYPE = {
  'question-paper': 'free',
  'mark-scheme': 'free',
  'examiner-report': 'free',
  'grade-thresholds': 'free',
  'topic-practice': 'free',
  'solved-question-paper': 'premium',
}
const SESSION_PATTERN = '(February[-/]?March|Feb[-/]?March|Feb[-/]?Mar|May[-/]?June|May[-/]?Jun|October[-/]?November|Oct[-/]?Nov)'
const NORMALIZED_NAME_PATTERN = new RegExp(
  `^(?:(\\d+)\\s*-\\s*)?((?:IGCSE|AS\\s*&\\s*A\\s*Level|AS|A\\s*Level|SAT\\s*[/&-]?\\s*ACT|IBDP|MYP)(?:-[A-Za-z& ]+)?)\\s*-\\s*(\\d{4})(?:-(\\d{1,2}))?\\s*-\\s*${SESSION_PATTERN}\\s+((?:19|20)\\d{2})(?:\\s*-\\s*(.+?))?(?:\\.pdf)?$`,
  'i',
)
const CAIE_NAME_PATTERN = /^(\d{4})_([msw])(\d{2})_(qp|ms|er|gt)(?:_(\d{1,2}))?(_solved)?\.pdf$/i
const YEAR_FIRST_NAME_PATTERN = new RegExp(
  `^((?:19|20)\\d{2})\\s+${SESSION_PATTERN}\\s*-\\s*(.*?)\\s*-\\s*(\\d{4})(?:\\s*-\\s*(.*?))?(?:\\.pdf)?$`,
  'i',
)
const TOPIC_FILE_PATTERN = /^Year_(\d+)_-_(.+?)_iGCSE_Questions\.pdf$/i
const TOPIC_TITLE_PATTERN = /^((?:IGCSE|AS\s*&\s*A\s*Level|AS|A\s*Level|SAT\s*[/&-]?\s*ACT|IBDP|MYP)(?:-[A-Za-z& ]+)?)\s*-\s*(\d{4})\s*-\s*Topic\s*-\s*(.+?)(?:\.pdf)?$/i

const normalizeSession = (sessionToken) => {
  const token = sessionToken.toLowerCase().replace(/[-/]/g, '')
  return SESSIONS.find((session) => session.names.some((name) => name.replace(/[-/]/g, '') === token))?.value
}

const resourceTypeFromLabel = (label = '') => {
  if (/solved/i.test(label)) return 'solved-question-paper'
  if (/mark\s*scheme|\bms\b/i.test(label)) return 'mark-scheme'
  if (/examiner'?s?\s*report/i.test(label)) return 'examiner-report'
  if (/grade\s*threshold/i.test(label)) return 'grade-thresholds'
  return 'question-paper'
}

const titleFor = ({ pathway, subjectName, syllabus, paperNumber, session, year, resourceType }) => {
  const code = paperNumber ? ` - ${syllabus}-${paperNumber}` : ` - ${syllabus}`
  const labels = {
    'question-paper': '',
    'mark-scheme': ' - Mark Scheme',
    'solved-question-paper': ' - Solved Question Paper',
    'examiner-report': ' - Examiner Report',
    'grade-thresholds': ' - Grade Thresholds',
  }
  return `${pathway}-${subjectName}${code} - ${session} ${year}${labels[resourceType]}`
}

const finishParsedPaper = ({ serial = null, pathway, subjectName, syllabus, paperNumber = null, session, year, resourceType }) => ({
  serial,
  title: titleFor({ pathway, subjectName, syllabus, paperNumber, session, year, resourceType }),
  pathway,
  subjectName,
  subjectCode: syllabus,
  syllabus,
  paperNumber: paperNumber ? String(paperNumber).padStart(2, '0') : null,
  paperCode: paperNumber ? `${syllabus}-${String(paperNumber).padStart(2, '0')}` : null,
  session: session ?? null,
  year: year ? Number(year) : null,
  resourceType,
  access: ACCESS_BY_TYPE[resourceType],
})

const parsePaperName = (name, { subject = '', subjectCode = '', pathway: pathwayOption = 'IGCSE' } = {}) => {
  const fileName = path.basename(String(name || '').trim())
  const topicFile = fileName.match(TOPIC_FILE_PATTERN)
  if (topicFile) {
    const [, schoolYear, topicLabel] = topicFile
    const pathway = PATHWAYS[String(pathwayOption).toUpperCase().replace(/[^A-Z]/g, '')]
    const syllabus = String(subjectCode || '0607')
    const subjectName = SUBJECTS[String(subject).toUpperCase().replace(/\s+/g, '')] || String(subject || 'MATHEMATICS').trim().toUpperCase()
    const topic = `Year ${schoolYear} - ${topicLabel.replace(/_/g, ' ').trim()}`
    if (!pathway) return null
    return {
      ...finishParsedPaper({ pathway, subjectName, syllabus, resourceType: 'topic-practice' }),
      title: `${pathway}-${subjectName} - ${syllabus} - Topic - ${topic}`,
      paperType: 'topic-wise',
      topic,
    }
  }

  const topicTitle = fileName.match(TOPIC_TITLE_PATTERN)
  if (topicTitle) {
    const [, pathwayToken, syllabus, topic] = topicTitle
    const pathwayLabel = pathwayToken.match(/^(?:IGCSE|AS\s*&\s*A\s*Level|AS|A\s*Level|SAT\s*[/&-]?\s*ACT|IBDP|MYP)/i)?.[0]
    const pathway = PATHWAYS[pathwayLabel?.toUpperCase().replace(/[^A-Z]/g, '')]
    const subjectName = pathwayToken.slice(pathwayLabel.length).replace(/^-/, '').trim().toUpperCase()
    if (!pathway || !subjectName) return null
    return {
      ...finishParsedPaper({ pathway, subjectName, syllabus, resourceType: 'topic-practice' }),
      paperType: 'topic-wise',
      topic,
    }
  }

  const caieMatch = fileName.match(CAIE_NAME_PATTERN)
  if (caieMatch) {
    const [, syllabus, sessionCode, shortYear, type, paperNumber, solvedSuffix] = caieMatch
    const session = ({ m: 'Feb-March', s: 'May-June', w: 'Oct-Nov' })[sessionCode.toLowerCase()]
    const resourceType = solvedSuffix ? 'solved-question-paper' : RESOURCE_TYPES[type.toLowerCase()]
    if (!session || !resourceType) return null
    const year = `20${shortYear}`
    const subjectName = SUBJECTS[String(subject).toUpperCase().replace(/\s+/g, '')] || String(subject || '').trim().toUpperCase()
    const pathway = PATHWAYS[String(pathwayOption).toUpperCase().replace(/[^A-Z]/g, '')]
    if (!subjectName || !pathway) return null
    return finishParsedPaper({ pathway, subjectName, syllabus, paperNumber, session, year, resourceType })
  }

  const yearFirstMatch = fileName.match(YEAR_FIRST_NAME_PATTERN)
  if (yearFirstMatch) {
    const [, year, sessionToken, rawSubject, syllabus, label = ''] = yearFirstMatch
    const pathway = PATHWAYS[String(pathwayOption).toUpperCase().replace(/[^A-Z]/g, '')]
    const session = normalizeSession(sessionToken)
    const resourceType = resourceTypeFromLabel(label)
    const subjectName = SUBJECTS[rawSubject.trim().toUpperCase().replace(/\s+/g, '')] || rawSubject.trim().toUpperCase()
    const paperNumber = label.match(/\bPaper\s*(\d{1,2})\b/i)?.[1] || null
    if (!pathway || !session || !subjectName) return null
    return finishParsedPaper({ pathway, subjectName, syllabus, paperNumber, session, year, resourceType })
  }

  const normalizedMatch = fileName.match(NORMALIZED_NAME_PATTERN)
  if (!normalizedMatch) return null
  const [, serial, pathwayToken, syllabus, paperNumber, sessionToken, year, label = ''] = normalizedMatch
  const pathwayLabel = pathwayToken.match(/^(?:IGCSE|AS\s*&\s*A\s*Level|AS|A\s*Level|SAT\s*[/&-]?\s*ACT|IBDP|MYP)/i)?.[0]
  const pathwayKey = pathwayLabel?.toUpperCase().replace(/[^A-Z]/g, '')
  const pathway = PATHWAYS[pathwayKey]
  const session = normalizeSession(sessionToken)
  const resourceType = resourceTypeFromLabel(label)
  if (!pathway || !session || !ACCESS_BY_TYPE[resourceType]) return null
  const subjectToken = pathwayToken.slice(pathwayLabel.length).replace(/^-/, '').trim()
  const subjectKey = subjectToken.toUpperCase().replace(/\s+/g, '')
  const subjectName = SUBJECTS[subjectKey] || subjectToken.toUpperCase()
  return finishParsedPaper({ serial: serial ? Number(serial) : null, pathway, subjectName, syllabus, paperNumber, session, year, resourceType })
}

const paperKey = (paper) => [paper.pathway, paper.syllabus, paper.paperType === 'topic-wise' ? paper.topic : paper.paperNumber || '', paper.session, paper.year, paper.resourceType].join('|')
const paperCodeOf = (text) => String(text || '').match(/\b(\d{4})[-/](\d{2})\b/)?.[0]?.replace('/', '-') || null
const md5Base64 = (buffer) => crypto.createHash('md5').update(buffer).digest('base64')

// Reads the first pages and checks the printed paper code and session match the file name.
const verifyPdfContent = async (buffer, parsed) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false, disableFontFace: true })
  let text = ''
  try {
    const pdf = await loadingTask.promise
    for (let page = 1; page <= Math.min(pdf.numPages, 2); page += 1) {
      const content = await (await pdf.getPage(page)).getTextContent()
      text += ` ${content.items.map((item) => item.str).join(' ')}`
    }
  } catch (error) {
    return { status: 'unreadable', detail: `PDF could not be read: ${error.message}` }
  } finally {
    await loadingTask.destroy()
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
  const args = { upload: false, overwrite: false, force: false, contentCheck: true, adminEmail: process.env.ADMIN_EMAIL || 'admin@philomathean.in', project: process.env.GCLOUD_PROJECT || DEFAULT_PROJECT, bucket: process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET, report: 'past-paper-upload-report.csv', subject: '', pathway: 'IGCSE', subjectCode: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const next = () => argv[++index]
    if (flag === '--dir') args.dir = next()
    else if (flag === '--upload') args.upload = true
    else if (flag === '--overwrite') args.overwrite = true
    else if (flag === '--force') args.force = true
    else if (flag === '--skip-content-check') args.contentCheck = false
    else if (flag === '--subject') args.subject = next()
    else if (flag === '--subject-code') args.subjectCode = next()
    else if (flag === '--pathway') args.pathway = next()
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
  --overwrite            Replace the matching existing paper and its PDF
  --subject <name>       Subject name for CAIE-style file names (e.g. Mathematics)
  --subject-code <code>  Syllabus code for CAIE-style file names (e.g. 0607)
  --pathway <pathway>    Pathway for CAIE-style file names (default IGCSE)
  --force                Upload even when printed paper details contradict the file name
  --skip-content-check   Do not read PDF text
  --admin-email <email>  Account recorded as createdBy (default admin@philomathean.in)
  --report <file.csv>    Where to write the report (default past-paper-upload-report.csv)
  --project / --bucket   Firebase project id and Storage bucket

Credentials: set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON key.`

const loadExisting = async (db, bucket, targetSyllabi, options = {}) => {
  const snapshot = await db.collection('pastPaperResources').get()
  const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  await Promise.all(records.map(async (record) => {
    record.parsed = parsePaperName(record.title, options) || parsePaperName(record.fileName, options)
    if (record.contentMd5) return
    if (!targetSyllabi.has(record.parsed?.syllabus)) return
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

const run = async (overrides = {}) => {
  const args = parseArgs(process.argv.slice(2))
  Object.assign(args, overrides)
  if (args.help || !args.dir) { console.log(usage); if (!args.help) process.exitCode = 1; return }
  const folder = path.resolve(args.dir)
  const files = fs.readdirSync(folder).filter((name) => /\.pdf$/i.test(name) && !/\.cleaned\.pdf$/i.test(name))
  console.log(`${args.upload ? 'UPLOAD' : 'DRY RUN'}: ${files.length} PDF files in ${folder}`)
  const entries = files.map((fileName) => ({ fileName, parsed: parsePaperName(fileName, args) })).sort((a, b) => (a.parsed?.serial ?? Infinity) - (b.parsed?.serial ?? Infinity) || a.fileName.localeCompare(b.fileName))
  const targetSyllabi = new Set(entries.map(({ parsed }) => parsed?.syllabus).filter(Boolean))
  const parsedKeys = new Map()
  for (const { fileName, parsed } of entries) {
    if (!parsed) continue
    const key = paperKey(parsed)
    if (parsedKeys.has(key)) throw new Error(`Ambiguous input: "${parsedKeys.get(key)}" and "${fileName}" describe the same ${parsed.resourceType} record.`)
    parsedKeys.set(key, fileName)
  }

  let admin
  let db
  let bucket
  let FieldValue
  let getDownloadURL
  let existing = { records: [], byMd5: new Map(), issues: [] }
  if (args.upload) {
    admin = require('firebase-admin')
    ;({ getDownloadURL } = require('firebase-admin/storage'))
    if (!admin.apps.length) admin.initializeApp({ projectId: args.project, storageBucket: args.bucket })
    db = admin.firestore()
    bucket = admin.storage().bucket()
    ;({ FieldValue } = admin.firestore)
    existing = await loadExisting(db, bucket, targetSyllabi, args)
    console.log(`Firebase already has ${existing.records.length} past papers`)
    if (existing.issues.length) { console.log('\nProblems found in papers already uploaded:'); existing.issues.forEach((issue) => console.log(`  ! ${issue}`)) }
  }
  const recordsByKey = new Map()
  const ambiguousExisting = new Set()
  for (const record of existing.records) {
    if (!record.parsed) continue
    const key = paperKey(record.parsed)
    if (recordsByKey.has(key)) ambiguousExisting.add(key)
    else recordsByKey.set(key, record)
  }

  let createdBy = 'bulk-upload-script'
  if (args.upload) {
    try { createdBy = (await admin.auth().getUserByEmail(args.adminEmail)).uid } catch { console.log(`Note: ${args.adminEmail} not found in Auth; recording createdBy as "${createdBy}"`) }
  }

  const rows = []
  const seenKeys = new Map()
  for (const { fileName, parsed } of entries) {
    const row = { fileName, title: parsed?.title || '', status: '', detail: '' }
    rows.push(row)
    const report = (status, detail) => { row.status = status; row.detail = detail; console.log(`${status.padEnd(18)} ${fileName}${detail ? `\n${' '.repeat(19)}${detail}` : ''}`) }
    if (!parsed) { report('SKIP bad-name', 'Unrecognized paper filename; use the supported CAIE or descriptive filename format.'); continue }

    const buffer = fs.readFileSync(path.join(folder, fileName))
    if (buffer.length > MAX_PDF_BYTES) { report('SKIP too-large', `${(buffer.length / 1048576).toFixed(1)} MB, limit is 25 MB`); continue }
    if (buffer.subarray(0, 5).toString() !== '%PDF-') { report('SKIP not-pdf', 'File does not start with a PDF header'); continue }
    const md5 = md5Base64(buffer)
    const key = paperKey(parsed)
    if (ambiguousExisting.has(key)) { report('SKIP ambiguous', 'Multiple existing records match; resolve duplicates before uploading.'); continue }
    const sameKey = recordsByKey.get(key)
    if (sameKey && !args.overwrite) { report('SKIP exists', `Already uploaded as "${sameKey.title}"; pass --overwrite to replace it.`); continue }
    if (seenKeys.has(key)) { report('SKIP duplicate', `Same paper as "${seenKeys.get(key)}" in this folder`); continue }

    let check = { status: 'skipped', detail: 'Content check disabled' }
    if (args.contentCheck && parsed.paperCode) check = await verifyPdfContent(buffer, parsed)
    if ((check.status === 'mismatch' || check.status === 'unreadable') && !args.force) { report('SKIP content', check.detail); continue }
    seenKeys.set(key, fileName)

    const known = existing.records.find((record) => record.pathway === parsed.pathway && record.parsed?.syllabus === parsed.syllabus)
    const subjectName = known?.subjectName || parsed.subjectName
    const subjectCode = known?.subjectCode || parsed.subjectCode
    const fields = {
      title: parsed.title,
      pathway: parsed.pathway,
      subjectName,
      subjectCode: subjectCode || null,
      subject: `${subjectName}${subjectCode ? ` ${subjectCode}` : ''}`,
      paperType: parsed.paperType || 'year-wise',
      resourceType: parsed.resourceType,
      year: parsed.year,
      session: parsed.session,
      topic: parsed.topic || null,
      access: parsed.access,
    }

    if (!args.upload) { report('WOULD UPLOAD', `${fields.pathway} · ${fields.subject} · ${parsed.year} ${parsed.session} · ${parsed.resourceType} · ${parsed.access} · ${check.detail}`); continue }

    const paperRef = sameKey ? db.collection('pastPaperResources').doc(sameKey.id) : db.collection('pastPaperResources').doc()
    const version = sameKey ? (Number(sameKey.version) || 1) + 1 : 1
    const previousFilePath = sameKey?.filePath || null
    const filePath = sameKey
      ? `past-papers/${paperRef.id}/current-v${version}.pdf`
      : `past-papers/${paperRef.id}/current.pdf`
    const file = bucket.file(filePath)
    let committed = false
    try {
      await file.save(buffer, { resumable: false, contentType: 'application/pdf', metadata: { contentType: 'application/pdf', metadata: { access: parsed.access, published: 'true' } } })
      const freeDownloadUrl = parsed.access === 'free' ? `${await getDownloadURL(file)}#toolbar=1&navpanes=0&view=FitH` : null
      const batch = db.batch()
      const timestamp = FieldValue.serverTimestamp()
      batch.set(paperRef, { ...fields, filePath, fileName, fileSize: buffer.length, contentType: 'application/pdf', contentMd5: md5, status: 'published', published: true, version, createdBy: sameKey?.createdBy || createdBy, updatedBy: createdBy, ...(sameKey ? {} : { createdAt: timestamp }), updatedAt: timestamp })
      batch.set(db.collection('publicPastPapers').doc(paperRef.id), { ...fields, freeDownloadUrl, status: 'published', published: true, previewAvailable: false, resourceId: paperRef.id, version, updatedAt: timestamp })
      await batch.commit()
      committed = true
      if (previousFilePath && previousFilePath !== filePath) {
        await bucket.file(previousFilePath).delete({ ignoreNotFound: true }).catch((error) => {
          console.warn(`Could not remove replaced file "${previousFilePath}": ${error.message}`)
        })
      }
      report(sameKey ? 'OVERWRITTEN' : 'UPLOADED', `${fields.title} · ${parsed.access} · ${check.detail}`)
    } catch (error) {
      if (!committed) await file.delete({ ignoreNotFound: true }).catch(() => {})
      report('FAILED', error.message)
    }
  }

  const counts = rows.reduce((totals, row) => ({ ...totals, [row.status]: (totals[row.status] || 0) + 1 }), {})
  fs.writeFileSync(args.report, ['file,title,status,detail', ...rows.map((row) => [row.fileName, row.title, row.status, row.detail].map(csvCell).join(','))].join('\n'))
  console.log('\nSummary:', Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(', ') || 'nothing to do')
  console.log(`Report written to ${path.resolve(args.report)}`)
  if (!args.upload && counts['WOULD UPLOAD']) console.log('Dry run only. Re-run with --upload to upload the files marked WOULD UPLOAD.')
}

module.exports = { parsePaperName, paperKey, verifyPdfContent, ACCESS_BY_TYPE }

if (require.main === module) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => { const admin = require('firebase-admin'); if (admin.apps.length) admin.app().delete() })
}
