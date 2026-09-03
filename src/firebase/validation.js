export const SUPPORTED_PATHWAYS = ['IGCSE', 'AS & A Level', 'SAT / ACT', 'IBDP', 'MYP']
export const PAPER_ACCESS = ['free', 'premium']
export const MAX_PDF_BYTES = 25 * 1024 * 1024

export const validateResult = (values) => {
  const errors = {}
  for (const field of ['studentName', 'score', 'subjects', 'school']) if (!values[field]?.trim()) errors[field] = 'This field is required.'
  if (values.score?.trim() && !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(values.score.trim())) errors.score = 'Use a score format such as 45/45.'
  return errors
}

export const validatePaper = (values, file) => {
  const errors = {}
  if (!values.title?.trim()) errors.title = 'A title is required.'
  if (!values.subject?.trim()) errors.subject = 'A subject is required.'
  if (!SUPPORTED_PATHWAYS.includes(values.pathway)) errors.pathway = 'Choose a supported pathway.'
  if (!PAPER_ACCESS.includes(values.access)) errors.access = 'Choose a paper permission.'
  if (!file && !values.filePath) errors.file = 'Choose a PDF file.'
  if (file && file.type !== 'application/pdf') errors.file = 'Only PDF files are supported.'
  if (file && file.size > MAX_PDF_BYTES) errors.file = 'PDF files must be 25 MB or smaller.'
  return errors
}
