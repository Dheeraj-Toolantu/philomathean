import { useState } from 'react'
import { signOutAdmin } from '../firebase/auth'
import ResultsManager from '../components/admin/ResultsManager'
import PastPapersManager from '../components/admin/PastPapersManager'

export default function AdminDashboard({ user }) {
  const [tab, setTab] = useState('results')
  const logout = async () => { await signOutAdmin(); window.location.href = '/admin/login' }
  return <main className="admin-dashboard"><header className="admin-topbar"><a className="logo-lockup" href="/"><img src="/media/logo.png" alt="Philomathean" /><span><strong>PHILOMATHEAN</strong><small>ADMIN DASHBOARD</small></span></a><div><span>{user.email}</span><button type="button" onClick={logout}>Sign out</button></div></header><section className="admin-dashboard-content"><div className="admin-dashboard-intro"><span className="pill blue-pill">Content control centre</span><h1>Keep your website <span>current.</span></h1><p>Manage the achievements and learning resources your students rely on.</p></div><nav className="admin-tabs"><button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Student results</button><button className={tab === 'papers' ? 'active' : ''} onClick={() => setTab('papers')}>Past papers</button></nav>{tab === 'results' ? <ResultsManager user={user} /> : <PastPapersManager user={user} />}</section></main>
}
