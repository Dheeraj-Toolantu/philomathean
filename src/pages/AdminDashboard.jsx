import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, Lock, LogOut, Trophy, Unlock } from 'lucide-react'
import { signOutAdmin } from '../firebase/auth'
import { countAdminPapers, countAdminResults } from '../firebase/content'
import ResultsManager from '../components/admin/ResultsManager'
import PastPapersManager from '../components/admin/PastPapersManager'
import { ToastStack } from '../components/admin/AdminUI'
import { useToasts } from '../components/admin/hooks'
import '../components/admin/admin.css'

const readTab = () => new URLSearchParams(window.location.search).get('tab') === 'results' ? 'results' : 'papers'
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening' }

// Counts come from server-side aggregation queries: one cheap request each, no documents downloaded.
const loadStats = async () => {
  const [papers, free, premium, results] = (await Promise.allSettled([countAdminPapers({}), countAdminPapers({ access: 'free' }), countAdminPapers({ access: 'premium' }), countAdminResults()])).map((result) => result.status === 'fulfilled' ? result.value : '—')
  return { papers, free, premium, results }
}

export default function AdminDashboard({ user }) {
  const [tab, setTab] = useState(readTab)
  const [stats, setStats] = useState(null)
  const [statsToken, setStatsToken] = useState(0)
  const { toasts, notify, dismiss } = useToasts()
  const refreshStats = useCallback(() => setStatsToken((token) => token + 1), [])

  useEffect(() => {
    let active = true
    loadStats().then((next) => { if (active) setStats(next) })
    return () => { active = false }
  }, [statsToken])

  const selectTab = (next) => { setTab(next); window.history.replaceState(null, '', next === 'papers' ? '/admin' : `/admin?tab=${next}`) }
  const logout = async () => { await signOutAdmin(); window.location.href = '/admin/login' }
  const cards = [
    ['Past papers', stats?.papers, FileText, 'blue', 'papers'],
    ['Free papers', stats?.free, Unlock, 'green', 'papers'],
    ['Premium papers', stats?.premium, Lock, 'amber', 'papers'],
    ['Student results', stats?.results, Trophy, 'orange', 'results'],
  ]

  return <div className="adm-shell">
    <header className="adm-topbar">
      <a className="adm-brand" href="/admin"><img src="/media/logo.png" alt="" /><span><strong>Philomathean</strong><small>Admin</small></span></a>
      <div className="adm-topbar-actions">
        <a className="adm-button adm-button-ghost adm-hide-mobile" href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} /> View website</a>
        <span className="adm-user" title={user.email}><span className="adm-user-avatar">{(user.email || '?')[0].toUpperCase()}</span><span className="adm-hide-mobile">{user.email}</span></span>
        <button type="button" className="adm-icon-button" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
      </div>
    </header>

    <main className="adm-main">
      <section className="adm-hero">
        <div><p className="adm-eyebrow">{greeting()}</p><h1>Content control centre</h1><p>Keep past papers and student achievements on your website up to date.</p></div>
      </section>

      <section className="adm-stats" aria-label="Summary">
        {cards.map(([label, value, Icon, tone, target]) => <button type="button" key={label} className={`adm-stat adm-stat-${tone}`} onClick={() => selectTab(target)}>
          <span className="adm-stat-icon"><Icon size={19} /></span>
          <span className="adm-stat-label">{label}</span>
          <strong>{value == null ? <span className="adm-stat-skeleton" /> : value}</strong>
        </button>)}
      </section>

      <nav className="adm-tabs" role="tablist" aria-label="Content type">
        {[['papers', 'Past papers', FileText, stats?.papers], ['results', 'Student results', Trophy, stats?.results]].map(([id, label, Icon, count]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => selectTab(id)}><Icon size={16} /> {label}{typeof count === 'number' && <span className="adm-tab-count">{count}</span>}</button>)}
      </nav>

      {tab === 'papers' ? <PastPapersManager user={user} notify={notify} onChanged={refreshStats} /> : <ResultsManager user={user} notify={notify} onChanged={refreshStats} />}
    </main>
    <ToastStack toasts={toasts} onDismiss={dismiss} />
  </div>
}
