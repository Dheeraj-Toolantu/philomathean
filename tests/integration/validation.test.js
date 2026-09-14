import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePaper, validateResult } from '../../src/firebase/validation.js'

test('valid student results pass validation', () => {
  assert.deepEqual(validateResult({ studentName: 'A Student', score: '45/45', subjects: 'Maths (7)', school: 'Philomathean' }), {})
})

test('invalid student results return actionable field errors', () => {
  const errors = validateResult({ studentName: '', score: 'excellent', subjects: '', school: '' })
  assert.equal(errors.studentName, 'This field is required.')
  assert.equal(errors.score, 'Use a score format such as 45/45.')
  assert.equal(errors.subjects, 'This field is required.')
  assert.equal(errors.school, 'This field is required.')
})

test('valid past-paper metadata and PDF pass validation', () => {
  assert.deepEqual(validatePaper({ title: 'Mathematics 2025', pathway: 'IGCSE', subjectName: 'Mathematics', subjectCode: '0580', paperType: 'year-wise', year: 2025, session: 'May-June', access: 'free' }, { type: 'application/pdf', size: 1024 }), {})
})

test('valid topic-wise past-paper metadata passes validation', () => {
  assert.deepEqual(validatePaper({ title: 'Algebra Practice', pathway: 'IGCSE', subjectName: 'Mathematics', subjectCode: '0580', paperType: 'topic-wise', topic: 'Algebra', access: 'premium' }, { type: 'application/pdf', size: 1024 }), {})
})

test('unsupported pathways and files are rejected', () => {
  const errors = validatePaper({ title: 'Resource', pathway: 'Unknown', subjectName: 'Science', paperType: 'year-wise', year: 2025, session: 'May-June' }, { type: 'text/plain', size: 1024 })
  assert.equal(errors.pathway, 'Choose a supported pathway.')
  assert.equal(errors.file, 'Only PDF files are supported.')
})

test('missing year, session, or topic details are rejected', () => {
  const errors = validatePaper({ title: 'Resource', pathway: 'MYP', subjectName: 'Science', paperType: 'year-wise' }, { type: 'application/pdf', size: 1024 })
  assert.equal(errors.year, 'Choose a valid year.')
  assert.equal(errors.session, 'Choose an exam session.')
})

test('oversized PDFs are rejected', () => {
  const errors = validatePaper({ title: 'Resource', pathway: 'MYP', subjectName: 'Science', paperType: 'year-wise', year: 2025, session: 'May-June' }, { type: 'application/pdf', size: 26 * 1024 * 1024 })
  assert.equal(errors.file, 'PDF files must be 25 MB or smaller.')
})
