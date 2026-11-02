import { useState } from 'react'
import { Check, Link2, MessageCircle } from 'lucide-react'
import { ratingUrl, whatsappShareUrl } from './ratingLinks'

// Buttons the administrator uses to send students a teacher's rating link: share on WhatsApp, or copy the link.
export default function ShareRatingLink({ teacher, compact = false }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(ratingUrl(teacher.id)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { window.prompt('Copy this rating link', ratingUrl(teacher.id)) }
  }
  const size = compact ? 14 : 15
  return <span className="tp-share-rating">
    <a className="adm-button adm-button-ghost adm-button-small tp-whatsapp" href={whatsappShareUrl(teacher, window.location.origin)} target="_blank" rel="noopener noreferrer" aria-label={`Share ${teacher.name}’s rating link on WhatsApp`}><MessageCircle size={size} />{!compact && ' WhatsApp'}</a>
    <button type="button" className="adm-icon-button" onClick={copy} aria-label={`Copy ${teacher.name}’s rating link`} title={copied ? 'Copied' : 'Copy rating link'}>{copied ? <Check size={size} /> : <Link2 size={size} />}</button>
  </span>
}
