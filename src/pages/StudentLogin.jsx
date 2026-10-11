import { useEffect, useState } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, Eye, EyeOff, GraduationCap, KeyRound, Mail, Share2, Trophy, UserRound } from 'lucide-react'
import { authErrorMessage, resetStudentPassword, signInStudent, signInStudentWithGoogle, signOutStudent, signUpStudent } from '../firebase/student'
import { BrandLockup } from '../components/site/SiteChrome'
import { safeNext, useSession } from '../student/session'
import '../student/student.css'

const params = new URLSearchParams(window.location.search)
const CURRICULA = ['IBDP', 'IB MYP', 'IGCSE', 'AS & A Level', 'SAT / ACT', 'Other']
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Gap year / Other']
const perks = [
  [GraduationCap, 'Topic quizzes, revision ladders and timed mock exams'],
  [BarChart3, 'Track accuracy, streaks and topic mastery as you practise'],
  [Trophy, 'Earn achievements and see every exam you’ve taken'],
  [Share2, 'Share a progress card with parents and teachers'],
]

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
  const next = safeNext(params.get('next'))

  // Already signed in when the page opened: continue to where the student was going.
  useEffect(() => { if (status !== 'loading' && user && !attempted) window.location.replace(next) }, [status, user, attempted, next])

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
  const switchMode = (value) => { setMode(value); setError(''); setNotice('') }
  const run = async (action) => {
    setAttempted(true); setBusy(true); setError(''); setNotice('')
    try { await action(); window.location.replace(next) } catch (authError) {
      // If sign-in worked but the profile could not be created, sign out so the student can simply retry.
      await signOutStudent().catch(() => {})
      setError(authErrorMessage(authError)); setBusy(false)
    }
  }
  const submit = (event) => {
    event.preventDefault()
    if (mode === 'reset') {
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

  const titles = { login: ['Welcome back', 'Log in to continue your revision.'], signup: ['Create your student account', 'Free forever. Upgrade to Gold any time.'], reset: ['Reset your password', 'We’ll email you a secure link to choose a new one.'] }
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
          <button type="button" className="st-google" onClick={() => run(signInStudentWithGoogle)} disabled={busy}><GoogleMark /> Continue with Google</button>
          <div className="st-or"><span>or use email</span></div>
        </>}

        <form onSubmit={submit} className="st-form" noValidate={false}>
          {mode === 'signup' && <label className="st-field"><span>Full name</span><span className="st-input"><UserRound size={16} /><input required value={form.name} onChange={set('name')} autoComplete="name" placeholder="Your name" /></span></label>}
          <label className="st-field"><span>Email address</span><span className="st-input"><Mail size={16} /><input type="email" required value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" /></span></label>
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
