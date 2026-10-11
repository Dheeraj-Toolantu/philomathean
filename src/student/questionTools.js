// Pure helpers for admin-managed questions: validation, CSV import and merging with the built-in banks.
// No Firebase here, so they are unit-tested directly.
import { BANKS } from './questionBank.js'

export const MAX_OPTIONS = 6
export const LETTERS = 'ABCDEF'
export const newQuestionId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const blankQuestion = () => ({ id: newQuestionId(), prompt: '', options: ['', '', '', ''], answer: 0, explain: '', difficulty: 2, prediction: false, hidden: false, imageUrl: '', imagePath: '' })

// Returns { field: message } for anything wrong; an empty object means the question can be saved.
export const validateQuestion = (question) => {
  const errors = {}
  const options = (question.options || []).map((option) => String(option ?? '').trim())
  if (!String(question.prompt || '').trim()) errors.prompt = 'Write the question.'
  else if (question.prompt.length > 2000) errors.prompt = 'Keep the question under 2000 characters.'
  if (options.length < 2 || options.length > MAX_OPTIONS) errors.options = `Give between 2 and ${MAX_OPTIONS} answer options.`
  else if (options.some((option) => !option)) errors.options = 'Fill in every answer option (or remove the empty one).'
  else if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) errors.options = 'Answer options must all be different.'
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= options.length) errors.answer = 'Choose the correct answer.'
  if (![1, 2, 3].includes(Number(question.difficulty))) errors.difficulty = 'Choose a difficulty.'
  if (String(question.explain || '').length > 2000) errors.explain = 'Keep the explanation under 2000 characters.'
  return errors
}

// Trims text and keeps only known fields, so what is saved to Firestore is always the same shape.
export const cleanQuestion = (question) => ({
  id: question.id || newQuestionId(),
  prompt: String(question.prompt || '').trim(),
  options: (question.options || []).map((option) => String(option ?? '').trim()),
  answer: Number(question.answer),
  explain: String(question.explain || '').trim(),
  difficulty: Number(question.difficulty) || 2,
  prediction: Boolean(question.prediction),
  hidden: Boolean(question.hidden),
  imageUrl: question.imageUrl || '',
  imagePath: question.imagePath || '',
})

export const builtInQuestions = (bankId) => (BANKS[bankId] || []).map((question, index) => cleanQuestion({ ...question, id: `${bankId}-${index}` }))

// Built-in banks, with every bank an administrator manages replacing its built-in version.
// Hidden questions are left out for students.
export const mergeBanks = (managed = {}) => {
  const merged = { ...BANKS }
  for (const [bankId, bank] of Object.entries(managed)) merged[bankId] = (bank.questions || []).filter((question) => !question.hidden)
  return merged
}

// Minimal RFC 4180 CSV parser (quoted fields, commas and newlines inside quotes, "" escapes).
export const parseCsv = (text) => {
  const rows = []
  let row = [], field = '', quoted = false
  const source = String(text).replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1 } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(field); rows.push(row); row = []; field = ''
    } else field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

export const CSV_TEMPLATE = 'question,option_a,option_b,option_c,option_d,correct,explanation,difficulty\n"Solve 2x + 3 = 11.",4,3,7,8,A,"2x = 8, so x = 4.",1\n'

// Columns: question, option_a … option_f (any number ≥ 2), correct (letter), explanation, difficulty (1–3).
// Returns { questions, errors: ['Row 3: …'] }.
export const questionsFromCsv = (text) => {
  const rows = parseCsv(text)
  if (!rows.length) return { questions: [], errors: ['The file is empty.'] }
  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const col = (name) => header.indexOf(name)
  const optionCols = header.map((name, index) => (/^option_[a-f]$/.test(name) ? index : -1)).filter((index) => index >= 0)
  if (col('question') < 0 || col('correct') < 0 || optionCols.length < 2) return { questions: [], errors: ['The first row must be a header with question, option_a, option_b, …, correct, explanation, difficulty. Download the template to start.'] }
  const questions = []
  const errors = []
  rows.slice(1).forEach((cells, index) => {
    const options = optionCols.map((column) => (cells[column] || '').trim()).filter(Boolean)
    const letter = (cells[col('correct')] || '').trim().toUpperCase()
    const difficulty = Number((cells[col('difficulty')] || '2').trim()) || 2
    const question = cleanQuestion({ prompt: cells[col('question')], options, answer: /^[A-F]$/.test(letter) ? LETTERS.indexOf(letter) : -1, explain: col('explanation') >= 0 ? cells[col('explanation')] : '', difficulty })
    const problems = validateQuestion(question)
    if (Object.keys(problems).length) errors.push(`Row ${index + 2}: ${Object.values(problems).join(' ')}`)
    else questions.push(question)
  })
  return { questions, errors }
}
