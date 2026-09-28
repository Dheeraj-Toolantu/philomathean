import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpenCheck, ExternalLink, Eye, FileCheck2, FileText, Lock, Search, X } from 'lucide-react'
import { filterPapers, groupPapers, PATHWAYS, SESSION_LABELS, SESSION_ORDER } from './paperInfo'
import { usePublishedPapers } from './usePublishedPapers'
import { SiteFooter, SiteHeader } from './SiteChrome'

const readParams = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    pathway: PATHWAYS.find((item) => item.id === params.get('subject'))?.id || 'IGCSE',
    subject: params.get('s') || '',
    year: params.get('year') || '',
    session: params.get('session') || '',
    kind: params.get('type') || '',
    query: params.get('q') || '',
  }
}
const writeParams = (state) => {
  const params = new URLSearchParams()
  params.set('subject', state.pathway)
  if (state.subject) params.set('s', state.subject)
  if (state.year) params.set('year', state.year)
  if (state.session) params.set('session', state.session)
  if (state.kind) params.set('type', state.kind)
  if (state.query) params.set('q', state.query)
  window.history.replaceState(null, '', `/past-papers?${params}`)
}
const kindLabel = { 'question-paper': 'Question paper', 'mark-scheme': 'Mark scheme' }
const pdfUrl = (paper) => paper.freeDownloadUrl || ''

function Chip({ active, onClick, children, count }) {
  return <button type="button" className={active ? 'lib-chip active' : 'lib-chip'} aria-pressed={active} onClick={onClick}>{children}{count != null && <span>{count}</span>}</button>
}

function PaperCard({ paper, markScheme, onOpen }) {
  const free = paper.access === 'free' && pdfUrl(paper)
  return <article className={`lib-card lib-card-${paper.kind}`}>
    <div className="lib-card-top">
      <span className={`lib-kind lib-kind-${paper.kind}`}>{paper.kind === 'mark-scheme' ? <FileCheck2 size={13} /> : <FileText size={13} />} {kindLabel[paper.kind]}</span>
      <span className={free ? 'lib-access lib-free' : 'lib-access lib-premium'}>{free ? 'Free' : <><Lock size={11} /> Premium</>}</span>
    </div>
    <h3>{paper.name}</h3>
    <p>{[paper.code, paper.subjectLabel].filter(Boolean).join(' · ')}</p>
    {markScheme && <button type="button" className="lib-ms-link" onClick={() => onOpen(markScheme)}><FileCheck2 size={14} /> Mark scheme available</button>}
    <div className="lib-card-actions">
      {free ? <>
        <button type="button" className="lib-btn lib-btn-primary" onClick={() => onOpen(paper)}><Eye size={15} /> Preview</button>
        <a className="lib-btn" href={pdfUrl(paper)} target="_blank" rel="noreferrer" aria-label={`Open ${paper.name} PDF in a new tab`}><ExternalLink size={15} /> Open PDF</a>
      </> : <button type="button" className="lib-btn lib-btn-lock" onClick={() => onOpen(paper)}><Lock size={15} /> Unlock paper</button>}
    </div>
  </article>
}

function PaperModal({ paper, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  const free = paper.access === 'free' && pdfUrl(paper)
  const when = paper.paperType === 'topic-wise' ? `Topic · ${paper.topic}` : `${SESSION_LABELS[paper.session] || paper.session} ${paper.year}`
  return <div className="lib-modal-backdrop" role="presentation" onClick={onClose}>
    <section className={free ? 'lib-modal' : 'lib-modal lib-modal-small'} role="dialog" aria-modal="true" aria-labelledby="lib-modal-title" onClick={(event) => event.stopPropagation()}>
      <header className="lib-modal-head">
        <div><span className={`lib-kind lib-kind-${paper.kind}`}>{kindLabel[paper.kind]}</span><h2 id="lib-modal-title">{paper.name}</h2><p>{[paper.code, paper.subjectLabel, when].filter(Boolean).join(' · ')}</p></div>
        <button type="button" className="lib-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </header>
      {free ? <>
        <div className="lib-pdf"><iframe title={`${paper.name} preview`} src={pdfUrl(paper)} loading="lazy" /></div>
        <div className="lib-pdf-mobile"><span className="lib-empty-icon"><FileText size={28} /></span><p>Phones open PDFs in their own viewer. Tap <b>Open PDF</b> to read the paper, then save or share it from there.</p></div>
        <div className="lib-modal-foot"><button type="button" className="lib-btn" onClick={onClose}>Close</button><a className="lib-btn lib-btn-primary" href={pdfUrl(paper)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open PDF</a></div>
      </> : <div className="lib-locked">
        <span className="lib-locked-icon"><Lock size={26} /></span>
        <h3>This is a premium paper</h3>
        <p>Premium papers come with our guided practice programme. Our team will share access and a study plan for your exam.</p>
        <a className="orange-button" href="/#contact" onClick={onClose}>Request access <ArrowRight size={16} /></a>
      </div>}
    </section>
  </div>
}

export default function PastPapersLibrary() {
  const { loading, papers } = usePublishedPapers()
  const [filters, setFilters] = useState(readParams)
  const [openPaper, setOpenPaper] = useState(null)
  const update = (changes) => setFilters((current) => { const next = { ...current, ...changes }; writeParams(next); return next })
  const { pathway } = filters

  const pathwayPapers = useMemo(() => papers.filter((paper) => paper.pathway === pathway), [papers, pathway])
  const subjects = useMemo(() => [...new Map(pathwayPapers.map((paper) => [paper.subjectKey, { key: paper.subjectKey, label: paper.subjectLabel, code: paper.subjectCode }])).values()], [pathwayPapers])
  const subject = subjects.some((item) => item.key === filters.subject) ? filters.subject : subjects.length === 1 ? subjects[0].key : ''
  const subjectPapers = useMemo(() => filterPapers(pathwayPapers, { subject }), [pathwayPapers, subject])
  const years = useMemo(() => [...new Set(subjectPapers.map((paper) => paper.year).filter(Boolean))].sort((first, second) => second - first), [subjectPapers])
  const sessions = SESSION_ORDER.filter((session) => subjectPapers.some((paper) => paper.session === session))
  const visible = useMemo(() => filterPapers(subjectPapers, { year: filters.year, session: filters.session, kind: filters.kind, query: filters.query }), [subjectPapers, filters.year, filters.session, filters.kind, filters.query])
  const groups = useMemo(() => groupPapers(visible), [visible])
  const markSchemes = useMemo(() => new Map(subjectPapers.filter((paper) => paper.kind === 'mark-scheme').map((paper) => [`${paper.year}|${paper.session}|${paper.code}`, paper])), [subjectPapers])
  const counts = useMemo(() => Object.fromEntries(PATHWAYS.map((item) => [item.id, papers.filter((paper) => paper.pathway === item.id).length])), [papers])
  const activeFilters = [filters.year, filters.session, filters.kind, filters.query].filter(Boolean).length
  const clearFilters = () => update({ year: '', session: '', kind: '', query: '' })
  const pathwayInfo = PATHWAYS.find((item) => item.id === pathway)
  const freeCount = subjectPapers.filter((paper) => paper.access === 'free').length

  return <main className="lib-page">
    <SiteHeader active="premium" />
    <section className="lib-hero">
      <nav className="lib-crumbs" aria-label="Breadcrumb"><a href="/premium-sources">Past papers</a><span aria-hidden="true">/</span><span aria-current="page">{pathwayInfo.title}</span></nav>
      <h1>{pathwayInfo.title} <span>past papers</span></h1>
      <p>{loading ? 'Loading the library…' : pathwayPapers.length ? `${pathwayPapers.length} papers${years.length ? ` from ${years.at(-1)} to ${years[0]}` : ''}${freeCount ? `, ${freeCount === subjectPapers.length ? 'all' : freeCount} free to preview and download` : ''}.` : pathwayInfo.description}</p>
      <div className="lib-pathways" role="tablist" aria-label="Exam pathway">
        {PATHWAYS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === pathway} className={item.id === pathway ? 'active' : ''} onClick={() => update({ pathway: item.id, subject: '', year: '', session: '', kind: '', query: '' })}>{item.title}<span>{loading ? '…' : counts[item.id] || 'Soon'}</span></button>)}
      </div>
    </section>

    <section className="lib-body">
      {loading ? <div className="lib-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="lib-card lib-skeleton" key={index} />)}</div>
        : !pathwayPapers.length ? <div className="lib-empty">
          <span className="lib-empty-icon"><BookOpenCheck size={30} /></span>
          <h2>{pathwayInfo.title} papers are on their way</h2>
          <p>We're adding {pathwayInfo.title} resources to the library. In the meantime, our teachers can share practice material for your exam.</p>
          <div className="lib-empty-actions"><a className="orange-button" href="/#contact">Ask our team <ArrowRight size={16} /></a>{pathway !== 'IGCSE' && <button type="button" className="outline-button" onClick={() => update({ pathway: 'IGCSE', subject: '' })}>Browse IGCSE papers</button>}</div>
        </div>
        : <>
          <div className="lib-toolbar">
            <label className="lib-search"><Search size={18} aria-hidden="true" /><input type="search" value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Search by paper code or year, e.g. 0607/21 or 2017" aria-label="Search papers" />{filters.query && <button type="button" onClick={() => update({ query: '' })} aria-label="Clear search"><X size={16} /></button>}</label>
            {subjects.length > 1 && <div className="lib-filter-row"><span className="lib-filter-label">Subject</span><div className="lib-chips"><Chip active={!subject} onClick={() => update({ subject: '' })}>All subjects</Chip>{subjects.map((item) => <Chip key={item.key} active={subject === item.key} onClick={() => update({ subject: item.key })}>{item.label}{item.code ? ` ${item.code}` : ''}</Chip>)}</div></div>}
            {years.length > 0 && <div className="lib-filter-row"><span className="lib-filter-label">Year</span><div className="lib-chips lib-chips-scroll"><Chip active={!filters.year} onClick={() => update({ year: '' })}>All years</Chip>{years.map((year) => <Chip key={year} active={String(filters.year) === String(year)} onClick={() => update({ year: String(year) })}>{year}</Chip>)}</div></div>}
            <div className="lib-filter-split">
              {sessions.length > 1 && <div className="lib-filter-row"><span className="lib-filter-label">Session</span><div className="lib-chips"><Chip active={!filters.session} onClick={() => update({ session: '' })}>All</Chip>{sessions.map((session) => <Chip key={session} active={filters.session === session} onClick={() => update({ session })}>{SESSION_LABELS[session]}</Chip>)}</div></div>}
              <div className="lib-filter-row"><span className="lib-filter-label">Type</span><div className="lib-chips"><Chip active={!filters.kind} onClick={() => update({ kind: '' })}>All</Chip><Chip active={filters.kind === 'question-paper'} onClick={() => update({ kind: 'question-paper' })}>Question papers</Chip><Chip active={filters.kind === 'mark-scheme'} onClick={() => update({ kind: 'mark-scheme' })}>Mark schemes</Chip></div></div>
            </div>
          </div>

          <div className="lib-summary" aria-live="polite"><span><b>{visible.length}</b> {visible.length === 1 ? 'paper' : 'papers'}{activeFilters ? ' match your filters' : ''}</span>{activeFilters > 0 && <button type="button" onClick={clearFilters}><X size={14} /> Clear filters</button>}</div>

          {groups.length ? groups.map((group) => <section className="lib-group" key={group.key} aria-labelledby={`g-${group.key}`}>
            <h2 id={`g-${group.key}`}>{group.title}<span>{group.papers.length}</span></h2>
            <div className="lib-grid">{group.papers.map((paper) => <PaperCard key={paper.id} paper={paper} onOpen={setOpenPaper} markScheme={paper.kind === 'question-paper' ? markSchemes.get(`${paper.year}|${paper.session}|${paper.code}`) : undefined} />)}</div>
          </section>) : <div className="lib-empty lib-empty-small"><h2>No papers match</h2><p>Try a different year or session, or clear your search.</p><button type="button" className="outline-button" onClick={clearFilters}>Clear filters</button></div>}
        </>}
    </section>

    <section className="lib-help"><div><h2>Not sure which papers to practise?</h2><p>Our teachers can build a revision plan around your exam date and target grade.</p></div><a className="orange-button" href="/#contact">Talk to a teacher <ArrowRight size={16} /></a></section>
    <SiteFooter />
    {openPaper && <PaperModal paper={openPaper} onClose={() => setOpenPaper(null)} />}
  </main>
}
