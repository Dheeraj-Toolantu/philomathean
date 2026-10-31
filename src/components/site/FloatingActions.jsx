import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Phone, Search, X } from 'lucide-react'

const WHATSAPP_NUMBER = '919324164073'
const CALL_NUMBER = '+919324164073'
const WHATSAPP_TEXT = 'Hello Philomathean, I would like to know more about your programmes.'

const WhatsAppMark = () => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.13c-.24.69-1.42 1.32-1.96 1.37-.5.05-1.13.07-1.82-.11a16.6 16.6 0 0 1-1.65-.61c-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.21.55.33.07.12.07.69-.17 1.37Z" /></svg>

// Floating call-to-action buttons on every public page: site search, WhatsApp chat and a phone call.
export function FloatingActions() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return <>
    <div className="float-actions" aria-label="Quick actions">
      <button type="button" className="float-button float-search" onClick={() => setOpen(true)} aria-label="Search the website" title="Search"><Search size={22} /></button>
      <a className="float-button float-call" href={`tel:${CALL_NUMBER}`} aria-label="Call Philomathean" title="Call us"><Phone size={21} /></a>
      <a className="float-button float-whatsapp" href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp" title="WhatsApp us"><WhatsAppMark /></a>
    </div>
    {open && <SearchDialog onClose={close} />}
  </>
}

function SearchDialog({ onClose }) {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState(null)
  const [active, setActive] = useState(0)
  const input = useRef(null)
  // The index (courses, teachers, papers) loads only when someone opens search.
  useEffect(() => {
    let alive = true
    import('./siteSearch.js').then((module) => { if (alive) setEngine({ index: module.buildSearchIndex(), search: module.searchSite }) })
    input.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('float-no-scroll')
    return () => { alive = false; document.removeEventListener('keydown', onKey); document.body.classList.remove('float-no-scroll') }
  }, [onClose])
  const results = engine ? engine.search(engine.index, query) : []
  const go = (item) => { if (item) window.location.href = item.href }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(results.length - 1, index + 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)) }
    if (event.key === 'Enter') { event.preventDefault(); go(results[active]) }
  }
  return createPortal(<div className="float-overlay" onMouseDown={onClose}>
    <div className="float-dialog" role="dialog" aria-modal="true" aria-label="Search the website" onMouseDown={(event) => event.stopPropagation()}>
      <div className="float-search-bar">
        <Search size={19} aria-hidden="true" />
        <input ref={input} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0) }} onKeyDown={onKeyDown} placeholder="Search programmes, courses, past papers, teachers…" aria-label="Search" aria-controls="float-results" />
        <button type="button" onClick={onClose} aria-label="Close search"><X size={18} /></button>
      </div>
      <ul className="float-results" id="float-results" role="listbox">
        {!query.trim() ? <li className="float-hint">Try “0606”, “AA HL”, “Checkpoint”, “SAT” or a teacher’s name.</li>
          : !engine ? <li className="float-hint">Loading…</li>
          : !results.length ? <li className="float-hint">No matches. <a href="/#enquiry" onClick={onClose}>Ask our admissions team</a> instead.</li>
          : results.map((item, index) => <li key={`${item.type}-${item.href}-${item.title}`} role="option" aria-selected={index === active}>
            <a href={item.href} className={index === active ? 'active' : ''} onMouseEnter={() => setActive(index)}><span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span><em>{item.type}</em><ArrowRight size={15} aria-hidden="true" /></a>
          </li>)}
      </ul>
    </div>
  </div>, document.body)
}
