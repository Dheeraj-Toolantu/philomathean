import { useEffect, useState } from 'react'
import { CalendarClock, Star } from 'lucide-react'
import { listTeachers, rateTeacher, subscribeMyRatings, subscribeStudentMarks, subscribeUpcomingTests } from '../firebase/teaching'
import { formatDay, todayISO } from '../teacher/marks'
import { ProgressCardView } from '../teacher/ProgressCardView'

// Dashboard tab: marks teachers entered for this student, the next scheduled tests and teacher ratings.
export function ReportPanel({ user }) {
  const [marks, setMarks] = useState(null)
  const [tests, setTests] = useState([])
  useEffect(() => subscribeStudentMarks(user.uid, setMarks), [user.uid])
  useEffect(() => subscribeUpcomingTests(todayISO(), setTests), [])
  return <>
    <div className="st-panel-head"><div><h1>Progress card</h1><p>Marks from your Philomathean tests, entered by your teachers: where you started, where you are now, and how it compares with school.</p></div></div>
    <div className="st-card"><div className="st-card-head"><h2>My progress card</h2></div>
      {marks === null ? <p className="st-muted-box">Loading your marks…</p> : <ProgressCardView marks={marks} emptyText="Your teachers haven’t entered any test marks yet. They’ll appear here after your first test." />}</div>
    <div className="st-grid-2">
      <div className="st-card"><div className="st-card-head"><h2>Next tests</h2></div>
        {tests.length ? <ul className="st-topic-list">{tests.map((test) => <li key={test.id}><span><strong>{test.title}</strong><small>{test.subject}{test.batch ? ` · ${test.batch}` : ''}{test.notes ? ` · ${test.notes}` : ''}</small></span><span className="st-score"><CalendarClock size={14} /> {formatDay(test.date)}{test.time ? ` ${test.time}` : ''}</span></li>)}</ul>
          : <p className="st-muted-box">No tests are scheduled right now.</p>}</div>
      <RateTeachers user={user} />
    </div>
  </>
}

function RateTeachers({ user }) {
  const [teachers, setTeachers] = useState([])
  const [ratings, setRatings] = useState([])
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { listTeachers().then(setTeachers).catch(() => setTeachers([])) }, [])
  useEffect(() => subscribeMyRatings(user.uid, setRatings), [user.uid])
  const mine = Object.fromEntries(ratings.map((rating) => [rating.teacherUid, rating]))
  const save = async (teacher, rating) => {
    setSaving(teacher.id); setMessage('')
    try { await rateTeacher(user.uid, teacher, rating, draft[teacher.id] ?? mine[teacher.id]?.comment ?? ''); setMessage(`Thanks — your rating for ${teacher.name} is saved.`) } catch { setMessage('Your rating could not be saved. Please try again.') } finally { setSaving('') }
  }
  return <div className="st-card"><div className="st-card-head"><h2>Rate your teachers</h2><small>Anonymous to teachers</small></div>
    {!teachers.length ? <p className="st-muted-box">Teacher ratings will open here soon.</p>
      : <ul className="st-topic-list">{teachers.map((teacher) => {
        const current = mine[teacher.id]?.rating || 0
        return <li key={teacher.id} style={{ flexWrap: 'wrap' }}>
          <span><strong>{teacher.name}</strong><small>{teacher.subjects}</small></span>
          <span className="tp-stars" role="radiogroup" aria-label={`Rate ${teacher.name}`}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={current === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} disabled={saving === teacher.id} onClick={() => save(teacher, n)} style={{ border: 0, padding: 2, background: 'transparent', cursor: 'pointer', color: 'inherit' }}><Star size={18} className={current >= n ? '' : 'off'} fill={current >= n ? 'currentColor' : 'none'} /></button>)}</span>
          {current > 0 && <input style={{ flex: '1 1 100%', marginTop: 6, padding: '6px 10px', border: '1px solid #dfe6f2', borderRadius: 8 }} value={draft[teacher.id] ?? mine[teacher.id]?.comment ?? ''} maxLength={500} placeholder="Add a comment (optional), then press Enter" aria-label={`Comment for ${teacher.name}`}
            onChange={(event) => setDraft({ ...draft, [teacher.id]: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') save(teacher, current) }} />}
        </li>
      })}</ul>}
    {message && <p className="st-muted-box" role="status" style={{ marginTop: 12 }}>{message}</p>}
  </div>
}
