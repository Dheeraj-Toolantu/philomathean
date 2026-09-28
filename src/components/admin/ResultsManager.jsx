import { useCallback, useState } from 'react'
import { Pencil, Plus, Trash2, Trophy } from 'lucide-react'
import { countAdminResults, getAdminResultsPage, removeResult } from '../../firebase/content'
import { ConfirmDialog, Drawer, EmptyState, Pagination, SkeletonRows } from './AdminUI'
import { usePagedList } from './hooks'
import ResultForm from './ResultForm'

const noFilters = {}
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'

export default function ResultsManager({ user, notify, onChanged }) {
  const [pageSize, setPageSize] = useState(10)
  const list = usePagedList(getAdminResultsPage, countAdminResults, noFilters, pageSize)
  const [drawer, setDrawer] = useState(null)
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const closeDrawer = useCallback(() => setDrawer(null), [])
  const { reload } = list

  const refresh = (message) => { setDrawer(null); reload(); onChanged(); if (message) notify('success', message) }
  const remove = async () => {
    setDeleting(true)
    try { await removeResult(confirm.id); setConfirm(null); refresh(`The result for ${confirm.studentName} was deleted.`) } catch { notify('error', 'The result could not be deleted.') } finally { setDeleting(false) }
  }

  return <section className="adm-panel">
    <header className="adm-panel-head">
      <div><h2>Student results</h2><p>Achievements shown in the Results section of the website, in display order.</p></div>
      <button type="button" className="adm-button adm-button-primary" onClick={() => setDrawer({ result: null })}><Plus size={17} /> Add result</button>
    </header>

    {list.error ? <EmptyState icon={Trophy} title="Results could not be loaded" message="Check your internet connection and try again." action={<button type="button" className="adm-button adm-button-ghost" onClick={reload}>Try again</button>} />
      : list.loading && !list.items.length ? <SkeletonRows count={Math.min(pageSize, 6)} />
      : !list.items.length ? <EmptyState icon={Trophy} title="No results yet" message="Add a student achievement to feature it on the website." action={<button type="button" className="adm-button adm-button-primary" onClick={() => setDrawer({ result: null })}><Plus size={17} /> Add result</button>} />
      : <div className={`adm-list${list.loading ? ' is-loading' : ''}`}>
        <div className="adm-list-head adm-result-grid" aria-hidden="true"><span>Student</span><span>Score</span><span>Status</span><span /></div>
        {list.items.map((result) => <article className="adm-row adm-result-grid" key={result.id}>
          <div className="adm-row-main">
            <span className="adm-avatar">{initials(result.studentName)}</span>
            <div><strong>{result.studentName}</strong><small title={result.subjects}>{result.school}{result.subjects ? ` · ${result.subjects}` : ''}</small></div>
          </div>
          <span className="adm-score">{result.score}</span>
          <div className="adm-badges">
            <span className="adm-badge adm-badge-order">#{Number(result.sortOrder) || 0}</span>
            {result.published === false ? <span className="adm-badge adm-badge-hidden">Hidden</span> : <span className="adm-badge adm-badge-free">Live</span>}
          </div>
          <div className="adm-row-actions">
            <button type="button" className="adm-icon-button" onClick={() => setDrawer({ result })} aria-label={`Edit result for ${result.studentName}`} title="Edit"><Pencil size={16} /></button>
            <button type="button" className="adm-icon-button adm-icon-danger" onClick={() => setConfirm(result)} aria-label={`Delete result for ${result.studentName}`} title="Delete"><Trash2 size={16} /></button>
          </div>
        </article>)}
      </div>}

    {!list.error && <Pagination list={list} noun="results" onPageSize={setPageSize} />}

    <Drawer open={Boolean(drawer)} title={drawer?.result ? 'Edit result' : 'Add student result'} subtitle={drawer?.result?.studentName || 'Celebrate a student achievement on the website.'} locked={drawerBusy} onClose={closeDrawer}>
      {drawer && <ResultForm key={drawer.result?.id || 'new'} user={user} editing={drawer.result} onSaved={refresh} onCancel={closeDrawer} onBusyChange={setDrawerBusy} />}
    </Drawer>
    <ConfirmDialog open={Boolean(confirm)} title="Delete this result?" message={confirm ? `The result for ${confirm.studentName} will be removed from the website.` : ''} busy={deleting} onConfirm={remove} onCancel={() => setConfirm(null)} />
  </section>
}
