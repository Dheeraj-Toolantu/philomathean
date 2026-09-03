import { useState } from 'react'
import { signInAdmin } from '../firebase/auth'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await signInAdmin(email, password); window.location.href = '/admin' } catch (loginError) { setError(loginError.message === 'ADMIN_ACCESS_REQUIRED' ? 'This account is not configured as an administrator.' : 'Unable to sign in with those credentials.') } finally { setBusy(false) }
  }
  return <main className="admin-page"><section className="admin-login"><div className="pill blue-pill">Philomathean Administration</div><h1>Welcome back</h1><p>Sign in to manage student results and past-paper resources.</p><form onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label><label>Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="orange-button" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button></form><a href="/">Return to website</a></section></main>
}
