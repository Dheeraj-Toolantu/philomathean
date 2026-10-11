import { useCallback, useEffect, useState } from 'react'
import { Crown, GraduationCap, Search } from 'lucide-react'
import { listStudents, setStudentPlan } from '../../firebase/student'
import { EmptyState, SkeletonRows } from './AdminUI'

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'
const date = (value) => value ? new Date(value.toDate ? value.toDate() : value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const isGold = (student) => student.plan === 'gold' && (!student.planExpiresAt || new Date(student.planExpiresAt) > new Date())

// Student accounts from the portal. Gold is activated here after admissions confirm the upgrade.
export default function StudentsManager({ notify }) {
  const [state, setState] = useState({ loading: true, error: false, students: [] })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const load = useCallback(() => {
    listStudents().then((students) => setState({ loading: false, error: false, students })).catch(() => setState({ loading: false, error: true, students: [] }))
  }, [])
  useEffect(() => { load() }, [load])

  const change = async (student, plan) => {
    setBusy(student.id)
    try {
      await setStudentPlan(student.id, plan)
      notify('success', plan === 'gold' ? `${student.displayName} is now on Gold for 12 months.` : `${student.displayName} was moved to the Free plan.`)
      load()
    } catch { notify('error', 'The plan could not be changed.') } finally { setBusy('') }
  }
  const text = query.trim().toLowerCase()
  const requests = state.students.filter((student) => student.planRequest && !isGold(student))
  const shown = state.students.filter((student) => (filter === 'all' || (filter === 'requests' ? student.planRequest && !isGold(student) : filter === 'gold' ? isGold(student) : !isGold(student)))
    && (!text || `${student.displayName} ${student.email} ${student.school} ${student.curriculum}`.toLowerCase().includes(text)))

  return <section className="adm-panel">
    <header className="adm-panel-head">
      <div><h2>Students</h2><p>Portal accounts, their plan and Gold upgrade requests ({requests.length} pending).</p></div>
    </header>
    <div className="adm-toolbar">
      <label className="adm-student-search"><Search size={15} /><span className="sr-only">Search students</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, school" /></label>
      <select value={filter} onChange={(event) => setFilter(event.target.value)} className={filter !== 'all' ? 'active' : ''} aria-label="Filter by plan">
        <option value="all">All students</option><option value="requests">Gold requests</option><option value="gold">Gold</option><option value="free">Free</option>
      </select>
    </div>
    {state.error ? <EmptyState icon={GraduationCap} title="Students could not be loaded" message="Check your connection and that the Firestore rules are deployed." action={<button type="button" className="adm-button adm-button-ghost" onClick={load}>Try again</button>} />
      : state.loading ? <SkeletonRows count={5} />
      : !shown.length ? <EmptyState icon={GraduationCap} title={state.students.length ? 'No students match' : 'No students yet'} message={state.students.length ? 'Try a different search or filter.' : 'Students appear here when they create an account at /login.'} />
      : <div className="adm-list">
        <div className="adm-list-head adm-student-grid" aria-hidden="true"><span>Student</span><span>Curriculum</span><span>Plan</span><span /></div>
        {shown.map((student) => <article className="adm-row adm-student-grid" key={student.id}>
          <div className="adm-row-main">
            {student.photoURL ? <img className="adm-avatar adm-avatar-photo" src={student.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="adm-avatar">{initials(student.displayName)}</span>}
            <div><strong>{student.displayName || 'Student'}</strong><small title={student.email}>{student.email}{student.phone ? ` · ${student.phone}` : ''} · joined {date(student.createdAt)}</small>
              {student.planRequest && !isGold(student) && <small className="adm-request">Gold requested {date(student.planRequest.at)}{student.planRequest.note ? ` — “${student.planRequest.note}”` : ''}</small>}</div>
          </div>
          <span className="adm-student-meta">{[student.curriculum, student.grade].filter(Boolean).join(' · ') || '—'}</span>
          <div className="adm-badges">{isGold(student) ? <span className="adm-badge adm-badge-premium"><Crown size={12} /> Gold{student.planExpiresAt ? ` · until ${date(student.planExpiresAt)}` : ''}</span> : <span className="adm-badge adm-badge-free">Free</span>}</div>
          <div className="adm-row-actions">
            {isGold(student) ? <button type="button" className="adm-button adm-button-ghost" disabled={busy === student.id} onClick={() => change(student, 'free')}>Set to Free</button>
              : <button type="button" className="adm-button adm-button-primary" disabled={busy === student.id} onClick={() => change(student, 'gold')}><Crown size={15} /> Activate Gold</button>}
          </div>
        </article>)}
      </div>}
  </section>
}
