// Site-wide search used by the floating search button. Everything is indexed in the browser:
// programmes, entrance exams, practice courses, past-paper libraries, teachers and the main pages.
import { COURSES } from '../../student/catalog.js'
import { everyTeacher, teacherSlug } from './faculty.js'
import { PATHWAYS } from './paperInfo.js'
import { ENTRANCE_EXAMS, FOUNDATION_SCHEME, OTHER_EXAMS, PROGRAMME_COURSES } from './programmes.js'

const PAGES = [
  ['Book a free demo class', 'Admissions', '/#enquiry', 'enquire contact admission demo call'],
  ['Our teachers', 'Faculty', '/teachers', 'faculty educators tutors'],
  ['Past papers', 'Study resources', '/premium-sources', 'question papers mark schemes resources'],
  ['Practice courses & quizzes', 'Practice', '/courses', 'quiz mock exam prediction revision'],
  ['Results', 'Top performers', '/#results', 'scores 45/45 toppers'],
  ['Student login', 'Student portal', '/login', 'sign in dashboard account progress card marks'],
  ['Teacher login', 'Teacher portal', '/teacher', 'staff sign in marks schedule'],
  ['About us', 'Founder', '/#about', 'satish vishwakarma founder director'],
]

export const buildSearchIndex = () => [
  ...PROGRAMME_COURSES.map((item) => ({ title: item.title, type: 'Programme', detail: `${item.grades} · ${item.courses.join(', ')}`, href: '/#programs' })),
  { title: 'Grades 6–8 Foundation', type: 'Programme', detail: FOUNDATION_SCHEME.map(([grade, items]) => `${grade}: ${items.join(', ')}`).join(' · '), href: '/#programs' },
  ...[...ENTRANCE_EXAMS, ...OTHER_EXAMS].map(([title, detail]) => ({ title, type: 'Exam prep', detail, href: '/#entrance-exams' })),
  ...COURSES.map((course) => ({ title: course.title, type: 'Practice course', detail: course.fullTitle, href: `/courses/${course.id}` })),
  ...PATHWAYS.map((pathway) => ({ title: `${pathway.title} past papers`, type: 'Past papers', detail: pathway.description, href: `/past-papers?subject=${encodeURIComponent(pathway.id)}` })),
  ...everyTeacher.map(([name, role, subject]) => ({ title: name, type: 'Teacher', detail: `${role} · ${subject}`, href: `/teachers/${teacherSlug(name)}` })),
  ...PAGES.map(([title, type, href, keywords]) => ({ title, type, detail: '', href, keywords })),
]

const normalise = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Every word of the query must appear somewhere in the entry; matches in the title rank first.
export const searchSite = (index, query, max = 12) => {
  const words = normalise(query).split(' ').filter(Boolean)
  if (!words.length) return []
  return index.map((item, position) => {
    const title = normalise(item.title)
    const haystack = `${title} ${normalise(item.type)} ${normalise(item.detail)} ${normalise(item.keywords)}`
    if (!words.every((word) => haystack.includes(word))) return null
    const score = words.reduce((sum, word) => sum + (title.startsWith(word) ? 3 : title.includes(word) ? 2 : 0), 0)
    return { item, score, position }
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.position - b.position).slice(0, max).map(({ item }) => item)
}
