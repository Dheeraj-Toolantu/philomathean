export const SUPPORTED_PATHWAYS = ['IGCSE', 'AS & A Level', 'SAT / ACT', 'IBDP', 'MYP']
export const PAPER_ACCESS = ['free', 'premium']
export const MAX_PDF_BYTES = 25 * 1024 * 1024
export const PAPER_TYPES = ['year-wise', 'topic-wise']
export const EXAM_SESSIONS = ['Feb-March', 'May-June', 'Oct-Nov']
const latestPaperYear = new Date().getFullYear() + 1
export const PAPER_YEARS = Array.from({ length: latestPaperYear - 2009 }, (_, index) => latestPaperYear - index)

export const validateResult = (values) => {
  const errors = {}
  for (const field of ['studentName', 'score', 'subjects', 'school']) if (!values[field]?.trim()) errors[field] = 'This field is required.'
  if (values.score?.trim() && !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(values.score.trim())) errors.score = 'Use a score format such as 45/45.'
  return errors
}

export const validatePaper = (values, file) => {
  const errors = {}
  if (!values.title?.trim()) errors.title = 'A title is required.'
  if (!values.subjectName?.trim()) errors.subjectName = 'A subject name is required.'
  if (!SUPPORTED_PATHWAYS.includes(values.pathway)) errors.pathway = 'Choose a supported pathway.'
  if (!PAPER_TYPES.includes(values.paperType)) errors.paperType = 'Choose a paper type.'
  if (values.paperType === 'year-wise') {
    if (!PAPER_YEARS.includes(Number(values.year))) errors.year = 'Choose a valid year.'
    if (!EXAM_SESSIONS.includes(values.session)) errors.session = 'Choose an exam session.'
  } else if (values.paperType === 'topic-wise' && !values.topic?.trim()) {
    errors.topic = 'A topic is required.'
  }
  if (!PAPER_ACCESS.includes(values.access)) errors.access = 'Choose a paper permission.'
  if (!file && !values.filePath) errors.file = 'Choose a PDF file.'
  if (file && file.type !== 'application/pdf') errors.file = 'Only PDF files are supported.'
  if (file && file.size > MAX_PDF_BYTES) errors.file = 'PDF files must be 25 MB or smaller.'
  return errors
}
