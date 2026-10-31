import test from 'node:test'
import assert from 'node:assert/strict'
import { displayLoginId, isGeneratedLoginEmail, LOGIN_ID_DOMAIN, loginIdError, loginIdToEmail, suggestPassword } from '../../src/firebase/loginId.js'

test('plain login IDs map to a project-owned email; real emails are kept', () => {
  assert.equal(loginIdToEmail(' Aarav.Mehta '), `aarav.mehta@${LOGIN_ID_DOMAIN}`)
  assert.equal(loginIdToEmail('Pawan@Example.com'), 'pawan@example.com')
  assert.equal(displayLoginId(`aarav.mehta@${LOGIN_ID_DOMAIN}`), 'aarav.mehta')
  assert.equal(displayLoginId('pawan@example.com'), 'pawan@example.com')
  assert.equal(isGeneratedLoginEmail(loginIdToEmail('ab1')), true)
  assert.equal(isGeneratedLoginEmail('pawan@example.com'), false)
})

test('login IDs are validated', () => {
  for (const ok of ['aarav.mehta', 'grade10_b-07', 'abc', 'pawan@example.com']) assert.equal(loginIdError(ok), null, ok)
  for (const bad of ['', 'ab', 'has space', '.dot', 'dash-', 'a'.repeat(41), 'bad@email']) assert.ok(loginIdError(bad), bad)
})

test('suggested passwords are long enough and readable', () => {
  const password = suggestPassword()
  assert.ok(password.length >= 12)
  assert.match(password, /^[A-Z][a-z]{3}-[2-9]{4}-[a-z]{3}$/)
  assert.doesNotMatch(password, /[01lIoO]/)
})
