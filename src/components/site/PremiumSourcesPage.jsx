import { useState } from 'react'
import { ArrowRight, CalendarRange, CheckCircle2, Clock3, Download, FileCheck2, Filter, Search, Target } from 'lucide-react'
import { usePublishedPapers } from './usePublishedPapers'
import { PATHWAYS } from './paperInfo'
import { SiteFooter, SiteHeader } from './SiteChrome'

const steps = [
  [Filter, 'Pick your exam', 'Choose your pathway and subject: IGCSE, A Level, IB and more.'],
  [CalendarRange, 'Filter by year & session', 'Jump straight to the exact paper, or search by paper code.'],
  [Download, 'Practise and check', 'Preview or open the PDF, then mark your answers with the mark scheme.'],
]
const tips = [
  [Clock3, 'Practise under exam timing', 'Sit each paper in one go with a timer, just like the real exam.'],
  [FileCheck2, 'Mark with the mark scheme', 'Check every answer and note where the marks were won or lost.'],
  [Target, 'Revisit weak topics', 'Turn mistakes into a short revision list before your next paper.'],
]
const libraryUrl = (pathway, query) => `/past-papers?subject=${encodeURIComponent(pathway)}${query ? `&q=${encodeURIComponent(query)}` : ''}`

export default function PremiumSourcesPage() {
  const { loading, papers } = usePublishedPapers()
  const [pathway, setPathway] = useState('IGCSE')
  const [query, setQuery] = useState('')
  const count = (id) => papers.filter((paper) => paper.pathway === id).length
  const years = [...new Set(papers.map((paper) => paper.year).filter(Boolean))]
  const stats = [
    [loading ? '…' : papers.length, 'Past papers & mark schemes'],
    [loading ? '…' : papers.filter((paper) => paper.access === 'free').length, 'Free to download'],
    [loading ? '…' : years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—', 'Exam years covered'],
  ]
  const search = (event) => { event.preventDefault(); window.location.href = libraryUrl(pathway, query.trim()) }

  return <main className="ps-page">
    <SiteHeader active="premium" />
    <section className="ps-hero">
      <div className="ps-hero-copy">
        <div className="pill blue-pill">Past Papers Library</div>
        <h1>Practise with <span>purpose.</span></h1>
        <p>Real exam papers and mark schemes, organised by year and session so you can find the right paper in seconds.</p>
        <form className="ps-search" onSubmit={search} role="search">
          <label className="sr-only" htmlFor="ps-pathway">Exam</label>
          <select id="ps-pathway" value={pathway} onChange={(event) => setPathway(event.target.value)}>{PATHWAYS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <label className="ps-search-input"><Search size={18} aria-hidden="true" /><span className="sr-only">Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Paper code or year, e.g. 0607/21" /></label>
          <button className="orange-button" type="submit">Find papers <ArrowRight size={16} /></button>
        </form>
        <div className="ps-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div>
      </div>
    </section>

    <section className="ps-section">
      <div className="ps-section-head"><h2>Choose your <span>exam</span></h2><p>Every paper is sorted by subject, year and exam session.</p></div>
      <div className="ps-pathways">{PATHWAYS.map((item) => {
        const total = count(item.id)
        return <a className={total ? 'ps-pathway' : 'ps-pathway ps-pathway-soon'} href={libraryUrl(item.id)} key={item.id}>
          <div className="ps-pathway-top"><span className="ps-board">{item.board}</span><span className={total ? 'ps-count' : 'ps-count ps-count-soon'}>{loading ? '…' : total ? `${total} papers` : 'Coming soon'}</span></div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <span className="ps-pathway-link">{total ? 'Browse papers' : 'See what’s available'} <ArrowRight size={15} /></span>
        </a>
      })}</div>
    </section>

    <section className="ps-section ps-steps-wrap">
      <div className="ps-section-head"><h2>How it <span>works</span></h2></div>
      <ol className="ps-steps">{steps.map(([Icon, title, text], index) => <li key={title}><span className="ps-step-icon"><Icon size={22} /></span><b>Step {index + 1}</b><h3>{title}</h3><p>{text}</p></li>)}</ol>
    </section>

    <section className="ps-section">
      <div className="ps-section-head"><h2>Get more from every <span>paper</span></h2><p>Tips from our teachers on practising past papers well.</p></div>
      <div className="ps-tips">{tips.map(([Icon, title, text]) => <article key={title}><Icon size={22} /><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="ps-cta">
      <div><div className="pill green-pill">Personalised support</div><h2>Need help choosing the right papers?</h2><p>Our academic team can recommend papers and a revision plan for your target exam.</p><ul><li><CheckCircle2 size={16} /> Free demo class</li><li><CheckCircle2 size={16} /> Plan built around your exam date</li></ul></div>
      <a className="orange-button" href="/#contact">Speak with admissions <ArrowRight size={16} /></a>
    </section>
    <SiteFooter />
  </main>
}
