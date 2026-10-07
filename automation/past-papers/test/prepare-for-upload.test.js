import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { prepare, uploadName } from '../prepare-for-upload.js'

const require = createRequire(import.meta.url)
const { parsePaperName } = require('../../../functions/scripts/bulk-upload-past-papers.cjs')

test('renames question papers into the bulk uploader format', () => {
  const name = uploadName('0452_s23_qp_12.pdf', { subject: 'Accounting' })
  assert.equal(name, 'IGCSE-ACCOUNTING - 0452-12 - May-June 2023.pdf')
  const parsed = parsePaperName(name)
  assert.equal(parsed.paperCode, '0452-12')
  assert.equal(parsed.session, 'May-June')
  assert.equal(parsed.year, 2023)
  assert.equal(parsed.pathway, 'IGCSE')
  assert.equal(parsePaperName(uploadName('0452_m19_qp_22.pdf', { subject: 'Accounting' })).session, 'Feb-March')
  assert.equal(parsePaperName(uploadName('0452_w20_qp_21.pdf', { subject: 'Accounting' })).session, 'Oct-Nov')
})

test('leaves out mark schemes, examiner reports and specimen papers', async () => {
  for (const name of ['0452_s23_ms_12.pdf', '0452_s23_er.pdf', '0452_y25_sp_1.pdf', '0452_s23_in_12.pdf']) assert.equal(uploadName(name, { subject: 'Accounting' }), null)
  const source = await mkdtemp(path.join(tmpdir(), 'src-'))
  const staging = path.join(await mkdtemp(path.join(tmpdir(), 'stage-')), 'out')
  await Promise.all(['0452_s23_qp_12.pdf', '0452_s23_ms_12.pdf', 'manifest.json'].map((name) => writeFile(path.join(source, name), '%PDF-1.4')))
  const { copied, skipped } = await prepare(source, staging, { subject: 'Accounting' })
  assert.equal(copied.length, 1)
  assert.deepEqual(skipped, ['0452_s23_ms_12.pdf'])
  assert.deepEqual(await readdir(staging), ['IGCSE-ACCOUNTING - 0452-12 - May-June 2023.pdf'])
})
