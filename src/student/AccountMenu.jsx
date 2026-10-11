import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Crown, FileText, Home, LogOut, Sigma, UserRound } from 'lucide-react'
import { signOutStudent } from '../firebase/student'
import { hasGold } from './access'
import { DASHBOARD_TABS, dashboardUrl } from './links'
import { useSession } from './session'

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'S'
export function Avatar({ name, src, size = 36, className = '' }) {
  const [failed, setFailed] = useState(false)
  return <span className={`st-avatar ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
    {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" /> : initials(name)}
  </span>
}

export function PlanBadge({ profile, compact = false }) {
  const gold = hasGold(profile)
  return <span className={gold ? 'st-plan st-plan-gold' : 'st-plan'}>{gold && <Crown size={12} aria-hidden="true" />}{gold ? 'Gold' : compact ? 'Free' : 'Free plan'}</span>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useOutsideClose = (open, setOpen) => {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, setOpen])
  return ref
}

// Header control: "Log in" for visitors, "Hi, Name" with a menu for signed-in students.
export function AccountMenu() {
  const { status, user, profile } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, setOpen)
  if (status === 'loading' && !user) return <span className="st-account-skeleton" aria-hidden="true" />
  if (!user) return <a className="st-login-link" href={`/login?next=${encodeURIComponent(window.location.pathname === '/' ? '/dashboard' : window.location.pathname + window.location.search)}`}><UserRound size={15} /> Log in</a>
  const name = profile?.displayName || user.displayName || user.email || 'Student'
  const photo = profile?.photoURL ?? user.photoURL
  const logout = async () => { await signOutStudent(); window.location.href = '/' }
  return <div className="st-account" ref={ref}>
    <button type="button" className="st-account-trigger" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
      <Avatar name={name} src={photo} size={32} />
      <span className="st-account-hi">Hi, <strong>{name.split(/[\s@]/)[0]}</strong></span>
      {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
    </button>
    {open && <div className="st-account-menu" role="menu">
      <div className="st-account-head"><Avatar name={name} src={photo} size={44} /><span><strong>{name}</strong><small>{user.email}</small><PlanBadge profile={profile} /></span></div>
      {DASHBOARD_TABS.map(([id, label, Icon]) => <a key={id} role="menuitem" href={dashboardUrl(id)}><Icon size={16} /> {label}</a>)}
      <a role="menuitem" href="/courses"><Sigma size={16} /> Browse courses</a>
      <a role="menuitem" href="/premium-sources"><FileText size={16} /> Past papers</a>
      <a role="menuitem" href="/"><Home size={16} /> Philomathean website</a>
      {!hasGold(profile) && <a role="menuitem" className="st-account-upgrade" href={dashboardUrl('subscription')}><Crown size={16} /> Upgrade to Gold</a>}
      <button type="button" role="menuitem" onClick={logout}><LogOut size={16} /> Sign out</button>
    </div>}
  </div>
}

