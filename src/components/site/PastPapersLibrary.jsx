import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ArrowRight, BookOpenCheck, CheckCircle2, ChevronDown, ExternalLink, FileCheck2, FileText, Lock, Search, X } from 'lucide-react'
import { filterPapers, groupPapers, pairPapers, PATHWAYS, SESSION_LABELS, SESSION_ORDER } from './paperInfo'
import { usePublishedPapers } from './usePublishedPapers'
import { SiteFooter, SiteHeader } from './SiteChrome'

const GROUPS_PER_PAGE = 6

const readParams = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    pathway: PATHWAYS.find((item) => item.id === params.get('subject'))?.id || 'IGCSE',
    subject: params.get('s') || '',
    year: params.get('year') || '',
    session: params.get('session') || '',
    access: params.get('access') === 'free' ? 'free' : '',
    query: params.get('q') || '',
  }
}
const writeParams = (state) => {
  const params = new URLSearchParams()
  params.set('subject', state.pathway)
  if (state.subject) params.set('s', state.subject)
  if (state.year) params.set('year', state.year)
  if (state.session) params.set('session', state.session)
  if (state.access) params.set('access', state.access)
  if (state.query) params.set('q', state.query)
  window.history.replaceState(null, '', `/past-papers?${params}`)
}

const pdfUrl = (paper) => (paper?.access === 'free' && paper.freeDownloadUrl) || ''
const isFree = (paper) => Boolean(pdfUrl(paper))
// Phones and tablets can't show a PDF inside a page, so they get Google's PDF viewer; desktops use the browser's own.
const embedUrl = (url, touch) => touch ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url.split('#')[0])}` : url
const sessionText = (paper) => paper.paperType === 'topic-wise' ? `Topic: ${paper.topic}` : [SESSION_LABELS[paper.session] || paper.session, paper.year].filter(Boolean).join(' ')

const touchQuery = '(max-width: 760px), (pointer: coarse)'
const subscribeTouch = (onChange) => { const media = window.matchMedia(touchQuery); media.addEventListener('change', onChange); return () => media.removeEventListener('change', onChange) }
const useTouchDevice = () => useSyncExternalStore(subscribeTouch, () => window.matchMedia(touchQuery).matches, () => false)

function Chip({ active, onClick, children }) {
  return <button type="button" className={active ? 'lib-chip active' : 'lib-chip'} aria-pressed={active} onClick={onClick}>{children}</button>
}

function DocButton({ paper, label, icon, onOpen, emptyText }) {
  if (!paper) return <span className="lib-doc lib-doc-missing">{icon}<span><b>{label}</b><small>{emptyText}</small></span></span>
  const free = isFree(paper)
  return <button type="button" className={`lib-doc ${free ? 'lib-doc-free' : 'lib-doc-locked'} lib-doc-${paper.kind}`} onClick={() => onOpen(paper)} aria-label={`${free ? 'View' : 'Unlock'} ${label.toLowerCase()}: ${paper.title}`}>
    {free ? icon : <Lock size={18} />}
    <span><b>{label}</b><small>{free ? 'Tap to view' : 'Premium'}</small></span>
  </button>
}

function PaperCard({ set, onOpen }) {
  const free = set.papers.some(isFree)
  return <article className="lib-card">
    <div className="lib-card-head">
      <div>
        <h3>{set.name}</h3>
        <p>{[set.subjectLabel, set.code].filter(Boolean).join(' · ')}</p>
      </div>
      <span className={free ? 'lib-badge lib-badge-free' : 'lib-badge lib-badge-premium'}>{free ? 'Free' : <><Lock size={11} /> Premium</>}</span>
    </div>
    <div className="lib-card-docs">
      <DocButton paper={set.questionPaper} label="Question paper" icon={<FileText size={18} />} emptyText="Not added yet" onOpen={(paper) => onOpen(set, paper)} />
      <DocButton paper={set.markScheme} label="Mark scheme" icon={<FileCheck2 size={18} />} emptyText="Not added yet" onOpen={(paper) => onOpen(set, paper)} />
    </div>
  </article>
}

function PaperViewer({ set, initial, onClose }) {
  const [paper, setPaper] = useState(initial)
  const [loaded, setLoaded] = useState('')
  const touch = useTouchDevice()
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  const url = pdfUrl(paper)
  const src = url ? embedUrl(url, touch) : ''
  const tabs = [['Question paper', set.questionPaper, <FileText size={16} key="qp" />], ['Mark scheme', set.markScheme, <FileCheck2 size={16} key="ms" />]].filter(([, item]) => item)

  return <div className="lib-modal-backdrop" role="presentation" onClick={onClose}>
    <section className={url ? 'lib-modal' : 'lib-modal lib-modal-small'} role="dialog" aria-modal="true" aria-labelledby="lib-modal-title" onClick={(event) => event.stopPropagation()}>
      <header className="lib-modal-head">
        <div className="lib-modal-title">
          <p>{[set.subjectLabel, set.code, sessionText(set)].filter(Boolean).join(' · ')}</p>
          <h2 id="lib-modal-title">{set.name}</h2>
        </div>
        <button type="button" className="lib-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </header>
      {tabs.length > 1 && <div className="lib-modal-tabs" role="tablist" aria-label="Document">
        {tabs.map(([label, item, icon]) => <button key={label} type="button" role="tab" aria-selected={item === paper} className={item === paper ? 'active' : ''} onClick={() => setPaper(item)}>{isFree(item) ? icon : <Lock size={15} />} {label}</button>)}
      </div>}
      {url ? <>
        <div className="lib-pdf">
          {loaded !== src && <div className="lib-pdf-loading" aria-hidden="true"><span className="lib-spinner" />Opening the paper…</div>}
          <iframe key={src} title={`${paper.title} (PDF)`} src={src} onLoad={() => setLoaded(src)} />
        </div>
        <footer className="lib-modal-foot">
          <p className="lib-modal-hint">{touch ? 'Pinch to zoom. Paper not showing? Open it in a new tab.' : 'Tip: finish the paper first, then check your answers in the mark scheme.'}</p>
          <a className="lib-btn lib-btn-primary" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open full PDF</a>
        </footer>
      </> : <div className="lib-locked">
        <span className="lib-locked-icon"><Lock size={26} /></span>
        <h3>This is a premium {paper.kind === 'mark-scheme' ? 'mark scheme' : 'paper'}</h3>
        <p>Premium papers come with our guided practice programme. Ask our team and we'll share access along with a study plan for your exam.</p>
        <a className="lib-btn lib-btn-primary lib-btn-wide" href="/#contact" onClick={onClose}>Request access <ArrowRight size={16} /></a>
      </div>}
    </section>
  </div>
}

export default function PastPapersLibrary() {
  const { loading, complete, papers } = usePublishedPapers()
  const [filters, setFilters] = useState(readParams)
  const [viewing, setViewing] = useState(null)
  const closeViewer = useCallback(() => setViewing(null), [])
  const [shown, setShown] = useState({ key: '', count: GROUPS_PER_PAGE })
  const update = (changes) => setFilters((current) => { const next = { ...current, ...changes }; writeParams(next); return next })
  const { pathway } = filters

  const pathwayPapers = useMemo(() => papers.filter((paper) => paper.pathway === pathway), [papers, pathway])
  const subjects = useMemo(() => [...new Map(pathwayPapers.map((paper) => [paper.subjectKey, { key: paper.subjectKey, label: paper.subjectLabel, code: paper.subjectCode }])).values()]
    .sort((first, second) => first.label.localeCompare(second.label) || first.code.localeCompare(second.code)), [pathwayPapers])
  const subject = subjects.some((item) => item.key === filters.subject) ? filters.subject : subjects.length === 1 ? subjects[0].key : ''
  const subjectPapers = useMemo(() => filterPapers(pathwayPapers, { subject }), [pathwayPapers, subject])
  const sets = useMemo(() => pairPapers(subjectPapers), [subjectPapers])
  const years = useMemo(() => [...new Set(subjectPapers.map((paper) => paper.year).filter(Boolean))].sort((first, second) => second - first), [subjectPapers])
  const sessions = SESSION_ORDER.filter((session) => subjectPapers.some((paper) => paper.session === session))
  const visible = useMemo(() => sets.filter((set) => filterPapers(set.papers, { year: filters.year, session: filters.session, query: filters.query }).length
    && (!filters.access || set.papers.some(isFree))), [sets, filters.year, filters.session, filters.query, filters.access])
  const groups = useMemo(() => groupPapers(visible), [visible])
  const counts = useMemo(() => Object.fromEntries(PATHWAYS.map((item) => [item.id, papers.filter((paper) => paper.pathway === item.id).length])), [papers])
  const activeFilters = [filters.year, filters.session, filters.access, filters.query].filter(Boolean).length
  const clearFilters = () => update({ year: '', session: '', access: '', query: '' })
  const pathwayInfo = PATHWAYS.find((item) => item.id === pathway)
  const freeCount = subjectPapers.filter(isFree).length
  const markSchemeCount = visible.filter((set) => set.markScheme).length
  const filterKey = `${pathway}|${subject}|${filters.year}|${filters.session}|${filters.access}|${filters.query}`
  const groupLimit = shown.key === filterKey ? shown.count : GROUPS_PER_PAGE
  const remainingGroups = groups.length - groupLimit

  return <main className="lib-page">
    <SiteHeader active="premium" />
    <section className="lib-hero">
      <nav className="lib-crumbs" aria-label="Breadcrumb"><a href="/premium-sources">Past papers</a><span aria-hidden="true">/</span><span aria-current="page">{pathwayInfo.title}</span></nav>
      <h1>{pathwayInfo.title} <span>past papers</span></h1>
      <p className="lib-hero-sub">{loading ? 'Loading the library…' : pathwayPapers.length ? `${pathwayPapers.length.toLocaleString('en-IN')} question papers and mark schemes${years.length ? ` from ${years.at(-1)} to ${years[0]}` : ''}${freeCount ? ` · ${freeCount === subjectPapers.length ? 'all' : freeCount} free to view` : ''}.` : pathwayInfo.description}</p>
      <ol className="lib-steps" aria-label="How to use the library">
        <li><b>1</b><span><strong>Choose your subject</strong><small>and your exam year</small></span></li>
        <li><b>2</b><span><strong>Attempt the question paper</strong><small>with a timer, like the real exam</small></span></li>
        <li><b>3</b><span><strong>Check the mark scheme</strong><small>to see how marks are given</small></span></li>
      </ol>
      <div className="lib-pathways" role="tablist" aria-label="Exam pathway">
        {PATHWAYS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === pathway} className={item.id === pathway ? 'active' : ''} onClick={() => update({ pathway: item.id, subject: '', year: '', session: '', access: '', query: '' })}>{item.title}<span>{loading ? '…' : counts[item.id] ? counts[item.id].toLocaleString('en-IN') : 'Soon'}</span></button>)}
      </div>
    </section>

    <section className="lib-body">
      {loading ? <div className="lib-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="lib-card lib-skeleton" key={index} />)}</div>
        : !pathwayPapers.length ? <div className="lib-empty">
          <span className="lib-empty-icon"><BookOpenCheck size={30} /></span>
          <h2>{pathwayInfo.title} papers are on their way</h2>
          <p>We're adding {pathwayInfo.title} resources to the library. In the meantime, our teachers can share practice material for your exam.</p>
          <div className="lib-empty-actions"><a className="lib-btn lib-btn-primary" href="/#contact">Ask our team <ArrowRight size={16} /></a>{pathway !== 'IGCSE' && <button type="button" className="lib-btn" onClick={() => update({ pathway: 'IGCSE', subject: '' })}>Browse IGCSE papers</button>}</div>
        </div>
        : <>
          <div className="lib-toolbar">
            {subjects.length > 1 && <div className="lib-filter-row lib-filter-subject"><span className="lib-filter-label" id="lib-subject-label">Subject</span><div className="lib-chips" role="group" aria-labelledby="lib-subject-label"><Chip active={!subject} onClick={() => update({ subject: '' })}>All subjects</Chip>{subjects.map((item) => <Chip key={item.key} active={subject === item.key} onClick={() => update({ subject: item.key })}>{item.label}{item.code && <small>{item.code}</small>}</Chip>)}</div></div>}
            <div className="lib-filter-grid">
              <label className="lib-search"><Search size={18} aria-hidden="true" /><input type="search" value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Search e.g. 0625/13 or 2019" aria-label="Search papers by code or year" />{filters.query && <button type="button" onClick={() => update({ query: '' })} aria-label="Clear search"><X size={16} /></button>}</label>
              <label className="lib-select"><span className="sr-only">Year</span><select value={filters.year} onChange={(event) => update({ year: event.target.value })}><option value="">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
              <label className="lib-select"><span className="sr-only">Exam session</span><select value={filters.session} onChange={(event) => update({ session: event.target.value })}><option value="">All sessions</option>{sessions.map((session) => <option key={session} value={session}>{SESSION_LABELS[session]}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
              <button type="button" className={filters.access ? 'lib-toggle active' : 'lib-toggle'} aria-pressed={Boolean(filters.access)} onClick={() => update({ access: filters.access ? '' : 'free' })}><CheckCircle2 size={16} /> Free only</button>
            </div>
          </div>

          <div className="lib-summary" aria-live="polite">
            <span><b>{visible.length.toLocaleString('en-IN')}</b> {visible.length === 1 ? 'paper' : 'papers'}{markSchemeCount ? `, ${markSchemeCount.toLocaleString('en-IN')} with mark schemes` : ''}{!complete && ' · loading more…'}</span>
            {activeFilters > 0 && <button type="button" onClick={clearFilters}><X size={14} /> Clear filters</button>}
          </div>

          {groups.length ? groups.slice(0, groupLimit).map((group) => <section className="lib-group" key={group.key} aria-labelledby={`g-${group.key}`}>
            <h2 id={`g-${group.key}`}>{group.title}<span>{group.papers.length} {group.papers.length === 1 ? 'paper' : 'papers'}</span></h2>
            <div className="lib-grid">{group.papers.map((set) => <PaperCard key={set.id} set={set} onOpen={(item, paper) => setViewing({ set: item, paper })} />)}</div>
          </section>) : <div className="lib-empty lib-empty-small"><h2>No papers match</h2><p>Try a different year or session, or clear your search.</p><button type="button" className="lib-btn" onClick={clearFilters}>Clear filters</button></div>}

          {remainingGroups > 0 && <div className="lib-more"><button type="button" className="lib-btn" onClick={() => setShown({ key: filterKey, count: groupLimit + GROUPS_PER_PAGE })}>Show older papers <span>{remainingGroups} more {remainingGroups === 1 ? 'session' : 'sessions'}</span></button></div>}
        </>}
    </section>

    <section className="lib-help"><div><h2>Not sure which papers to practise?</h2><p>Our teachers can build a revision plan around your exam date and target grade.</p></div><a className="lib-btn lib-btn-primary" href="/#contact">Talk to a teacher <ArrowRight size={16} /></a></section>
    <SiteFooter />
    {viewing && <PaperViewer key={viewing.paper.id} set={viewing.set} initial={viewing.paper} onClose={closeViewer} />}
  </main>
}
