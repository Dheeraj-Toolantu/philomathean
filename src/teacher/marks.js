// Pure helpers for test marks entered by teachers: percentages, the student's progress card
// (before vs after, test score vs school score), per-test and per-student summaries.
// A mark: { id, testId, studentUid, studentName, subject, testTitle, testDate: 'YYYY-MM-DD', score, maxScore, schoolScore?: 0–100 }

export const percent = (mark) => mark && mark.maxScore > 0 ? Math.round((Number(mark.score) / Number(mark.maxScore)) * 100) : 0
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
const hasSchoolScore = (mark) => mark.schoolScore !== null && mark.schoolScore !== undefined && mark.schoolScore !== '' && Number.isFinite(Number(mark.schoolScore))
// Oldest first; marks entered for the same day keep the order they were created in.
export const byDate = (marks) => [...marks].sort((a, b) => String(a.testDate).localeCompare(String(b.testDate)) || (a.createdAtMs || 0) - (b.createdAtMs || 0))

// "Before" is the first test on record, "after" the most recent one.
const beforeAfter = (marks) => {
  const sorted = byDate(marks)
  if (!sorted.length) return null
  const first = sorted[0]
  const latest = sorted[sorted.length - 1]
  return { first, latest, before: percent(first), after: percent(latest), change: percent(latest) - percent(first), count: sorted.length }
}

export const groupBy = (list, key) => list.reduce((groups, item) => { const value = typeof key === 'function' ? key(item) : item[key]; (groups[value] ||= []).push(item); return groups }, {})

// The student's progress card.
export const progressCard = (marks) => {
  const sorted = byDate(marks)
  const subjects = Object.entries(groupBy(sorted, (mark) => mark.subject || 'General')).map(([subject, list]) => {
    const withSchool = list.filter(hasSchoolScore)
    return {
      subject,
      ...beforeAfter(list),
      average: average(list.map(percent)),
      // Compare like with like: only tests where the school score for the same period is known.
      testAverage: average(withSchool.map(percent)),
      schoolAverage: average(withSchool.map((mark) => Number(mark.schoolScore))),
    }
  })
  return {
    count: sorted.length,
    average: average(sorted.map(percent)),
    overall: beforeAfter(sorted),
    subjects,
    vsSchool: subjects.filter((item) => item.schoolAverage !== null).map((item) => ({ subject: item.subject, test: item.testAverage, school: item.schoolAverage, gap: item.testAverage - item.schoolAverage })),
    timeline: sorted.map((mark) => ({ ...mark, pct: percent(mark) })),
  }
}

// One row per test (all students who sat it), newest first.
export const testSummaries = (marks) => Object.values(groupBy(marks, (mark) => mark.testId || `${mark.testTitle}|${mark.testDate}|${mark.subject}`)).map((list) => {
  const scores = list.map(percent)
  const [first] = list
  return {
    testId: first.testId || `${first.testTitle}|${first.testDate}|${first.subject}`,
    testTitle: first.testTitle, testDate: first.testDate, subject: first.subject, maxScore: first.maxScore,
    count: list.length, average: average(scores), highest: Math.max(...scores), lowest: Math.min(...scores),
    marks: [...list].sort((a, b) => percent(b) - percent(a) || String(a.studentName).localeCompare(String(b.studentName))),
  }
}).sort((a, b) => String(b.testDate).localeCompare(String(a.testDate)))

// One row per student for the teacher's student-wise performance view, weakest average first.
export const studentSummaries = (marks) => Object.values(groupBy(marks, 'studentUid')).map((list) => {
  const card = progressCard(list)
  return { studentUid: list[0].studentUid, studentName: list[0].studentName, count: card.count, average: card.average, before: card.overall.before, after: card.overall.after, change: card.overall.change, latest: card.overall.latest, card }
}).sort((a, b) => a.average - b.average || String(a.studentName).localeCompare(String(b.studentName)))

// Scheduled tests from today on, soonest first.
export const todayISO = (now = new Date()) => new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const upcoming = (tests, today = todayISO()) => tests.filter((test) => String(test.date) >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || '').localeCompare(String(b.time || '')))

export const ratingSummary = (ratings) => {
  const values = ratings.map((rating) => Number(rating.rating)).filter((value) => value >= 1 && value <= 5)
  return { count: values.length, average: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null }
}

// Checks one row of marks before it is saved (the Firestore rules enforce the same limits).
export const markError = ({ score, maxScore, schoolScore }) => {
  const max = Number(maxScore)
  if (!(max > 0 && max <= 1000)) return 'Maximum marks must be between 1 and 1000.'
  if (score === '' || score === null || score === undefined) return null
  const value = Number(score)
  if (!Number.isFinite(value) || value < 0 || value > max) return `Marks must be between 0 and ${max}.`
  if (schoolScore !== '' && schoolScore !== null && schoolScore !== undefined) {
    const school = Number(schoolScore)
    if (!Number.isFinite(school) || school < 0 || school > 100) return 'School score is a percentage between 0 and 100.'
  }
  return null
}

export const formatDay = (iso) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ---------- Pass marks and remedials ----------
// A test can have a pass mark (in marks, not %). The teacher decides who goes to remedial: being below the pass
// mark only flags the student, it never sends them to remedial on its own.
const hasValue = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))
export const hasPassMark = (mark) => hasValue(mark?.passMark)
export const belowPass = (mark) => hasPassMark(mark) && hasValue(mark.score) && Number(mark.score) < Number(mark.passMark)
// 'pending' | 'done' | null
export const remedialStatus = (mark) => mark?.remedial ? (mark.remedialDone ? 'done' : 'pending') : null
export const passMarkError = (passMark, maxScore) => {
  if (passMark === '' || passMark === null || passMark === undefined) return null
  const value = Number(passMark)
  if (!Number.isFinite(value) || value < 0 || value > Number(maxScore)) return `The pass mark must be between 0 and ${maxScore}.`
  return null
}
// Remedial work across all tests: pending first (oldest test first, so nothing is forgotten), then completed.
export const remedials = (marks) => {
  const list = marks.filter((mark) => mark.remedial)
  const pending = byDate(list.filter((mark) => !mark.remedialDone))
  const done = byDate(list.filter((mark) => mark.remedialDone)).reverse()
  return { pending, done }
}

// ---------- Weekly leaderboard ----------
const pad = (value) => String(value).padStart(2, '0')
export const localISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
// Weeks run Monday to Sunday. Returns { start, end } as 'YYYY-MM-DD'.
export const weekOf = (iso) => {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  const start = localISO(date)
  date.setDate(date.getDate() + 6)
  return { start, end: localISO(date) }
}
export const shiftWeek = (start, weeks) => { const date = new Date(`${start}T00:00:00`); date.setDate(date.getDate() + weeks * 7); return localISO(date) }
export const formatWeek = ({ start, end }) => {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T00:00:00`)
  const sameMonth = from.getMonth() === to.getMonth()
  return `${from.toLocaleDateString('en-IN', { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) })} – ${to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}
// "Aarav Sharma" → "Aarav S." so the leaderboard shows who did well without full names.
export const shortName = (name) => {
  const parts = String(name || 'Student').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Student'
  return parts.length === 1 ? parts[0].slice(0, 30) : `${parts[0].slice(0, 30)} ${parts[parts.length - 1][0].toUpperCase()}.`
}
// Everyone who sat a test in the week, ranked by their average %. Ties share a rank (1, 2, 2, 4).
export const weeklyLeaderboard = (marks, weekStart) => {
  const { start, end } = weekOf(weekStart)
  const inWeek = marks.filter((mark) => String(mark.testDate) >= start && String(mark.testDate) <= end)
  const rows = Object.values(groupBy(inWeek, 'studentUid')).map((list) => {
    const scores = list.map(percent)
    return { studentUid: list[0].studentUid, name: shortName(list[0].studentName), fullName: list[0].studentName, average: average(scores), best: Math.max(...scores), tests: list.length }
  }).sort((a, b) => b.average - a.average || b.tests - a.tests || a.name.localeCompare(b.name))
  let rank = 0
  return rows.map((row, index) => {
    if (index === 0 || row.average !== rows[index - 1].average || row.tests !== rows[index - 1].tests) rank = index + 1
    return { ...row, rank }
  })
}
// The public copy students read: the top 10, short names only.
export const LEADERBOARD_SIZE = 10
export const leaderboardDoc = (marks, weekStart) => {
  const week = weekOf(weekStart)
  const rows = weeklyLeaderboard(marks, week.start)
  return {
    weekStart: week.start, weekEnd: week.end, participants: rows.length,
    entries: rows.slice(0, LEADERBOARD_SIZE).map(({ studentUid, name, average: avg, best, tests, rank }) => ({ studentUid, name, average: avg, best, tests, rank })),
  }
}
// "Worksheet B · https://drive…" → { label: 'Worksheet B', url: 'https://drive…' }
export const splitWorksheet = (text) => {
  const value = String(text || '').trim()
  const url = value.match(/https:\/\/\S+/i)?.[0] || ''
  const label = value.replace(url, '').replace(/[\s·:,-]+$/, '').replace(/^[\s·:,-]+/, '').trim()
  return { label, url }
}
