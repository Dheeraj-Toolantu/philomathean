import test from 'node:test'
import assert from 'node:assert/strict'
import { accountRole, destinationFor, homeFor, isStaffRole, isStudentPath, isTeacherPath } from '../../src/portal/roles.js'

test('account roles: admin over teacher over student; a pending teacher request counts as teacher', () => {
  assert.equal(accountRole({ admin: true, teacher: true }), 'admin')
  assert.equal(accountRole({ teacher: true }), 'teacher')
  assert.equal(accountRole({ teacherRequest: true }), 'teacher')
  assert.equal(accountRole({}), 'student')
  assert.equal(isStaffRole('teacher'), true)
  assert.equal(isStaffRole('admin'), true)
  assert.equal(isStaffRole('student'), false)
})

test('student and teacher pages are told apart', () => {
  for (const path of ['/dashboard', '/dashboard?tab=report', '/courses', '/courses/igcse-0607-core', '/quiz?course=x&quiz=y']) assert.ok(isStudentPath(path), path)
  for (const path of ['/teacher', '/teacher?tab=remedial']) assert.ok(isTeacherPath(path), path)
  for (const path of ['/teachers', '/teachers/satish-sir', '/dashboards', '/', '/past-papers']) assert.ok(!isStudentPath(path) && !isTeacherPath(path), path)
})

test('after sign-in each account lands in its own portal', () => {
  assert.equal(homeFor('student'), '/dashboard')
  assert.equal(homeFor('teacher'), '/teacher')
  assert.equal(destinationFor('teacher', ''), '/teacher')
  assert.equal(destinationFor('student', ''), '/dashboard')
  // A requested page from the other portal is ignored.
  assert.equal(destinationFor('teacher', '/dashboard?tab=report'), '/teacher')
  assert.equal(destinationFor('teacher', '/quiz?course=a&quiz=b'), '/teacher')
  assert.equal(destinationFor('student', '/teacher?tab=tests'), '/dashboard')
  assert.equal(destinationFor('admin', '/courses'), '/teacher')
  // Pages that belong to the account (or to everyone) are kept.
  assert.equal(destinationFor('student', '/courses/igcse-0607-core'), '/courses/igcse-0607-core')
  assert.equal(destinationFor('teacher', '/teacher?tab=remedial'), '/teacher?tab=remedial')
  assert.equal(destinationFor('teacher', '/past-papers'), '/past-papers')
})
