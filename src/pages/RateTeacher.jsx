import { useEffect, useState } from 'react'
import { CheckCircle2, LogIn, Star } from 'lucide-react'
import { SiteFooter, SiteHeader } from '../components/site/SiteChrome'
import { teacherSlug } from '../components/site/faculty'
import { ensureStudentProfile, hasTeacherRequest, isTeacherAccount, signOutStudent } from '../firebase/student'
import { getMyRating, getTeacher, rateTeacher } from '../firebase/teaching'
import { facultyEntryFor, ratingPath } from '../teacher/ratingLinks'
import { loginUrl, useSession } from '../student/session'
import { dashboardUrl } from '../student/links'
import '../student/student.css'
import '../teacher/teacher.css'

const LABELS = ['', 'Needs a lot of improvement', 'Could be better', 'Good', 'Very good', 'Excellent']

// /rate/{teacherUid}: the page an administrator shares over WhatsApp. Students log in with their student account
// and rate the teacher 1–5 with an optional comment. Teacher accounts can't rate (the Firestore rules enforce this too).
export default function RateTeacher({ teacherUid }) {
  const { status, user, profile } = useSession()
  const [state, setState] = useState({ loading: true, teacher: null, role: null })
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (status !== 'ready' || !user) return undefined
    let active = true
    Promise.all([getTeacher(teacherUid).catch(() => null), isTeacherAccount(user.uid), hasTeacherRequest(user.uid), getMyRating(user.uid, teacherUid)])
      .then(([teacher, isTeacher, requested, mine]) => {
        if (!active) return
        if (mine) { setRating(mine.rating || 0); setComment(mine.comment || '') }
        setState({ loading: false, teacher, role: isTeacher || requested ? 'teacher' : 'student' })
      })
    return () => { active = false }
  }, [status, user, teacherUid])

  // Accounts created by an administrator get their student profile on first visit, as on the dashboard.
  useEffect(() => {
    if (state.role === 'student' && user && !profile) ensureStudentProfile(user).catch(() => {})
  }, [state.role, user, profile])

  const entry = facultyEntryFor(state.teacher?.name)
  useEffect(() => { document.title = state.teacher ? `Rate ${state.teacher.name} | Philomathean` : 'Rate your teacher | Philomathean' }, [state.teacher])

  const save = async (event) => {
    event.preventDefault()
    if (!rating) return setMessage({ type: 'error', text: 'Tap a star to choose your rating.' })
    setSaving(true); setMessage(null)
    try {
      if (!profile) await ensureStudentProfile(user)
      await rateTeacher(user.uid, state.teacher, rating, comment)
      setMessage({ type: 'success', text: `Thank you! Your rating for ${state.teacher.name} is saved. You can change it any time.` })
    } catch { setMessage({ type: 'error', text: 'Your rating could not be saved. Please try again.' }) } finally { setSaving(false) }
  }
  const switchAccount = async () => { await signOutStudent().catch(() => {}); window.location.replace(loginUrl(ratingPath(teacherUid))) }

  let body
  if (status === 'loading' || (user && state.loading)) body = <div className="st-dash-loading" aria-busy="true"><span className="st-spinner" /> Loading…</div>
  else if (!user) body = <section className="st-empty-page">
    <p className="st-eyebrow">Teacher rating</p>
    <h1>Rate your teacher</h1>
    <p>Log in with your Philomathean student account to rate this teacher. Teachers see the average and comments, not who wrote them.</p>
    <a className="st-primary" href={loginUrl(ratingPath(teacherUid))}><LogIn size={16} /> Log in to rate</a>
  </section>
  else if (state.role === 'teacher') body = <section className="st-empty-page">
    <h1>Only students can rate teachers</h1>
    <p>You’re signed in with a teacher account. Log in with a student account to leave a rating.</p>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}><a className="st-secondary" href="/teacher">Open teacher portal</a><button type="button" className="st-primary" onClick={switchAccount}>Use a student account</button></div>
  </section>
  else if (!state.teacher) body = <section className="st-empty-page">
    <h1>This teacher isn’t available</h1>
    <p>The link may be old. You can rate all your teachers from your dashboard.</p>
    <a className="st-primary" href={dashboardUrl('report')}>Go to my dashboard</a>
  </section>
  else body = <section className="st-shared"><div className="st-shared-card">
    <div className="st-shared-head">
      {entry ? <img src={entry[3]} alt="" width={88} height={88} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }} /> : <span className="adm-avatar" aria-hidden="true" style={{ width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#e8f2fd', color: '#0b2149', font: '800 32px var(--display)' }}>{state.teacher.name[0]}</span>}
      <div>
        <p className="st-eyebrow">Rate your teacher</p>
        <h1>{state.teacher.name}</h1>
        <p>{state.teacher.subjects || entry?.[2]}</p>
        {entry && <a className="st-text-button" href={`/teachers/${teacherSlug(entry[0])}`}>View profile</a>}
      </div>
    </div>
    <form onSubmit={save} style={{ display: 'grid', gap: 14, marginTop: 20 }}>
      <div>
        <span className="tp-stars" role="radiogroup" aria-label={`Rate ${state.teacher.name}`}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} disabled={saving} onClick={() => setRating(n)} style={{ border: 0, padding: 4, background: 'transparent', cursor: 'pointer', color: 'inherit' }}><Star size={34} className={rating >= n ? '' : 'off'} fill={rating >= n ? 'currentColor' : 'none'} /></button>)}</span>
        <p style={{ color: 'var(--st-muted)', margin: '4px 0 0', minHeight: 20 }}>{LABELS[rating]}</p>
      </div>
      <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>What do you like, or what could be better? (optional)
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={4} style={{ padding: '10px 12px', border: '1px solid #dfe6f2', borderRadius: 10, font: 'inherit', fontWeight: 400 }} />
      </label>
      {message && <p className={`st-alert ${message.type === 'success' ? 'st-alert-success' : 'st-alert-error'}`} role={message.type === 'success' ? 'status' : 'alert'}>{message.type === 'success' && <CheckCircle2 size={16} />} {message.text}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="st-primary" disabled={saving}>{saving ? 'Saving…' : 'Submit rating'}</button>
        <a className="st-secondary" href={dashboardUrl('report')}>Rate other teachers</a>
      </div>
      <small style={{ color: 'var(--st-muted)' }}>Your teacher sees the average rating and comments, not your name.</small>
    </form>
  </div></section>

  return <main className="st-page"><SiteHeader />{body}<SiteFooter /></main>
}
