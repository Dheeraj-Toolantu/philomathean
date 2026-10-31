import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen, CalendarClock, ClipboardList, ExternalLink, LogOut, Pencil, Plus, Search, Star, Trash2, UserRound, Users, X,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { listStudents } from '../firebase/student'
import {
  deleteMaterial, deleteScheduledTest, deleteTestMark, listAllMarks, listAllRatings, listMaterials, listRatingsForTeacher, listSchedule, listTeachers,
  saveMaterial, saveScheduledTest, saveTestMarks, subscribeStaff,
} from '../firebase/teaching'
import { formatDay, markError, percent, ratingSummary, studentSummaries, testSummaries, todayISO, upcoming } from '../teacher/marks'
import { Change, ProgressCardView } from '../teacher/ProgressCardView'
import { ConfirmDialog, Drawer, EmptyState, SkeletonRows, ToastStack } from '../components/admin/AdminUI'
import { useToasts } from '../components/admin/hooks'
import { loginUrl } from '../student/session'
import '../components/admin/admin.css'
import '../teacher/teacher.css'

const TABS = [
  ['tests', 'Tests & scores', ClipboardList],
  ['students', 'Student performance', Users],
  ['schedule', 'Next tests', CalendarClock],
  ['material', 'Teaching material', BookOpen],
  ['rating', 'Teacher rating', Star],
]
const SUBJECTS = ['IGCSE International Maths 0607', 'IGCSE Additional Maths 0606', 'IGCSE Mathematics 0580', 'IBDP Math AI SL', 'IBDP Math AA SL', 'IBDP Math AI HL', 'IBDP Math AA HL', 'AS Level Mathematics', 'A Level Mathematics', 'MYP 3 Mathematics', 'MYP 4 Mathematics', 'MYP 5 Mathematics', 'Grade 6 Mathematics', 'Grade 7 Mathematics', 'Grade 8 Mathematics', 'Checkpoint', 'AMC', 'SAT', 'PSAT', 'Olympiad']
const PROGRAMMES = ['IGCSE Mathematics', 'IBDP Mathematics', 'AS & A Level', 'IB MYP', 'Grades 6–8 Foundation', 'Entrance exams', 'General']
const readTab = () => { const tab = new URLSearchParams(window.location.search).get('tab'); return TABS.some(([id]) => id === tab) ? tab : 'tests' }
const settled = (result, fallback = []) => result.status === 'fulfilled' ? result.value : fallback

export function Stars({ value, size = 15 }) {
  return <span className="tp-stars" aria-label={value ? `${value} out of 5` : 'Not rated'}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={value >= n - 0.25 ? '' : 'off'} fill={value >= n - 0.25 ? 'currentColor' : 'none'} />)}</span>
}

export default function TeacherPortal() {
  const [staff, setStaff] = useState({ status: 'loading' })
  useEffect(() => subscribeStaff(setStaff), [])
  useEffect(() => { if (staff.status === 'signed-out') window.location.replace(loginUrl('/teacher')) }, [staff.status])
  useEffect(() => { document.title = 'Teacher portal | Philomathean' }, [])
  if (staff.status !== 'ready') return <main className="admin-loading"><p>Checking teacher access…</p></main>
  if (!staff.teacher && !staff.admin) return <NotTeacher user={staff.user} />
  return <Workspace staff={staff} />
}

function NotTeacher({ user }) {
  return <div className="adm-shell"><main className="adm-main">
    <EmptyState icon={UserRound} title="This account isn’t a teacher account yet" message={`You’re signed in as ${user.email || 'this account'}. Ask the administrator to add this email under Admin → Teachers, then reload this page.`}
      action={<div className="adm-dialog-actions"><a className="adm-button adm-button-ghost" href="/">Back to website</a><button type="button" className="adm-button adm-button-primary" onClick={() => signOut(auth).then(() => window.location.replace(loginUrl('/teacher')))}>Use another account</button></div>} />
  </main></div>
}

function Workspace({ staff }) {
  const me = useMemo(() => ({ uid: staff.user.uid, name: staff.teacher?.name || staff.user.displayName || staff.user.email || 'Administrator' }), [staff])
  const [tab, setTab] = useState(readTab)
  const [data, setData] = useState(null)
  const [entry, setEntry] = useState(null)
  const { toasts, notify, dismiss } = useToasts()
  const load = useCallback(() => {
    Promise.allSettled([listAllMarks(), listStudents(500), listSchedule(), listMaterials(), staff.admin ? listAllRatings() : listRatingsForTeacher(staff.user.uid), listTeachers()]).then((results) => {
      const [marks, students, schedule, materials, ratings, teachers] = results.map((result) => settled(result))
      setData({ marks, students, schedule, materials, ratings, teachers, failed: results.some((result) => result.status === 'rejected') })
    })
  }, [staff])
  useEffect(() => { load() }, [load])
  const selectTab = (next) => { setTab(next); window.history.replaceState(null, '', next === 'tests' ? '/teacher' : `/teacher?tab=${next}`) }
  const logout = () => signOut(auth).then(() => { window.location.href = '/' })

  const myRating = data ? ratingSummary(data.ratings.filter((rating) => staff.admin ? rating.teacherUid === staff.user.uid : true)) : null
  const nextTests = data ? upcoming(data.schedule) : []
  const cards = data ? [
    ['Tests recorded', testSummaries(data.marks).length, ClipboardList, 'blue', 'tests'],
    ['Students with marks', new Set(data.marks.map((mark) => mark.studentUid)).size, Users, 'green', 'students'],
    ['Upcoming tests', nextTests.length, CalendarClock, 'amber', 'schedule'],
    [staff.admin && !staff.teacher ? 'Ratings received' : 'My rating', staff.admin && !staff.teacher ? data.ratings.length : myRating.average ?? '—', Star, 'orange', 'rating'],
  ] : []

  return <div className="adm-shell">
    <header className="adm-topbar">
      <a className="adm-brand" href="/teacher"><img src="/media/logo.png" alt="" /><span><strong>Philomathean</strong><small>Teacher portal</small></span></a>
      <div className="adm-topbar-actions">
        {staff.admin && <a className="adm-button adm-button-ghost adm-hide-mobile" href="/admin">Admin panel</a>}
        <a className="adm-button adm-button-ghost adm-hide-mobile" href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} /> View website</a>
        <span className="adm-user" title={staff.user.email}><span className="adm-user-avatar">{me.name[0].toUpperCase()}</span><span className="adm-hide-mobile">{me.name}</span></span>
        <button type="button" className="adm-icon-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
      </div>
    </header>
    <main className="adm-main">
      <section className="adm-hero"><div><p className="adm-eyebrow">Teacher portal</p><h1>Hello, {me.name.split(' ')[0]}</h1><p>Enter test marks, follow each student’s progress and plan the next tests.</p></div>
        <button type="button" className="adm-button adm-button-primary" onClick={() => setEntry({})}><Plus size={16} /> Enter test marks</button></section>
      {data?.failed && <p className="adm-form-error" role="alert">Some information couldn’t be loaded. Check your connection and that the latest Firestore rules are deployed, then reload.</p>}
      {data && <section className="adm-stats" aria-label="Summary">{cards.map(([label, value, Icon, tone, target]) => <button type="button" key={label} className={`adm-stat adm-stat-${tone}`} onClick={() => selectTab(target)}><span className="adm-stat-icon"><Icon size={19} /></span><span className="adm-stat-label">{label}</span><strong>{value}</strong></button>)}</section>}
      <nav className="adm-tabs tp-tabs" role="tablist" aria-label="Teacher portal">{TABS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => selectTab(id)}><Icon size={16} /> {label}</button>)}</nav>
      {!data ? <SkeletonRows count={5} />
        : tab === 'tests' ? <TestsTab marks={data.marks} onEdit={setEntry} onNew={() => setEntry({})} reload={load} notify={notify} />
        : tab === 'students' ? <StudentsTab marks={data.marks} />
        : tab === 'schedule' ? <ScheduleTab schedule={data.schedule} me={me} reload={load} notify={notify} onEnterMarks={(test) => setEntry({ test: { testTitle: test.title, subject: test.subject, testDate: test.date, maxScore: test.maxScore } })} />
        : tab === 'material' ? <MaterialTab materials={data.materials} admin={staff.admin} reload={load} notify={notify} />
        : <RatingTab ratings={data.ratings} teachers={data.teachers} admin={staff.admin} me={me} />}
    </main>
    {entry && data && <MarksDrawer initial={entry} students={data.students} me={me} onClose={() => setEntry(null)} onSaved={(message) => { setEntry(null); notify('success', message); load() }} />}
    <ToastStack toasts={toasts} onDismiss={dismiss} />
  </div>
}

// ---------- Tests & scores ----------
function TestsTab({ marks, onEdit, onNew, reload, notify }) {
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const text = query.trim().toLowerCase()
  const tests = testSummaries(marks).filter((test) => !text || `${test.testTitle} ${test.subject} ${test.marks.map((mark) => mark.studentName).join(' ')}`.toLowerCase().includes(text))
  const remove = async () => {
    setBusy(true)
    try { await Promise.all(removing.marks.map((mark) => deleteTestMark(mark.id))); notify('success', 'Test marks deleted.'); setRemoving(null); reload() } catch { notify('error', 'The marks could not be deleted.') } finally { setBusy(false) }
  }
  return <section className="adm-panel">
    <header className="adm-panel-head"><div><h2>Tests &amp; scores</h2><p>Every test with each student’s marks. Open a test to see the class, or edit it to correct marks.</p></div></header>
    <div className="adm-toolbar"><label className="adm-student-search"><Search size={15} /><span className="sr-only">Search tests</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search test, subject or student" /></label></div>
    {!tests.length ? <EmptyState icon={ClipboardList} title={marks.length ? 'No tests match' : 'No marks entered yet'} message={marks.length ? 'Try a different search.' : 'Enter the marks for a test and they will appear on each student’s progress card.'} action={!marks.length && <button type="button" className="adm-button adm-button-primary" onClick={onNew}><Plus size={16} /> Enter test marks</button>} />
      : tests.map((test) => <details className="tp-test" key={test.testId}>
        <summary><strong>{test.testTitle}<small> · {test.subject}</small></strong><small>{formatDay(test.testDate)}</small>
          <span className="tp-stat">Students<b>{test.count}</b></span><span className="tp-stat">Average<b>{test.average}%</b></span><span className="tp-stat">Highest<b>{test.highest}%</b></span><span className="tp-stat">Lowest<b>{test.lowest}%</b></span></summary>
        <div className="tp-test-body">
          <div className="pc-table-wrap"><table className="pc-table"><thead><tr><th>Student</th><th>Marks</th><th>%</th><th>School score</th><th>Note</th></tr></thead>
            <tbody>{test.marks.map((mark) => <tr key={mark.id}><td>{mark.studentName}</td><td>{mark.score} / {mark.maxScore}</td><td>{percent(mark)}%</td><td>{mark.schoolScore ?? '—'}{mark.schoolScore != null ? '%' : ''}</td><td>{mark.note || '—'}</td></tr>)}</tbody></table></div>
          <div className="adm-dialog-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="adm-button adm-button-ghost" onClick={() => setRemoving(test)}><Trash2 size={15} /> Delete test</button>
            <button type="button" className="adm-button adm-button-primary" onClick={() => onEdit({ test, marks: test.marks })}><Pencil size={15} /> Edit marks</button>
          </div>
        </div>
      </details>)}
    <ConfirmDialog open={Boolean(removing)} title="Delete this test?" message={removing ? `This removes ${removing.testTitle} and its ${removing.count} marks from every student’s progress card.` : ''} busy={busy} onConfirm={remove} onCancel={() => setRemoving(null)} />
  </section>
}

// Enter (or correct) one test's marks for several students at once.
function MarksDrawer({ initial, students, me, onClose, onSaved }) {
  const [test, setTest] = useState({ testTitle: '', subject: '', testDate: todayISO(), maxScore: 100, ...(initial.test ? { testTitle: initial.test.testTitle, subject: initial.test.subject, testDate: initial.test.testDate, maxScore: initial.test.maxScore, testId: initial.test.testId } : {}) })
  const [entries, setEntries] = useState(() => (initial.marks || []).map((mark) => ({ id: mark.id, studentUid: mark.studentUid, studentName: mark.studentName, score: String(mark.score), schoolScore: mark.schoolScore == null ? '' : String(mark.schoolScore), note: mark.note || '' })))
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = new Set(entries.map((item) => item.studentUid))
  const text = query.trim().toLowerCase()
  const options = text ? students.filter((student) => !chosen.has(student.id) && `${student.displayName} ${student.email} ${student.grade} ${student.curriculum}`.toLowerCase().includes(text)).slice(0, 30) : []
  const add = (student) => { setEntries((list) => [...list, { studentUid: student.id, studentName: student.displayName || student.email, score: '', schoolScore: '', note: '' }]); setQuery('') }
  const setEntry = (index, key, value) => setEntries((list) => list.map((item, position) => position === index ? { ...item, [key]: value } : item))
  const submit = async (event) => {
    event.preventDefault()
    if (!test.testTitle.trim() || !test.subject.trim() || !test.testDate) return setError('Add the test name, subject and date.')
    const filled = entries.filter((item) => item.score !== '')
    if (!filled.length) return setError('Add at least one student and their marks.')
    const problem = entries.map((item) => markError({ ...item, maxScore: test.maxScore })).find(Boolean)
    if (problem) return setError(problem)
    setBusy(true); setError('')
    try { await saveTestMarks(test, entries, me); onSaved(`Marks saved for ${filled.length} student${filled.length === 1 ? '' : 's'}.`) } catch { setError('The marks could not be saved. Check your connection and try again.'); setBusy(false) }
  }
  return <Drawer open wide title={initial.marks ? 'Edit test marks' : 'Enter test marks'} subtitle="Students see these marks on their progress card." locked={busy} onClose={onClose}>
    <form className="adm-form" onSubmit={submit} noValidate>
      <div className="adm-form-body">
        <section className="adm-form-section"><h3>Test</h3>
          <label className="adm-field">Test name<input value={test.testTitle} onChange={(event) => setTest({ ...test, testTitle: event.target.value })} placeholder="Unit test 3 · Quadratics" maxLength={120} /></label>
          <label className="adm-field">Subject<input value={test.subject} onChange={(event) => setTest({ ...test, subject: event.target.value })} list="tp-subjects" placeholder="IGCSE Additional Maths 0606" maxLength={60} /></label>
          <datalist id="tp-subjects">{SUBJECTS.map((item) => <option key={item} value={item} />)}</datalist>
          <div className="adm-form-row">
            <label className="adm-field">Date<input type="date" value={test.testDate} onChange={(event) => setTest({ ...test, testDate: event.target.value })} /></label>
            <label className="adm-field">Maximum marks<input type="number" min="1" max="1000" value={test.maxScore} onChange={(event) => setTest({ ...test, maxScore: event.target.value })} /></label>
          </div>
        </section>
        <section className="adm-form-section"><h3>Students &amp; marks</h3>
          <label className="adm-field">Add a student<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or grade" /></label>
          {text && <ul className="tp-picker">{options.length ? options.map((student) => <li key={student.id}><button type="button" onClick={() => add(student)}><span>{student.displayName || 'Student'}</span><small>{[student.curriculum, student.grade, student.email].filter(Boolean).join(' · ')}</small></button></li>) : <li className="float-hint">No matching student accounts. Students appear here after they sign up at /login.</li>}</ul>}
          {entries.length > 0 && <div>
            <div className="tp-entry tp-entry-head"><span>Student</span><span>Marks / {test.maxScore || '?'}</span><span>School %</span><span /></div>
            {entries.map((item, index) => <div className="tp-entry" key={item.studentUid}>
              <div><strong>{item.studentName}</strong><input className="tp-note" value={item.note} onChange={(event) => setEntry(index, 'note', event.target.value)} placeholder="Note (optional)" maxLength={300} aria-label={`Note for ${item.studentName}`} style={{ height: 30, marginTop: 4, padding: '0 8px', border: '1px solid #e4e9f0', borderRadius: 8 }} /></div>
              <span className="adm-field"><input type="number" min="0" step="any" value={item.score} onChange={(event) => setEntry(index, 'score', event.target.value)} aria-label={`Marks for ${item.studentName}`} /></span>
              <span className="adm-field"><input type="number" min="0" max="100" step="any" value={item.schoolScore} onChange={(event) => setEntry(index, 'schoolScore', event.target.value)} aria-label={`School score for ${item.studentName}`} placeholder="—" /></span>
              <button type="button" className="adm-icon-button" disabled={Boolean(item.id)} title={item.id ? 'Delete this test to remove saved marks' : 'Remove'} onClick={() => setEntries((list) => list.filter((_, position) => position !== index))} aria-label={`Remove ${item.studentName}`}><X size={15} /></button>
            </div>)}
          </div>}
          <p className="adm-hint">School % is optional: the student’s school mark for the same subject and period, used for the “test score vs school score” comparison.</p>
        </section>
        {error && <p className="adm-form-error" role="alert">{error}</p>}
      </div>
      <footer className="adm-form-footer">
        <button type="button" className="adm-button adm-button-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="adm-button adm-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save marks'}</button>
      </footer>
    </form>
  </Drawer>
}

// ---------- Student-wise performance ----------
function StudentsTab({ marks }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const text = query.trim().toLowerCase()
  const rows = studentSummaries(marks).filter((row) => !text || String(row.studentName).toLowerCase().includes(text))
  return <section className="adm-panel">
    <header className="adm-panel-head"><div><h2>Student performance</h2><p>Each student’s average, first test (before) and latest test (after). Students who need the most help are listed first.</p></div></header>
    <div className="adm-toolbar"><label className="adm-student-search"><Search size={15} /><span className="sr-only">Search students</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student" /></label></div>
    {!rows.length ? <EmptyState icon={Users} title={marks.length ? 'No students match' : 'No marks yet'} message={marks.length ? 'Try a different search.' : 'Enter test marks to see each student’s performance here.'} />
      : <div className="pc-table-wrap"><table className="pc-table">
        <thead><tr><th>Student</th><th>Tests</th><th>Average</th><th>Before</th><th>After</th><th>Change</th><th /></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.studentUid}><td><strong>{row.studentName}</strong></td><td>{row.count}</td><td>{row.average}%</td><td>{row.before}%</td><td>{row.after}%</td><td><Change value={row.change} /></td><td><button type="button" className="adm-button adm-button-ghost adm-button-small" onClick={() => setOpen(row)}>Progress card</button></td></tr>)}</tbody>
      </table></div>}
    <Drawer open={Boolean(open)} wide title={open ? `${open.studentName} · progress card` : ''} subtitle="The same card the student sees on their dashboard." onClose={() => setOpen(null)}>
      {open && <div className="adm-form-body"><ProgressCardView marks={marks.filter((mark) => mark.studentUid === open.studentUid)} /></div>}
    </Drawer>
  </section>
}

// ---------- Next tests (schedule) ----------
const emptyTest = () => ({ title: '', subject: '', batch: '', date: todayISO(), time: '', maxScore: 100, notes: '' })
function ScheduleTab({ schedule, me, reload, notify, onEnterMarks }) {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = todayISO()
  const next = upcoming(schedule, today)
  const past = schedule.filter((test) => String(test.date) < today).slice(0, 20)
  const submit = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.subject.trim() || !form.date) return setError('Add the test name, subject and date.')
    setBusy(true); setError('')
    try { await saveScheduledTest(form, me); notify('success', form.id ? 'Test updated.' : 'Test scheduled. Students see it on their dashboard.'); setForm(null); reload() } catch { setError('The test could not be saved.') } finally { setBusy(false) }
  }
  const remove = async (test) => { try { await deleteScheduledTest(test.id); notify('success', 'Scheduled test removed.'); reload() } catch { notify('error', 'The test could not be removed.') } }
  const row = (test) => <article className="adm-row" key={test.id} style={{ gridTemplateColumns: '1fr auto' }}>
    <div className="adm-row-main"><span className="adm-avatar"><CalendarClock size={16} /></span><div><strong>{test.title}</strong><small>{formatDay(test.date)}{test.time ? ` · ${test.time}` : ''} · {test.subject}{test.batch ? ` · ${test.batch}` : ''} · out of {test.maxScore}{test.teacherName ? ` · ${test.teacherName}` : ''}</small>{test.notes && <small>{test.notes}</small>}</div></div>
    <div className="adm-row-actions">
      <button type="button" className="adm-button adm-button-ghost adm-button-small" onClick={() => onEnterMarks(test)}>Enter marks</button>
      <button type="button" className="adm-icon-button" onClick={() => setForm({ ...emptyTest(), ...test })} aria-label={`Edit ${test.title}`}><Pencil size={15} /></button>
      <button type="button" className="adm-icon-button" onClick={() => remove(test)} aria-label={`Remove ${test.title}`}><Trash2 size={15} /></button>
    </div>
  </article>
  return <section className="adm-panel">
    <header className="adm-panel-head"><div><h2>Next tests</h2><p>Schedule upcoming tests. Students see the next tests on their dashboard.</p></div><button type="button" className="adm-button adm-button-primary" onClick={() => setForm(emptyTest())}><Plus size={16} /> Schedule a test</button></header>
    {next.length ? <div className="adm-list">{next.map(row)}</div> : <EmptyState icon={CalendarClock} title="No upcoming tests" message="Schedule the next test so students and parents know what’s coming." />}
    {past.length > 0 && <><h3 className="pc-heading" style={{ margin: '22px 0 10px' }}>Recent past tests</h3><div className="adm-list">{past.map(row)}</div></>}
    <Drawer open={Boolean(form)} title={form?.id ? 'Edit scheduled test' : 'Schedule a test'} locked={busy} onClose={() => setForm(null)}>
      {form && <form className="adm-form" onSubmit={submit} noValidate>
        <div className="adm-form-body"><section className="adm-form-section">
          <label className="adm-field">Test name<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mock test 2" maxLength={120} /></label>
          <label className="adm-field">Subject<input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} list="tp-subjects-schedule" maxLength={60} /></label>
          <datalist id="tp-subjects-schedule">{SUBJECTS.map((item) => <option key={item} value={item} />)}</datalist>
          <label className="adm-field">Batch / group (optional)<input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} placeholder="Grade 9 · Saturday batch" maxLength={80} /></label>
          <div className="adm-form-row">
            <label className="adm-field">Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <label className="adm-field">Time (optional)<input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
          </div>
          <label className="adm-field">Maximum marks<input type="number" min="1" max="1000" value={form.maxScore} onChange={(event) => setForm({ ...form, maxScore: event.target.value })} /></label>
          <label className="adm-field">Syllabus / notes (optional)<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={500} /></label>
        </section>{error && <p className="adm-form-error" role="alert">{error}</p>}</div>
        <footer className="adm-form-footer"><button type="button" className="adm-button adm-button-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button className="adm-button adm-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></footer>
      </form>}
    </Drawer>
  </section>
}

// ---------- Teaching material ----------
const emptyMaterial = () => ({ title: '', programme: PROGRAMMES[0], grade: '', description: '', url: '' })
function MaterialTab({ materials, admin, reload, notify }) {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const groups = PROGRAMMES.map((programme) => [programme, materials.filter((item) => (item.programme || 'General') === programme)]).filter(([, list]) => list.length)
  const submit = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) return setError('Add a title.')
    if (form.url && !/^https:\/\//i.test(form.url.trim())) return setError('Links must start with https://')
    setBusy(true); setError('')
    try { await saveMaterial(form); notify('success', 'Teaching material saved.'); setForm(null); reload() } catch { setError('The material could not be saved.') } finally { setBusy(false) }
  }
  const remove = async (item) => { try { await deleteMaterial(item.id); notify('success', 'Material removed.'); reload() } catch { notify('error', 'The material could not be removed.') } }
  return <section className="adm-panel">
    <header className="adm-panel-head"><div><h2>Teaching material</h2><p>The scheme of work, lesson plans and resources every teacher follows{admin ? '. You can add, edit and remove material here.' : ', shared by the institute.'}</p></div>{admin && <button type="button" className="adm-button adm-button-primary" onClick={() => setForm(emptyMaterial())}><Plus size={16} /> Add material</button>}</header>
    {!groups.length ? <EmptyState icon={BookOpen} title="No teaching material yet" message={admin ? 'Add the scheme of work, worksheets or lesson plans for teachers to follow.' : 'The administrator hasn’t shared any material yet.'} />
      : groups.map(([programme, list]) => <div key={programme} style={{ marginBottom: 18 }}><h3 className="pc-heading" style={{ marginBottom: 10 }}>{programme}</h3><div className="tp-grid-2">{list.map((item) => <article className="tp-card tp-material" key={item.id}>
        <h3>{item.title}</h3>{item.grade && <p><b>{item.grade}</b></p>}{item.description && <p style={{ whiteSpace: 'pre-line', marginTop: 6 }}>{item.description}</p>}
        <div className="adm-dialog-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
          {item.url && <a className="adm-button adm-button-ghost adm-button-small" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>}
          {admin && <><button type="button" className="adm-icon-button" onClick={() => setForm({ ...emptyMaterial(), ...item })} aria-label={`Edit ${item.title}`}><Pencil size={15} /></button><button type="button" className="adm-icon-button" onClick={() => remove(item)} aria-label={`Remove ${item.title}`}><Trash2 size={15} /></button></>}
        </div>
      </article>)}</div></div>)}
    <Drawer open={Boolean(form)} title={form?.id ? 'Edit material' : 'Add teaching material'} locked={busy} onClose={() => setForm(null)}>
      {form && <form className="adm-form" onSubmit={submit} noValidate>
        <div className="adm-form-body"><section className="adm-form-section">
          <label className="adm-field">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="0606 scheme of work · Term 1" maxLength={120} /></label>
          <div className="adm-form-row">
            <label className="adm-field">Programme<select value={form.programme} onChange={(event) => setForm({ ...form, programme: event.target.value })}>{PROGRAMMES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="adm-field">Grade / level<input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} placeholder="Grade 9" maxLength={40} /></label>
          </div>
          <label className="adm-field">What teachers should follow<textarea rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1000} placeholder={'Week 1: Functions\nWeek 2: Quadratics\n…'} /></label>
          <label className="adm-field">Link (Google Drive, PDF…)<input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://" maxLength={1000} /></label>
        </section>{error && <p className="adm-form-error" role="alert">{error}</p>}</div>
        <footer className="adm-form-footer"><button type="button" className="adm-button adm-button-ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button><button className="adm-button adm-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></footer>
      </form>}
    </Drawer>
  </section>
}

// ---------- Teacher rating ----------
function RatingTab({ ratings, teachers, admin, me }) {
  if (admin) {
    const rows = teachers.map((teacher) => ({ teacher, ...ratingSummary(ratings.filter((rating) => rating.teacherUid === teacher.id)) }))
    return <section className="adm-panel">
      <header className="adm-panel-head"><div><h2>Teacher ratings</h2><p>Students rate their teachers from 1 to 5 on their dashboard. Ratings are anonymous to teachers.</p></div></header>
      {!rows.length ? <EmptyState icon={Star} title="No teachers yet" message="Add teacher accounts under Admin → Teachers." />
        : <div className="pc-table-wrap"><table className="pc-table"><thead><tr><th>Teacher</th><th>Rating</th><th>Average</th><th>Ratings</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.teacher.id}><td>{row.teacher.name}</td><td><Stars value={row.average || 0} /></td><td>{row.average ?? '—'}</td><td>{row.count}</td></tr>)}</tbody></table></div>}
      <CommentList ratings={ratings} showTeacher />
    </section>
  }
  const summary = ratingSummary(ratings)
  return <section className="adm-panel">
    <header className="adm-panel-head"><div><h2>My rating</h2><p>Students rate their teachers from 1 to 5 on their dashboard. You see the average and comments, not who wrote them.</p></div></header>
    <div className="tp-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}><strong style={{ fontSize: 36 }}>{summary.average ?? '—'}</strong><div><Stars value={summary.average || 0} size={20} /><p>{summary.count ? `${summary.count} student rating${summary.count === 1 ? '' : 's'} for ${me.name}` : 'No ratings yet'}</p></div></div>
    <CommentList ratings={ratings} />
  </section>
}

function CommentList({ ratings, showTeacher = false }) {
  const comments = ratings.filter((rating) => rating.comment)
  if (!comments.length) return null
  return <><h3 className="pc-heading" style={{ margin: '22px 0 10px' }}>Comments</h3><div className="tp-grid-2">{comments.map((rating) => <article className="tp-card" key={rating.id}><Stars value={rating.rating} /><p style={{ marginTop: 6 }}>“{rating.comment}”</p>{showTeacher && <p><small>for {rating.teacherName}</small></p>}</article>)}</div></>
}
