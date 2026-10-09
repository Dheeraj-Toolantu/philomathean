// Turns stored past-paper records into the labels and groups students browse by.
export const PATHWAYS = [
  { id: 'IGCSE', title: 'IGCSE', board: 'Cambridge', description: 'Cambridge International past papers, mark schemes and revision support for core subjects.' },
  { id: 'AS & A Level', title: 'AS & A Level', board: 'Cambridge', description: 'Exam-focused past papers to strengthen preparation across advanced-level subjects.' },
  { id: 'SAT / ACT', title: 'SAT / ACT', board: 'College admissions', description: 'Practice tests and structured preparation for international college admissions.' },
  { id: 'IBDP', title: 'IBDP', board: 'IB Diploma', description: 'Past papers and focused revision for the International Baccalaureate Diploma Programme.' },
  { id: 'MYP', title: 'MYP', board: 'IB Middle Years', description: 'Subject resources and practice material for the IB Middle Years Programme.' },
]
export const SESSION_ORDER = ['Feb-March', 'May-June', 'Oct-Nov']
export const SESSION_LABELS = { 'Feb-March': 'February / March', 'May-June': 'May / June', 'Oct-Nov': 'October / November' }

const titleCase = (text) => String(text || '').toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())

// Cambridge syllabus codes are 0xxx (IGCSE / O Level) or 9xxx (AS & A Level); never a 19xx/20xx year.
const syllabusCode = (text) => String(text || '').match(/\b([09]\d{3})\b/)?.[1] || ''

// Understands both title styles admins use:
//   "IGCSE-MATHS - 0607-21 - May-June 2017 - Mark Scheme"        -> Paper 2 · Variant 1, code 0607/21
//   "IGCSE Physics 0625 – May-June 2026 – Question Paper 13"      -> Paper 1 · Variant 3, code 0625/13
export const describePaper = (paper) => {
  const title = String(paper.title || '')
  const subjectCode = String(paper.subjectCode || '') || syllabusCode(title)
  const joined = title.match(/\b(\d{4})[-/](\d)(\d)\b/)
  const labelled = title.match(/\b(?:question\s*paper|mark\s*scheme|qp|ms)[\s_-]*(\d)(\d)\b/i)
  const code = joined ? { syllabus: joined[1], number: joined[2], variant: joined[3] }
    : labelled ? { syllabus: subjectCode, number: labelled[1], variant: labelled[2] } : null
  const kind = /mark\s*scheme|\bms\b/i.test(title) ? 'mark-scheme' : 'question-paper'
  const name = paper.paperType === 'topic-wise' ? (paper.topic || title)
    : code ? `Paper ${code.number} · Variant ${code.variant}` : title
  const subjectName = titleCase(paper.subjectName || paper.subject || 'General')
  return {
    ...paper,
    kind,
    name,
    code: code ? `${code.syllabus ? `${code.syllabus}/` : ''}${code.number}${code.variant}` : subjectCode,
    paperNumber: code ? Number(code.number) : 99,
    variant: code ? Number(code.variant) : 99,
    subjectCode,
    subjectLabel: subjectName,
    subjectKey: `${subjectName.toUpperCase()}|${subjectCode}`,
  }
}

// One entry per exam paper: its question paper and mark scheme side by side, the way students revise.
// Papers whose number can't be read (e.g. topic-wise packs) stay as their own entry.
export const pairPapers = (papers) => {
  const sets = new Map()
  for (const paper of papers) {
    const slot = paper.kind === 'mark-scheme' ? 'markScheme' : 'questionPaper'
    let key = paper.paperType !== 'topic-wise' && paper.paperNumber !== 99
      ? `${paper.subjectKey}|${paper.year}|${paper.session}|${paper.paperNumber}${paper.variant}` : `id|${paper.id}`
    if (sets.get(key)?.[slot]) key = `${key}|${paper.id}`
    if (!sets.has(key)) sets.set(key, { key, papers: [] })
    const set = sets.get(key)
    set[slot] = paper
    set.papers.push(paper)
  }
  return [...sets.values()].map((set) => {
    const lead = set.questionPaper || set.markScheme
    return { ...lead, ...set, id: set.key, kind: lead.kind, title: lead.title }
  })
}

const matches = (paper, query) => {
  if (!query) return true
  const haystack = `${paper.title} ${paper.name} ${paper.code} ${paper.year || ''} ${paper.session || ''} ${paper.topic || ''} ${paper.kind === 'mark-scheme' ? 'mark scheme ms' : 'question paper qp'}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word.replace('/', '-')) || haystack.includes(word))
}

export const filterPapers = (papers, { subject, year, session, kind, query }) => papers.filter((paper) =>
  (!subject || paper.subjectKey === subject)
  && (!year || String(paper.year) === String(year))
  && (!session || paper.session === session)
  && (!kind || paper.kind === kind)
  && matches(paper, query))

const byPaper = (first, second) => first.paperNumber - second.paperNumber || first.variant - second.variant || (first.kind === second.kind ? 0 : first.kind === 'question-paper' ? -1 : 1) || first.name.localeCompare(second.name)

// Year-wise papers grouped newest year first, then by exam session; topic-wise papers grouped by topic.
export const groupPapers = (papers) => {
  const groups = new Map()
  for (const paper of papers) {
    const key = paper.paperType === 'topic-wise' ? `topic|${paper.topic || 'Other topics'}` : `year|${paper.year || 0}|${paper.session || ''}`
    if (!groups.has(key)) groups.set(key, paper.paperType === 'topic-wise'
      ? { key, type: 'topic', title: paper.topic || 'Other topics', year: -1, sessionIndex: 0, papers: [] }
      : { key, type: 'year', title: `${SESSION_LABELS[paper.session] || paper.session || 'Session'} ${paper.year || ''}`.trim(), year: paper.year || 0, sessionIndex: SESSION_ORDER.indexOf(paper.session), papers: [] })
    groups.get(key).papers.push(paper)
  }
  return [...groups.values()]
    .sort((first, second) => second.year - first.year || second.sessionIndex - first.sessionIndex || first.title.localeCompare(second.title))
    .map((group) => ({ ...group, papers: group.papers.sort(byPaper) }))
}
