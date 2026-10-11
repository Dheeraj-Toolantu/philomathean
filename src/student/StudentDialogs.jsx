import { useEffect, useRef, useState } from 'react'
import { Check, Crown, X } from 'lucide-react'
import { requestPlanUpgrade } from '../firebase/student'
import { GOLD_FEATURES, hasGold } from './access'
import { loginUrl, useSession } from './session'

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.querySelector('button, a, input, select, textarea')?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus?.() }
  }, [onClose])
  return <div className="st-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className={wide ? 'st-modal st-modal-wide' : 'st-modal'} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <button type="button" className="st-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      {children}
    </div>
  </div>
}


// Explains Gold and lets a signed-in student request it. Plans are activated by the institute.
export function UpgradeDialog({ onClose, reason }) {
  const { user, profile } = useSession()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requested = Boolean(profile?.planRequest)
  const request = async () => {
    setBusy(true); setError('')
    try { await requestPlanUpgrade(user.uid, 'gold', note) } catch { setError('Could not send the request. Please try again.') } finally { setBusy(false) }
  }
  return <Modal title="Upgrade to Gold" onClose={onClose}>
    <div className="st-upgrade">
      <span className="st-upgrade-icon"><Crown size={26} /></span>
      <h2>{hasGold(profile) ? 'You’re on Gold' : 'Unlock everything with Gold'}</h2>
      {reason && <p className="st-upgrade-reason">{reason}</p>}
      <ul>{GOLD_FEATURES.map((item) => <li key={item}><Check size={16} /> {item}</li>)}</ul>
      {!user ? <a className="st-gold-button st-block" href={loginUrl()}>Log in to upgrade</a>
        : hasGold(profile) ? <button type="button" className="st-primary st-block" onClick={onClose}>Continue</button>
        : requested ? <p className="st-alert st-alert-success" role="status"><Check size={16} /> Request received. Our admissions team will contact you to activate Gold.</p>
        : <>
          <label className="st-field"><span>Anything we should know? (optional)</span><textarea rows={2} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="e.g. preferred contact time, subjects you need" /></label>
          {error && <p className="st-alert st-alert-error" role="alert">{error}</p>}
          <button type="button" className="st-gold-button st-block" onClick={request} disabled={busy}>{busy ? 'Sending…' : 'Request Gold access'}</button>
          <p className="st-fineprint">Gold is activated by Philomathean admissions after a quick call — no card details are collected online.</p>
        </>}
    </div>
  </Modal>
}
