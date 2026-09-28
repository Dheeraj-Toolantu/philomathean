import { useCallback, useState } from 'react'
import { Eye, FileText, Loader2, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { countAdminPapers, getAdminPaper, getAdminPapersPage, removePaper } from '../../firebase/content'
import { getFreePdfUrl, removePdf } from '../../firebase/storage'
import { EXAM_SESSIONS, PAPER_YEARS, SUPPORTED_PATHWAYS } from '../../firebase/validation'
import { ConfirmDialog, Drawer, EmptyState, Pagination, SkeletonRows } from './AdminUI'
import { usePagedList } from './hooks'
import PastPaperForm from './PastPaperForm'

const noFilters = { pathway: '', year: '', session: '', access: '' }
const filterOptions = [
  ['pathway', 'All pathways', SUPPORTED_PATHWAYS],
  ['year', 'All years', PAPER_YEARS],
  ['session', 'All sessions', EXAM_SESSIONS],
  ['access', 'Free & premium', [['free', 'Free'], ['premium', 'Premium']]],
]
const describe = (paper) => paper.paperType === 'topic-wise' ? `Topic · ${paper.topic || '—'}` : [paper.year, paper.session].filter(Boolean).join(' · ')

export default function PastPapersManager({ user, notify, onChanged }) {
  const [filters, setFilters] = useState(noFilters)
  const [pageSize, setPageSize] = useState(10)
  const list = usePagedList(getAdminPapersPage, countAdminPapers, filters, pageSize)
  const [drawer, setDrawer] = useState(null)
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [pending, setPending] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const activeFilters = Object.values(filters).filter(Boolean).length
  const closeDrawer = useCallback(() => setDrawer(null), [])
  const { reload } = list

  const refresh = (message) => { setDrawer(null); reload(); onChanged(); if (message) notify('success', message) }
  const openEditor = async (row) => {
    setPending(row.id)
    try { setDrawer({ paper: await getAdminPaper(row.id) }) } catch { notify('error', 'This paper could not be opened. It may have been deleted.') } finally { setPending('') }
  }
  const viewPdf = async (row) => {
    const tab = window.open('about:blank', '_blank')
    try {
      tab.location.href = row.access === 'free' && row.freeDownloadUrl ? row.freeDownloadUrl : await getFreePdfUrl((await getAdminPaper(row.id)).filePath)
    } catch {
      tab?.close()
      notify('error', 'The PDF could not be opened.')
    }
  }
  const remove = async () => {
    setDeleting(true)
    try {
      const paper = await getAdminPaper(confirm.id).catch(() => null)
      await removePaper(confirm.id)
      if (paper?.filePath) await removePdf(paper.filePath).catch(() => {})
      setConfirm(null)
      refresh(`"${confirm.title}" was deleted.`)
    } catch {
      notify('error', 'The past paper could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  return <section className="adm-panel">
    <header className="adm-panel-head">
      <div><h2>Past papers</h2><p>Upload, organise and control access to exam resources.</p></div>
      <button type="button" className="adm-button adm-button-primary" onClick={() => setDrawer({ paper: null })}><Plus size={17} /> Upload paper</button>
    </header>

    <div className="adm-toolbar">
      <span className="adm-toolbar-label"><SlidersHorizontal size={15} /> Filter</span>
      {filterOptions.map(([name, placeholder, options]) => <select key={name} aria-label={placeholder} className={filters[name] ? 'active' : ''} value={filters[name]} onChange={(event) => setFilters((current) => ({ ...current, [name]: event.target.value }))}>
        <option value="">{placeholder}</option>
        {options.map((option) => { const [value, label] = Array.isArray(option) ? option : [option, option]; return <option key={value} value={value}>{label}</option> })}
      </select>)}
      {activeFilters > 0 && <button type="button" className="adm-clear" onClick={() => setFilters(noFilters)}><X size={14} /> Clear {activeFilters > 1 ? `${activeFilters} filters` : 'filter'}</button>}
    </div>

    {list.error ? <EmptyState icon={FileText} title="Past papers could not be loaded" message="Check your internet connection and try again." action={<button type="button" className="adm-button adm-button-ghost" onClick={reload}>Try again</button>} />
      : list.loading && !list.items.length ? <SkeletonRows count={Math.min(pageSize, 8)} />
      : !list.items.length ? <EmptyState icon={FileText} title={activeFilters ? 'No papers match these filters' : 'No past papers yet'} message={activeFilters ? 'Try removing a filter to see more papers.' : 'Upload your first PDF to make it available to students.'} action={activeFilters ? <button type="button" className="adm-button adm-button-ghost" onClick={() => setFilters(noFilters)}>Clear filters</button> : <button type="button" className="adm-button adm-button-primary" onClick={() => setDrawer({ paper: null })}><Plus size={17} /> Upload paper</button>} />
      : <div className={`adm-list${list.loading ? ' is-loading' : ''}`}>
        <div className="adm-list-head adm-paper-grid" aria-hidden="true"><span>Paper</span><span>Exam</span><span>Access</span><span /></div>
        {list.items.map((paper) => <article className="adm-row adm-paper-grid" key={paper.id}>
          <div className="adm-row-main">
            <span className="adm-file-icon"><FileText size={18} /></span>
            <div><strong title={paper.title}>{paper.title}</strong><small>{paper.pathway} · {paper.subjectName}{paper.subjectCode ? ` ${paper.subjectCode}` : ''}</small></div>
          </div>
          <span className="adm-row-meta">{describe(paper)}</span>
          <div className="adm-badges">
            <span className={`adm-badge adm-badge-${paper.access}`}>{paper.access === 'free' ? 'Free' : 'Premium'}</span>
            {paper.published === false && <span className="adm-badge adm-badge-hidden">Hidden</span>}
          </div>
          <div className="adm-row-actions">
            <button type="button" className="adm-icon-button" onClick={() => viewPdf(paper)} aria-label={`View ${paper.title}`} title="View PDF"><Eye size={16} /></button>
            <button type="button" className="adm-icon-button" onClick={() => openEditor(paper)} disabled={pending === paper.id} aria-label={`Edit ${paper.title}`} title="Edit">{pending === paper.id ? <Loader2 size={16} className="adm-spin" /> : <Pencil size={16} />}</button>
            <button type="button" className="adm-icon-button adm-icon-danger" onClick={() => setConfirm(paper)} aria-label={`Delete ${paper.title}`} title="Delete"><Trash2 size={16} /></button>
          </div>
        </article>)}
      </div>}

    {!list.error && <Pagination list={list} noun="papers" onPageSize={setPageSize} />}

    <Drawer open={Boolean(drawer)} title={drawer?.paper ? 'Edit past paper' : 'Upload past paper'} subtitle={drawer?.paper?.title || 'Add a PDF and choose who can access it.'} locked={drawerBusy} onClose={closeDrawer}>
      {drawer && <PastPaperForm key={drawer.paper?.id || 'new'} user={user} editing={drawer.paper} onSaved={refresh} onCancel={closeDrawer} onBusyChange={setDrawerBusy} />}
    </Drawer>
    <ConfirmDialog open={Boolean(confirm)} title="Delete this past paper?" message={confirm ? `"${confirm.title}" and its PDF will be permanently removed from the website.` : ''} busy={deleting} onConfirm={remove} onCancel={() => setConfirm(null)} />
  </section>
}
