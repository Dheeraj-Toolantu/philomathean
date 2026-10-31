// Login IDs for accounts an administrator creates. Firebase email/password sign-in needs an email address,
// so a plain login ID such as "aarav.10b" is stored as "aarav.10b@<LOGIN_ID_DOMAIN>". That domain belongs to the
// Firebase project and never receives mail. A real email address entered as the login ID is used unchanged,
// which keeps "Forgot password?" emails working for that account.
export const LOGIN_ID_DOMAIN = 'login.philomathean-a2c93.firebaseapp.com'
const LOGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])?$/

export const normaliseLoginId = (value) => String(value ?? '').trim().toLowerCase()

// Returns an error message for an invalid login ID, or null when it can be used.
export const loginIdError = (value) => {
  const id = normaliseLoginId(value)
  if (!id) return 'Enter a login ID or email address.'
  if (id.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) ? null : 'Enter a valid email address.'
  return LOGIN_ID_PATTERN.test(id) && id.length >= 3 ? null : 'Use 3–40 letters, numbers, dots, dashes or underscores (no spaces), starting and ending with a letter or number.'
}

// The email Firebase signs this login ID in with.
export const loginIdToEmail = (value) => {
  const id = normaliseLoginId(value)
  return id.includes('@') ? id : `${id}@${LOGIN_ID_DOMAIN}`
}

// What to show people: the plain login ID for generated addresses, the email otherwise.
export const displayLoginId = (email = '') => {
  const value = String(email).toLowerCase()
  return value.endsWith(`@${LOGIN_ID_DOMAIN}`) ? value.slice(0, -LOGIN_ID_DOMAIN.length - 1) : value
}
export const isGeneratedLoginEmail = (email = '') => String(email).toLowerCase().endsWith(`@${LOGIN_ID_DOMAIN}`)

// A readable starting password (no 0/O or 1/l/I) that the administrator can hand over.
export const suggestPassword = (random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n) => {
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const pick = (set, count) => Array.from({ length: count }, () => set[random(set.length)]).join('')
  const word = pick(letters, 4)
  return `${word[0].toUpperCase()}${word.slice(1)}-${pick(digits, 4)}-${pick(letters, 3)}`
}
