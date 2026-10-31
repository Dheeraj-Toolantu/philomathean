import { useEffect, useState } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound, Link2, Mail, Share2, Trophy, UserRound } from 'lucide-react'
import {
  authErrorMessage, completeRedirectSignIn, getPendingLink, isTeacherAccount, resetStudentPassword, signInStudent, signInStudentWithProvider, signOutStudent, signUpStudent,
} from '../firebase/student'
import { auth } from '../firebase/config'
import { BrandLockup } from '../components/site/SiteChrome'
import { safeNext, useSession } from '../student/session'
import '../student/student.css'

const params = new URLSearchParams(window.location.search)
// With no page to return to, teachers go to the teacher portal and students to their dashboard.
const destination = async () => {
  const next = safeNext(params.get('next'))
  if (params.get('next')) return next
  const uid = auth.currentUser?.uid
  return uid && await isTeacherAccount(uid) ? '/teacher' : next
}
const CURRICULA = ['IGCSE', 'IBDP', 'AS & A Level', 'IB MYP', 'Grades 6–8 Foundation', 'SAT / ACT', 'AMC / Olympiad / PSAT', 'Other']
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Gap year / Other']
const perks = [
  [GraduationCap, 'Topic quizzes, revision ladders and timed mock exams'],
  [BarChart3, 'Track accuracy, streaks and topic mastery as you practise'],
  [Trophy, 'Earn achievements and see every exam you’ve taken'],
  [Share2, 'Share a progress card with parents and teachers'],
]

const FacebookMark = () => <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" /><path fill="#fff" d="m16.67 15.56.53-3.5h-3.32V9.81c0-.96.46-1.89 1.96-1.89h1.5V4.95s-1.37-.24-2.68-.24c-2.73 0-4.54 1.68-4.54 4.7v2.66H7.08v3.49h3.04V24a12.3 12.3 0 0 0 3.76 0v-8.44z" /></svg>
const GoogleMark = () => <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>

export default function StudentLogin() {
  const { status, user } = useSession()
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [form, setForm] = useState({ name: '', email: '', password: '', curriculum: '', grade: '', terms: false })
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [linking, setLinking] = useState(null)

  // Finishes a Google/Facebook sign-in that fell back to a full-page redirect (popup blocked).
  useEffect(() => {
    let active = true
    completeRedirectSignIn().then(async (signedIn) => { if (signedIn) window.location.replace(await destination()) }).catch((redirectError) => {
      if (!active) return
      setAttempted(true); setError(authErrorMessage(redirectError)); signOutStudent().catch(() => {})
    })
    return () => { active = false }
  }, [])

  // Already signed in when the page opened: continue to where the student was going.
  useEffect(() => { if (status !== 'loading' && user && !attempted) destination().then((target) => window.location.replace(target)) }, [status, user, attempted])

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
  const switchMode = (value) => { setMode(value); setError(''); setNotice('') }
  const run = async (action) => {
    setAttempted(true); setBusy(true); setError(''); setNotice('')
    try { await action(); window.location.replace(await destination()) } catch (authError) {
      // If sign-in worked but the profile could not be created, sign out so the student can simply retry.
      await signOutStudent().catch(() => {})
      const pending = getPendingLink()
      setLinking(pending)
      if (pending) { setMode('login'); if (pending.email) setForm((current) => ({ ...current, email: pending.email })) }
      setError(authErrorMessage(authError)); setBusy(false)
    }
  }
  const submit = (event) => {
    event.preventDefault()
    if (mode === 'reset') {
      if (!form.email.includes('@')) return setError('Accounts with a login ID can’t reset the password by email. Ask the institute for a new password.')
      setBusy(true); setError('')
      resetStudentPassword(form.email).then(() => setNotice('If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.')).catch((resetError) => setError(authErrorMessage(resetError))).finally(() => setBusy(false))
      return
    }
    if (mode === 'signup') {
      if (form.password.length < 8) return setError('Use a password of at least 8 characters.')
      if (!form.terms) return setError('Please accept the terms to create your account.')
      return run(() => signUpStudent(form))
    }
    return run(() => signInStudent(form.email, form.password))
  }

  const titles = { login: ['Welcome back', 'Students and teachers log in here, with an email or the login ID the institute gave you.'], signup: ['Create your student account', 'Free forever. Upgrade to Gold any time.'], reset: ['Reset your password', 'We’ll email you a secure link to choose a new one.'] }
  return <main className="st-auth">
    <aside className="st-auth-aside">
      <BrandLockup />
      <div className="st-auth-pitch">
        <span className="st-eyebrow">Philomathean Student Portal</span>
        <h1>Revise smarter. <span>See your progress.</span></h1>
        <ul>{perks.map(([Icon, text]) => <li key={text}><span><Icon size={18} /></span>{text}</li>)}</ul>
      </div>
      <p className="st-auth-quote">Questions written and reviewed by the Philomathean faculty — the teachers behind our 45/45 IBDP results.</p>
    </aside>

    <section className="st-auth-panel">
      <a className="st-auth-back" href="/"><ArrowLeft size={16} /> Back to website</a>
      <div className="st-auth-card">
        {mode !== 'reset' && <div className="st-auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Sign up</button>
        </div>}
        <h2>{titles[mode][0]}</h2>
        <p className="st-auth-sub">{titles[mode][1]}</p>

        {mode !== 'reset' && <>
          {linking && <p className="st-alert st-alert-info" role="status"><Link2 size={16} /> <span>Connecting {linking.label}{linking.email ? ` to ${linking.email}` : ''}. Log in below with the method you used before and {linking.label} will work for this account from now on.</span></p>}
          <div className="st-social">
            <button type="button" className="st-social-button" onClick={() => run(() => signInStudentWithProvider('google.com'))} disabled={busy || linking?.provider === 'google.com'}><GoogleMark /> {mode === 'signup' ? 'Sign up' : 'Log in'} with Google</button>
            <button type="button" className="st-social-button" onClick={() => run(() => signInStudentWithProvider('facebook.com'))} disabled={busy || linking?.provider === 'facebook.com'}><FacebookMark /> {mode === 'signup' ? 'Sign up' : 'Log in'} with Facebook</button>
          </div>
          {mode === 'signup' && <p className="st-social-terms">By continuing with Google or Facebook you agree to the terms of use and to Philomathean contacting you about your studies.</p>}
          <div className="st-or"><span>or use email</span></div>
        </>}

        <form onSubmit={submit} className="st-form" noValidate={false}>
          {mode === 'signup' && <label className="st-field"><span>Full name</span><span className="st-input"><UserRound size={16} /><input required value={form.name} onChange={set('name')} autoComplete="name" placeholder="Your name" /></span></label>}
          <label className="st-field"><span>{mode === 'login' ? 'Email or login ID' : 'Email address'}</span><span className="st-input"><Mail size={16} /><input type={mode === 'login' ? 'text' : 'email'} required value={form.email} onChange={set('email')} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={mode === 'login' ? 'you@example.com or your login ID' : 'you@example.com'} /></span></label>
          {mode !== 'reset' && <label className="st-field"><span className="st-field-row">Password{mode === 'login' && <button type="button" className="st-text-button" onClick={() => switchMode('reset')}>Forgot password?</button>}</span>
            <span className="st-input"><KeyRound size={16} /><input type={showPassword ? 'text' : 'password'} required minLength={mode === 'signup' ? 8 : undefined} value={form.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} />
              <button type="button" className="st-input-icon" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
          {mode === 'signup' && <div className="st-field-grid">
            <label className="st-field"><span>Curriculum</span><select value={form.curriculum} onChange={set('curriculum')}><option value="">Select…</option>{CURRICULA.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="st-field"><span>Grade</span><select value={form.grade} onChange={set('grade')}><option value="">Select…</option>{GRADES.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>}
          {mode === 'signup' && <label className="st-check"><input type="checkbox" checked={form.terms} onChange={set('terms')} /> <span>I agree to the terms of use and to Philomathean contacting me about my studies.</span></label>}
          {error && <p className="st-alert st-alert-error" role="alert">{error}</p>}
          {notice && <p className="st-alert st-alert-success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
          <button className="st-primary st-block" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button>
        </form>
        {mode === 'reset' && <button type="button" className="st-text-button st-center" onClick={() => switchMode('login')}><ArrowLeft size={14} /> Back to log in</button>}
        {mode === 'login' && <p className="st-auth-switch">New to Philomathean? <button type="button" className="st-text-button" onClick={() => switchMode('signup')}>Create a free account</button></p>}
        {mode === 'signup' && <p className="st-auth-switch">Already have an account? <button type="button" className="st-text-button" onClick={() => switchMode('login')}>Log in</button></p>}
      </div>
    </section>
  </main>
}
