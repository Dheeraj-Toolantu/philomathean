import test from 'node:test'
import assert from 'node:assert/strict'
import { facultyEntryFor, ratingPath, ratingShareText, ratingUrl, whatsappShareUrl } from '../../src/teacher/ratingLinks.js'

const teacher = { id: 'abc123XYZ', name: 'Pawan Yadav', subjects: 'Mathematics (IGCSE & A Levels)' }
const origin = 'https://philomathean.in'

test('rating links point at /rate/{teacherUid}', () => {
  assert.equal(ratingPath('abc123XYZ'), '/rate/abc123XYZ')
  assert.equal(ratingUrl('abc123XYZ', origin), 'https://philomathean.in/rate/abc123XYZ')
})

test('the WhatsApp share opens wa.me with the teacher name and rating link', () => {
  const text = ratingShareText(teacher, origin)
  assert.match(text, /Pawan Yadav/)
  assert.match(text, /student account/)
  assert.ok(text.endsWith('https://philomathean.in/rate/abc123XYZ'))
  const url = new URL(whatsappShareUrl(teacher, origin))
  assert.equal(url.origin, 'https://wa.me')
  assert.equal(url.searchParams.get('text'), text)
})

test('teacher accounts are matched to their public faculty profile by name', () => {
  assert.equal(facultyEntryFor('Pawan Yadav')?.[0], 'Pawan Yadav')
  assert.equal(facultyEntryFor('  pawan  yadav ')?.[0], 'Pawan Yadav')
  assert.equal(facultyEntryFor('Satish Sir')?.[0], 'Satish Vishwakarma', 'a unique first name is enough')
  assert.equal(facultyEntryFor('Someone New'), null)
  assert.equal(facultyEntryFor(''), null)
})
