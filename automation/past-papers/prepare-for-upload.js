// Copies downloaded CAIE question papers (e.g. 0452_s23_qp_12.pdf) into a staging folder under the
// names functions/scripts/bulk-upload-past-papers.cjs expects
// (e.g. "IGCSE-ACCOUNTING - 0452-12 - May-June 2023.pdf"). Files are copied unchanged.
// Mark schemes, examiner reports, inserts and specimen papers are left out because the website
// stores one PDF per paper code, session and year.
//
// Usage: node prepare-for-upload.js <download dir> <staging dir> [--pathway IGCSE] [--subject ACCOUNTING]
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SESSIONS = { m: 'February-March', s: 'May-June', w: 'October-November' }
const CAIE_NAME = /^(\d{4})_([msw])(\d{2})_qp_(\d{2})\.pdf$/i

export const uploadName = (fileName, { pathway = 'IGCSE', subject }) => {
  const match = fileName.match(CAIE_NAME)
  if (!match) return null
  const [, syllabus, session, year, variant] = match
  const subjectToken = String(subject).toUpperCase().replace(/[^A-Z& ]+/g, ' ').trim()
  return `${pathway}-${subjectToken} - ${syllabus}-${variant} - ${SESSIONS[session.toLowerCase()]} 20${year}.pdf`
}

export const prepare = async (sourceDir, stagingDir, options) => {
  await mkdir(stagingDir, { recursive: true })
  const copied = []
  const skipped = []
  for (const fileName of (await readdir(sourceDir)).filter((name) => /\.pdf$/i.test(name)).sort()) {
    const target = uploadName(fileName, options)
    if (!target) {
      skipped.push(fileName)
      continue
    }
    await copyFile(path.join(sourceDir, fileName), path.join(stagingDir, target))
    copied.push({ from: fileName, to: target })
  }
  return { copied, skipped }
}

const parseArgs = (argv) => {
  const [sourceDir, stagingDir, ...rest] = argv
  const options = { pathway: 'IGCSE', subject: process.env.SEARCH_TERM || 'Accounting' }
  for (let index = 0; index < rest.length; index += 2) {
    if (rest[index] === '--pathway') options.pathway = rest[index + 1]
    else if (rest[index] === '--subject') options.subject = rest[index + 1]
    else throw new Error(`Unknown option ${rest[index]}`)
  }
  if (!sourceDir || !stagingDir) throw new Error('Usage: node prepare-for-upload.js <download dir> <staging dir> [--pathway IGCSE] [--subject ACCOUNTING]')
  return { sourceDir, stagingDir, options }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { sourceDir, stagingDir, options } = parseArgs(process.argv.slice(2))
    const { copied, skipped } = await prepare(sourceDir, stagingDir, options)
    copied.forEach(({ from, to }) => console.log(`${from} -> ${to}`))
    console.log(`Prepared ${copied.length} question paper(s); left out ${skipped.length} other file(s).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
