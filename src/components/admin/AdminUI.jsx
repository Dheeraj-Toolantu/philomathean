import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, Info, X } from 'lucide-react'

// Overlays render into <body> so no page-level stacking context (e.g. `main > section { z-index }`) can trap them.
const Portal = ({ children }) => createPortal(<div className="adm-portal">{children}</div>, document.body)

const useEscape = (active, onEscape) => {
  useEffect(() => {
    if (!active) return undefined
    const onKey = (event) => { if (event.key === 'Escape') onEscape() }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('adm-no-scroll')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('adm-no-scroll') }
  }, [active, onEscape])
}

export function Drawer({ open, title, subtitle, locked, onClose, children }) {
  const close = () => { if (!locked) onClose() }
  useEscape(open, close)
  const panel = useRef(null)
  useEffect(() => { if (open) panel.current?.querySelector('input, select, textarea')?.focus() }, [open])
  if (!open) return null
  return <Portal><div className="adm-overlay" onMouseDown={close}>
    <aside className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby="adm-drawer-title" ref={panel} onMouseDown={(event) => event.stopPropagation()}>
      <header className="adm-drawer-head">
        <div><h2 id="adm-drawer-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className="adm-icon-button" onClick={close} disabled={locked} aria-label="Close panel"><X size={18} /></button>
      </header>
      {children}
    </aside>
  </div></Portal>
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy, onConfirm, onCancel }) {
  useEscape(open, () => { if (!busy) onCancel() })
  if (!open) return null
  return <Portal><div className="adm-overlay adm-overlay-center" onMouseDown={() => { if (!busy) onCancel() }}>
    <div className="adm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="adm-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <span className="adm-dialog-icon"><AlertTriangle size={22} /></span>
      <h2 id="adm-dialog-title">{title}</h2>
      <p>{message}</p>
      <div className="adm-dialog-actions">
        <button type="button" className="adm-button adm-button-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="adm-button adm-button-danger" onClick={onConfirm} disabled={busy} autoFocus>{busy ? 'Deleting…' : confirmLabel}</button>
      </div>
    </div>
  </div></Portal>
}

export function Pagination({ list, onPageSize, sizes = [10, 20, 50], noun }) {
  const { page, pageSize, total, totalPages, hasNext, loading, goTo } = list
  const from = total ? page * pageSize + 1 : 0
  const to = total == null ? 0 : Math.min(total, (page + 1) * pageSize)
  return <nav className="adm-pagination" aria-label={`${noun} pages`}>
    <span className="adm-pagination-summary">{loading && total == null ? 'Loading…' : total == null ? <>Showing <b>{page * pageSize + 1}–{page * pageSize + list.items.length}</b> {noun}</> : total ? <>Showing <b>{from}–{to}</b> of <b>{total}</b> {noun}</> : `No ${noun}`}</span>
    <label className="adm-page-size">Rows
      <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>{sizes.map((size) => <option key={size} value={size}>{size}</option>)}</select>
    </label>
    <div className="adm-pager">
      <button type="button" className="adm-icon-button" onClick={() => goTo(0)} disabled={loading || page === 0} aria-label="First page"><ChevronsLeft size={16} /></button>
      <button type="button" className="adm-icon-button" onClick={() => goTo(page - 1)} disabled={loading || page === 0} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <span className="adm-page-indicator">Page {page + 1}{totalPages ? ` of ${totalPages}` : ''}</span>
      <button type="button" className="adm-icon-button" onClick={() => goTo(page + 1)} disabled={loading || !hasNext} aria-label="Next page"><ChevronRight size={16} /></button>
    </div>
  </nav>
}

export function SkeletonRows({ count = 6 }) {
  return <div className="adm-list" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div className="adm-row adm-row-skeleton" key={index}><span /><span /><span /></div>)}</div>
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return <div className="adm-empty"><span className="adm-empty-icon"><Icon size={26} /></span><h3>{title}</h3><p>{message}</p>{action}</div>
}

const toastIcons = { success: CheckCircle2, error: AlertTriangle, info: Info }
export function ToastStack({ toasts, onDismiss }) {
  return <div className="adm-toasts" role="status" aria-live="polite">{toasts.map((toast) => {
    const Icon = toastIcons[toast.tone] || Info
    return <div key={toast.id} className={`adm-toast adm-toast-${toast.tone}`}><Icon size={18} /><span>{toast.message}</span><button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss"><X size={14} /></button></div>
  })}</div>
}
