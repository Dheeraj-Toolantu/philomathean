import { useState } from 'react'
import { CheckCircle2, Copy, RefreshCw } from 'lucide-react'
import { accountErrorMessage, createAccount } from '../../firebase/accounts'
import { loginIdError, suggestPassword } from '../../firebase/loginId'

const CURRICULA = ['IGCSE', 'IBDP', 'AS & A Level', 'IB MYP', 'Grades 6–8 Foundation', 'SAT / ACT', 'AMC / Olympiad / PSAT', 'Other']
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Gap year / Other']
const loginUrl = () => `${window.location.origin}/login`

// Admin form that creates a student or teacher account with a login ID and password, then shows the
// credentials once so they can be handed over. Passwords are never stored anywhere except Firebase Auth.
export default function CreateAccountForm({ role, defaultOrder = '', onCreated, onCancel, busy, setBusy }) {
  const [form, setForm] = useState({ name: '', loginId: '', password: suggestPassword(), curriculum: '', grade: '', phone: '', school: '', plan: 'free', subjects: '', order: defaultOrder })
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const idProblem = form.loginId ? loginIdError(form.loginId) : null

  const submit = async (event) => {
    event.preventDefault(); setError('')
    setBusy(true)
    try {
      const account = await createAccount({ role, ...form })
      setCreated({ ...account, name: form.name.trim(), password: form.password })
      onCreated(account)
    } catch (createError) { setError(accountErrorMessage(createError)) } finally { setBusy(false) }
  }
  const credentials = created ? `Philomathean ${role} login\nName: ${created.name}\nLogin ID: ${created.loginId}\nPassword: ${created.password}\nSign in at: ${loginUrl()}` : ''
  const copy = () => navigator.clipboard?.writeText(credentials).then(() => setCopied(true)).catch(() => {})

  if (created) return <div className="adm-form"><div className="adm-form-body"><section className="adm-form-section">
    <p className="tp-notice"><CheckCircle2 size={15} /> {created.name}’s {role} account is ready. Share these details with them; the password is not shown again.</p>
    <pre className="adm-credentials">{credentials}</pre>
    <p className="adm-hint">{role === 'teacher' ? 'They sign in at /login and go straight to the teacher portal.' : 'They sign in at /login and land on their student dashboard.'}</p>
  </section></div>
  <footer className="adm-form-footer"><button type="button" className="adm-button adm-button-ghost" onClick={copy}><Copy size={15} /> {copied ? 'Copied' : 'Copy details'}</button><button type="button" className="adm-button adm-button-primary" onClick={onCancel}>Done</button></footer></div>

  return <form className="adm-form" onSubmit={submit} noValidate>
    <div className="adm-form-body"><section className="adm-form-section">
      <label className="adm-field">Full name<input value={form.name} onChange={set('name')} placeholder={role === 'teacher' ? 'Pawan Yadav' : 'Aarav Mehta'} maxLength={80} required /></label>
      <label className="adm-field">Login ID<input value={form.loginId} onChange={set('loginId')} placeholder={role === 'teacher' ? 'pawan.yadav' : 'aarav.mehta'} autoCapitalize="none" spellCheck={false} maxLength={120} aria-invalid={Boolean(idProblem)} required />
        {idProblem ? <small>{idProblem}</small> : <span className="adm-hint">A short ID like <b>aarav.mehta</b>, or a real email address if you want password-reset emails to work.</span>}</label>
      <label className="adm-field">Password<span style={{ display: 'flex', gap: 8 }}><input value={form.password} onChange={set('password')} minLength={8} autoComplete="new-password" required /><button type="button" className="adm-icon-button" onClick={() => setForm({ ...form, password: suggestPassword() })} aria-label="Suggest another password" title="Suggest another password"><RefreshCw size={15} /></button></span>
        {form.password && form.password.length < 8 && <small>At least 8 characters.</small>}</label>
      {role === 'student' ? <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="adm-field">Curriculum<select value={form.curriculum} onChange={set('curriculum')}><option value="">Select…</option>{CURRICULA.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="adm-field">Grade<select value={form.grade} onChange={set('grade')}><option value="">Select…</option>{GRADES.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label className="adm-field">School<input value={form.school} onChange={set('school')} maxLength={120} /></label>
        <label className="adm-field">Phone<input value={form.phone} onChange={set('phone')} maxLength={20} inputMode="tel" /></label>
        <label className="adm-field">Plan<select value={form.plan} onChange={set('plan')}><option value="free">Free</option><option value="gold">Gold (12 months)</option></select></label>
      </> : <>
        <label className="adm-field">Subjects<input value={form.subjects} onChange={set('subjects')} placeholder="Mathematics (IGCSE & A Levels)" maxLength={120} /></label>
        <label className="adm-field">Order in hierarchy<input type="number" min="1" value={form.order} onChange={set('order')} /></label>
      </>}
      {error && <p className="adm-field-error" role="alert">{error}</p>}
    </section></div>
    <footer className="adm-form-footer"><button type="button" className="adm-button adm-button-ghost" onClick={onCancel} disabled={busy}>Cancel</button><button className="adm-button adm-button-primary" disabled={busy || Boolean(idProblem)}>{busy ? 'Creating…' : `Create ${role} account`}</button></footer>
  </form>
}
