import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Pencil, Plus, Search, Star, Trash2, UserPlus, UserRound } from 'lucide-react'
import { listStudents } from '../../firebase/student'
import { listAllRatings, listTeachers, removeTeacher, saveTeacher } from '../../firebase/teaching'
import { ratingSummary } from '../../teacher/marks'
import { TEACHER_HIERARCHY } from '../site/faculty'
import { displayLoginId } from '../../firebase/loginId'
import { ConfirmDialog, Drawer, EmptyState, SkeletonRows } from './AdminUI'
import CreateAccountForm from './CreateAccountForm'
import '../../teacher/teacher.css'

// Suggested position in the teaching hierarchy, from the order the institute set (Satish Sir first).
const suggestedOrder = (name) => {
  const first = String(name).trim().split(/\s+/)[0]?.toLowerCase()
  const index = TEACHER_HIERARCHY.findIndex((item) => item.split(' ')[0].toLowerCase() === first)
  return index === -1 ? TEACHER_HIERARCHY.length + 1 : index + 1
}

// Teacher accounts. The administrator either creates a teacher account here (login ID + password), or adds an
// account the teacher already made at /login, so it can open the teacher portal at /teacher.
export default function TeachersManager({ notify }) {
  const [state, setState] = useState({ loading: true, error: false, teachers: [], accounts: [], ratings: [] })
  const [form, setForm] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    Promise.all([listTeachers(), listStudents(500), listAllRatings().catch(() => [])])
      .then(([teachers, accounts, ratings]) => setState({ loading: false, error: false, teachers, accounts, ratings }))
      .catch(() => setState((current) => ({ ...current, loading: false, error: true })))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (event) => {
    event.preventDefault()
    if (!form.uid) return notify('error', 'Choose the teacher’s account first.')
    if (!form.name.trim()) return notify('error', 'Add the teacher’s name.')
    setBusy(true)
    try { await saveTeacher(form.uid, form); notify('success', `${form.name} can now use the teacher portal.`); setForm(null); load() } catch { notify('error', 'The teacher could not be saved.') } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await removeTeacher(removing.id); notify('success', `${removing.name} no longer has teacher access.`); setRemoving(null); load() } catch { notify('error', 'Teacher access could not be removed.') } finally { setBusy(false) }
  }

  return <section className="adm-panel">
    <header className="adm-panel-head">
      <div><h2>Teachers</h2><p>Accounts that can open the <a href="/teacher">teacher portal</a> to enter test marks, see student-wise performance, schedule tests and read teaching material.</p></div>
      <div className="adm-dialog-actions"><a className="adm-button adm-button-ghost" href="/teacher"><ExternalLink size={15} /> Teacher portal</a><button type="button" className="adm-button adm-button-ghost" onClick={() => setForm({ uid: '', email: '', name: '', subjects: '', order: '' })}><Plus size={16} /> Add existing account</button><button type="button" className="adm-button adm-button-primary" onClick={() => setCreating(true)}><UserPlus size={16} /> Create teacher account</button></div>
    </header>
    <p className="adm-hint" style={{ margin: '0 0 14px' }}>Create a teacher account to give them a login ID and password. If a teacher already has an account from /login, use “Add existing account” instead.</p>
    {state.error ? <EmptyState icon={UserRound} title="Teachers could not be loaded" message="Check your connection and that the latest Firestore rules are deployed." action={<button type="button" className="adm-button adm-button-ghost" onClick={load}>Try again</button>} />
      : state.loading ? <SkeletonRows count={4} />
      : !state.teachers.length ? <EmptyState icon={UserRound} title="No teachers yet" message="Add your teachers so they can sign in to the teacher portal." />
      : <div className="adm-list">{state.teachers.map((teacher) => {
        const rating = ratingSummary(state.ratings.filter((item) => item.teacherUid === teacher.id))
        return <article className="adm-row" key={teacher.id} style={{ gridTemplateColumns: '1fr auto auto' }}>
          <div className="adm-row-main"><span className="adm-avatar">{teacher.order}</span><div><strong>{teacher.name}</strong><small>{[teacher.subjects, displayLoginId(teacher.email)].filter(Boolean).join(' · ')}</small></div></div>
          <span className="adm-student-meta"><Star size={13} /> {rating.average ?? '—'} ({rating.count})</span>
          <div className="adm-row-actions">
            <button type="button" className="adm-icon-button" onClick={() => setForm({ ...teacher, uid: teacher.id })} aria-label={`Edit ${teacher.name}`}><Pencil size={15} /></button>
            <button type="button" className="adm-icon-button" onClick={() => setRemoving(teacher)} aria-label={`Remove ${teacher.name}`}><Trash2 size={15} /></button>
          </div>
        </article>
      })}</div>}
    <Drawer open={Boolean(form)} title={form?.id ? 'Edit teacher' : 'Add teacher'} subtitle="Order sets the teaching hierarchy (1 = Satish Sir)." locked={busy} onClose={() => setForm(null)}>
      {form && <TeacherForm form={form} setForm={setForm} accounts={state.accounts} teachers={state.teachers} busy={busy} onSubmit={save} onCancel={() => setForm(null)} />}
    </Drawer>
    <Drawer open={creating} title="Create teacher account" subtitle="The teacher signs in at /login and goes straight to the teacher portal." locked={busy} onClose={() => setCreating(false)}>
      {creating && <CreateAccountForm role="teacher" defaultOrder={state.teachers.length + 1} busy={busy} setBusy={setBusy} onCreated={(account) => { notify('success', `Teacher account ${account.loginId} created.`); load() }} onCancel={() => setCreating(false)} />}
    </Drawer>
    <ConfirmDialog open={Boolean(removing)} title="Remove teacher access?" message={removing ? `${removing.name} will no longer be able to open the teacher portal. Marks they entered stay.` : ''} confirmLabel="Remove" busy={busy} onConfirm={remove} onCancel={() => setRemoving(null)} />
  </section>
}

function TeacherForm({ form, setForm, accounts, teachers, busy, onSubmit, onCancel }) {
  const [query, setQuery] = useState('')
  const taken = new Set(teachers.map((teacher) => teacher.id))
  const text = query.trim().toLowerCase()
  const options = text ? accounts.filter((account) => !taken.has(account.id) && `${account.displayName} ${account.email}`.toLowerCase().includes(text)).slice(0, 20) : []
  const pick = (account) => { setForm({ ...form, uid: account.id, email: account.email, name: form.name || account.displayName || '', order: form.order || suggestedOrder(account.displayName || '') }); setQuery('') }
  return <form className="adm-form" onSubmit={onSubmit} noValidate>
    <div className="adm-form-body"><section className="adm-form-section">
      {form.id ? <p className="adm-hint">Account: {form.email || form.id}</p> : <>
        <label className="adm-field">Teacher’s account<span className="adm-student-search" style={{ width: '100%' }}><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" /></span></label>
        {text && <ul className="tp-picker">{options.length ? options.map((account) => <li key={account.id}><button type="button" onClick={() => pick(account)}><span>{account.displayName || 'Account'}</span><small>{account.email}</small></button></li>) : <li className="float-hint">No matching account. Ask the teacher to sign up at /login first.</li>}</ul>}
        {form.uid && <p className="tp-notice">Selected: <b>{form.email}</b></p>}
      </>}
      <label className="adm-field">Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Pawan Yadav" maxLength={80} /></label>
      <label className="adm-field">Subjects<input value={form.subjects} onChange={(event) => setForm({ ...form, subjects: event.target.value })} placeholder="Mathematics (IGCSE & A Levels)" maxLength={120} /></label>
      <label className="adm-field">Order in hierarchy<input type="number" min="1" value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} /></label>
    </section></div>
    <footer className="adm-form-footer"><button type="button" className="adm-button adm-button-ghost" onClick={onCancel} disabled={busy}>Cancel</button><button className="adm-button adm-button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save teacher'}</button></footer>
  </form>
}
