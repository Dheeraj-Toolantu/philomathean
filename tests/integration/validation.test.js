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
  assert.deepEqual(validatePaper({ title: 'Mathematics 2025', pathway: 'IGCSE', subject: 'Mathematics', access: 'free' }, { type: 'application/pdf', size: 1024 }), {})
})

test('unsupported pathways and files are rejected', () => {
  const errors = validatePaper({ title: 'Resource', pathway: 'Unknown', subject: 'Science' }, { type: 'text/plain', size: 1024 })
  assert.equal(errors.pathway, 'Choose a supported pathway.')
  assert.equal(errors.file, 'Only PDF files are supported.')
})

test('oversized PDFs are rejected', () => {
  const errors = validatePaper({ title: 'Resource', pathway: 'MYP', subject: 'Science' }, { type: 'application/pdf', size: 26 * 1024 * 1024 })
  assert.equal(errors.file, 'PDF files must be 25 MB or smaller.')
})
