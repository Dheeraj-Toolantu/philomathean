import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Atom, Award, BookOpen, Brain, ChevronDown, ChevronUp, ClipboardCheck, Dna, FlaskConical, GraduationCap, Layers, Lightbulb, LineChart, Phone, Play, Quote, Sigma, Target, Users } from 'lucide-react'
import './App.css'
import './directorVision'
import AdminGuard from './components/admin/AdminGuard'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import { subscribeToPublishedPapers, subscribeToPublishedResults } from './firebase/content'

const programs = [
  [Layers, 'IB MYP', 'International Baccalaureate Middle Years Programme', 'orange'],
  [BookOpen, 'IGCSE', 'International General Certificate of Secondary Education', 'blue'],
  [GraduationCap, 'IBDP', 'International Baccalaureate Diploma Programme', 'purple'],
  [Award, 'A Levels', 'Advanced Level', 'green'],
]
const faculty = [
  ['Satish Vishwakarma', 'Founder & Director', 'Mathematics (IGCSE, IBDP & A Levels)', '/media/faculty-01.jpeg', 'Satish Vishwakarma Sir is the Founder & Director of Philomathean Career Institute Pvt. Ltd. and a highly accomplished Mathematics educator.', '12+'],
  ['Deepak Tripathi', 'IBDP Academic Leader', 'Physics (IGCSE, IBDP & A Levels)', '/media/faculty-02.jpeg', 'Deepak Tripathi Sir is the IBDP Academic Leader with 12+ years of teaching experience.', '12+'],
  ['Ashish Jha', 'A Levels Academic Leader', 'Physics & Chemistry (IGCSE, IBDP & A Levels)', '/media/faculty-03.jpeg', 'Ashish Jha Sir is the Academic Leader of the A Levels Department at Philomathean, with 10+ years of teaching experience.', '10+'],
  ['Akshara Agarwal', 'Educator', "Mathematics & Science (IGCSE)", '/media/faculty-04.jpeg', "Akshara Agarwal Ma'am is an experienced IGCSE Mathematics and Science faculty with 8+ years of teaching experience.", '8+'],
  ['Dipesh Paliwal', 'Educator', 'Mathematics (IGCSE & IBDP)', '/media/faculty-05.jpeg', 'Dipesh Paliwal Sir is a highly experienced Mathematics faculty specialising in IGCSE and IBDP.', '12+'],
  ['Meghna Shah', 'Educator', 'Mathematics & Science (IGCSE)', '/media/faculty-06.jpeg', 'Meghna Shah Ma’am is an experienced IGCSE Mathematics and Science faculty.', '10+'],
  ['Manikant Yadav', 'Educator', 'Physics, Chemistry & Biology (IGCSE)', '/media/faculty-07.jpeg', 'Manikant Yadav Sir is an experienced Science faculty specialising in Physics, Chemistry and Biology.', '10+'],
  ['Tushar Rajgor', 'Educator', 'Mathematics (IGCSE)', '/media/faculty-15.jpeg', 'Tushar Rajgor Sir is an experienced Mathematics faculty specialising in Grades 6 to 10.', '10+'],
]
const allFaculty = [
  ...faculty,
  ['Pallavi Patole', 'Educator', 'Biology (IGCSE, IBDP & A Levels)', '/media/faculty-08.jpeg', 'Pallavi Patole Ma’am is an experienced Biology faculty specialising in IGCSE, IBDP, and A Levels.', '10+'],
  ['Ayushi Nishar', 'Educator', 'Economics & Business Studies (IGCSE & IBDP)', '/media/faculty-09.jpeg', 'Ayushi Nishar Ma’am is an experienced Economics and Business Studies faculty.', '12+'],
  ['Hitesh Dubal', 'Educator', 'Mathematics (IGCSE)', '/media/faculty-10.jpeg', 'Hitesh Dubal Sir is an experienced IGCSE Mathematics faculty specialising in Grades 6 to 10.', '10+'],
  ['Pawan Yadav', 'Educator', 'Mathematics (IGCSE & A Levels)', '/media/faculty-11.jpeg', 'Pawan Yadav Sir is an experienced Mathematics faculty specialising in IGCSE and A Levels.', '10+'],
  ['Anshul Bhide', 'Educator', 'Biology (IGCSE, IBDP & A Levels)', '/media/faculty-12.jpeg', 'Anshul Bhide Sir is an experienced Biology faculty specialising in IGCSE, IBDP, and A Levels.', '10+'],
  ['Siyana Bharucha', 'Educator', 'Psychology (IGCSE & IBDP)', '/media/faculty-13.jpeg', 'Siyana Bharucha Ma’am is a dedicated Psychology faculty specialising in IGCSE and IBDP.', '5+'],
  ['Taragini Menon', 'Educator', 'English (IGCSE & IBDP)', '/media/faculty-14.jpeg', 'Taragini Menon Ma’am is an experienced English faculty specialising in IGCSE and IBDP.', '10+'],
  ['Prasad Bharat Ghadi', 'Educator', 'Chemistry (IGCSE, IBDP & A Levels)', '/media/faculty-16.jpeg', 'Prasad Bharat Ghadi Sir is an experienced Chemistry faculty specialising in IGCSE, IBDP, and A Levels.', '10+'],
  ['Zeel Gandhi', 'Educator', 'Mathematics & Science (IGCSE)', '/media/faculty-17.jpeg', 'Zeel Gandhi Ma’am is an experienced IGCSE Mathematics and Science faculty.', '5+'],
  ['Vijay Yadav', 'Educator', 'Mathematics (IBDP & Cambridge International A Levels)', '/media/vijay-yadav.jpeg', 'With 10+ years of teaching experience, Vijay Yadav is a highly accomplished Mathematics educator specializing in IBDP (AA & AI – HL/SL) and Cambridge International A Levels Mathematics.', '10+'],
  ['Pankaj Yadav', 'Educator', 'Mathematics | Grades 6–8 (IGCSE, IB MYP & Foundation Programme)', '/media/pankaj-yadav.jpeg', 'With 5+ years of teaching experience, Mr. Pankaj Yadav is a dedicated Mathematics educator committed to building a strong conceptual foundation for students in Grades 6–8.', '5+'],
  ["Shreya Ma'am", 'Educator', 'Mathematics, Science, English, EVS, and Social Studies', '/media/shreya.jpeg', "Shreya Ma'am is a dedicated educator with 3–4 years of teaching experience, specializing in Mathematics, Science, English, EVS, and Social Studies for students from Grades 1 to 8.", '3+'],

]
const directorFaculty = [allFaculty[0], ['Rinky Vishwakarma', 'Educator', 'Mathematics (IGCSE)', '/media/faculty-18.jpeg', 'Rinky Vishwakarma Ma’am is an experienced IGCSE Mathematics faculty.', '5+']]
const educatorFaculty = allFaculty.filter((member) => !directorFaculty.includes(member))
const results = [
  ['45/45', 'Aditya Sriram', 'CHEM(7), BIO(7), PSYCH(7)', 'Oberoi International'],
  ['45/45', 'Sanjana Nevatia', 'CHEM HL (7)', 'Cathedral & John Connon School'],
  ['45/45', 'Rhea Shah', 'CHEM(7), BIO(7), PSYCH(7)', 'Hill Spring International'],
  ['44/45', 'Aradhitta Goenka', 'PHY(7), CHEM(7), MATH AAHL(7)', 'Bombay International'],
  ['44/45', 'Raya Isphani', 'ECO HL(7), PHY HL(7), CHEM SL(7)', 'Bombay International'],
  ['44/45', 'Ansh Kapoor', 'CHEM HL(7), PHY HL(7)', 'Bombay International'],
]
const testimonials = [
  ['Review 1', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_1.mp4'],
  ['Review 2', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_2.mp4'],
  ['Review 3', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_3.mp4'],
  ['Review 4', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_4.mp4'],
  ['Review 5', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_5.mp4'],
  ['Review 6', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_6.mp4'],
  ['Review 7', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_7.mp4'],
  ['Review 8', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_8.mp4'],
  ['Review 9', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_9.mp4'],
  ['Review 10', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_10.mp4'],
  ['Review 11', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_11.mp4'],
  ['Review 12', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_12.mp4'],
  ['Review 13', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_13.mp4'],
  ['Review 14', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_14.mp4'],
  ['Review 15', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_15.mp4'],
  ['Review 16', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_16.mp4'],
  ['Review 17', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_17.mp4'],
  ['Review 18', 'Student Story', 'Hear how Philomathean helped this student grow in confidence and achieve their academic goals.', '/media/review_18.mp4']
]

const benefits = [
  [Target, 'Tailored Tutoring', 'One-on-one or small group sessions designed around your child’s unique learning pace and style.'],
  [LineChart, 'Intensive Preparation', 'Results-oriented prep for Olympiads, SAT, ACT, UCAT, and all competitive entrance exams.'],
  [ClipboardCheck, 'Regular Supervision', 'Periodic tests and assessments ensure consistent progress and timely feedback.'],
  [GraduationCap, 'Skill Building', 'Beyond academics - research skills, IA/EE prep, career counselling, and profile building.'],
  [Brain, 'Conceptual Learning', 'Deep understanding over rote memorisation - concepts that last a lifetime.'],
  [BookOpen, 'Comprehensive Learning', '24 subjects under one roof with specialist teachers for every discipline.'],
]

const teacherSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const isLeadershipName = (name) => name === 'Satish Vishwakarma' || name === 'Rinky Vishwakarma'

function BrandLockup() {
  return <a className="logo-lockup" href="/#home" aria-label="Philomathean home"><img src="/media/logo.png" alt="" /><span><strong>PHILOMATHEAN</strong><small>CAREER INSTITUTE PVT. LTD.</small></span></a>
}

const examPrepOptions = [['SAT', 'US college admissions'], ['ACT', 'US college admissions'], ['UCAT', 'Medical school entrance'], ['TOEFL', 'English proficiency'], ['BMAT', 'Biomedical admissions'], ['Olympiads', 'Competitive science & maths']]

function ExamPrepDropdown({ closeMenu }) {
  const [open, setOpen] = useState(false)
  const closeDropdown = () => { setOpen(false); closeMenu() }
  return <div className={open ? 'nav-dropdown-wrap dropdown-open' : 'nav-dropdown-wrap'} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}><button className="nav-dropdown-trigger" type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>Exam Prep {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>{open && <div className="nav-dropdown" role="menu">{examPrepOptions.map(([title, description]) => <a href="#exam-prep" role="menuitem" key={title} onClick={closeDropdown}><strong>{title}</strong><small>{description}</small></a>)}</div>}</div>
}

const premiumSources = [
  ['IGCSE', 'Cambridge International past papers, mark schemes, and revision support for core subjects.', 'IGCSE Past Papers'],
  ['AS & A Level', 'Past papers and exam-focused resources to strengthen preparation across advanced-level subjects.', 'AS & A Level Past Papers'],
  ['SAT / ACT', 'Practice papers and structured preparation resources for international college admissions tests.', 'SAT / ACT Past Papers'],
  ['IBDP', 'Past papers and focused revision resources for the International Baccalaureate Diploma Programme.', 'IBDP Past Papers'],
  ['MYP', 'Subject resources and practice material for the International Baccalaureate Middle Years Programme.', 'MYP Past Papers'],
]

function PremiumSourcesPage() {
  return <main className="premium-page">
    <header className="topbar"><BrandLockup /><nav className="main-nav"><a href="/#programs">Programs <ChevronDown size={13} /></a><a href="/#exam-prep">Exam Prep <ChevronDown size={13} /></a><a className="active-link" href="/premium-sources">Premium Sources</a><a href="/teachers">Our Teachers</a><a href="/#results">Results</a><a href="/#about">About Us</a></nav><div className="header-actions"><a className="phone" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a><a className="outline-button" href="/#contact">Enquire Now</a><a className="orange-button" href="/#contact">Book Free Demo</a></div></header>
    <section className="premium-hero section"><div className="section-intro centered"><div className="pill blue-pill">Premium Sources</div><h1>Practice With <span>Purpose</span></h1><p>Build confidence with carefully selected past papers and exam resources for every important stage of your academic journey.</p></div></section>
    <section className="past-papers section"><div className="section-intro centered"><div className="pill orange-soft">Past Papers</div><h2>Resources That Move You <span>Forward</span></h2><p>Choose your examination pathway and begin preparing with the right material.</p></div><div className="source-grid">{premiumSources.map(([level, description, title]) => <article className="source-card" key={level}><span className="source-number">0{premiumSources.findIndex((source) => source[0] === level) + 1}</span><b>{level}</b><h3>{title}</h3><p>{description}</p><a className="profile-link" href={`/past-papers?subject=${encodeURIComponent(level)}`}>Request resources <ArrowRight size={14} /></a></article>)}</div></section>
    <section className="premium-cta section"><div className="section-intro"><div className="pill green-pill">Personalised Support</div><h2>Need Help Choosing the <span>Right Papers?</span></h2><p>Our academic team can recommend the best papers and preparation plan for your target examination.</p></div><a className="orange-button" href="/#contact">Speak with admissions <ArrowRight size={16} /></a></section>
    <footer><div className="footer-brand"><img src="/media/logo.png" alt="Philomathean" /><p>India's premier tutoring institute for MYP, IBDP,<br /> IGCSE, AS &amp; A-Level, and competitive exams.<br /> Your partner for academic success.</p><p><Phone size={14} /> &nbsp;+91 93241 64073<br />✉ &nbsp; philomathean22@gmail.com<br />⌖ &nbsp; Shop no 35, Aardhya Highpark, Mumbai</p></div><div><h3>Programs</h3><p>IB MYP<br />IGCSE<br />IBDP<br />A Levels<br />All Programs</p></div><div><h3>Exam Prep</h3><p>SAT<br />ACT<br />UCAT<br />TOEFL<br />BMAT<br />Olympiads</p></div><div><h3>Quick Links</h3><p><a href="/#about">Founder</a><br /><a href="/teachers">Our Teachers</a><br /><a href="/premium-sources">Premium Sources</a><br /><a href="/#results">Results</a><br /><a href="/#contact">Contact</a></p></div><small className="copyright">© 2026 Philomathean Career Institute Pvt. Ltd. All rights reserved.</small></footer>
  </main>
}

function PastPapersPage({ subject }) {
  const selectedSubject = premiumSources.find(([level]) => level === subject)?.[0] || 'IGCSE'
  const [search, setSearch] = useState('')
  const [letter, setLetter] = useState('All')
    const [managedPapers, setManagedPapers] = useState([])
  const [downloadUrls, setDownloadUrls] = useState({})
  const [selectedPaper, setSelectedPaper] = useState(null)
  useEffect(() => subscribeToPublishedPapers(setManagedPapers, () => setManagedPapers([])), [])
  const displayedPapers = managedPapers.filter((paper) => paper.pathway === selectedSubject).map((paper) => ({ ...paper, label: `${paper.subject} - ${paper.title}` }))
  const filteredPapers = displayedPapers.filter((paper) => paper.label.toLowerCase().includes(search.toLowerCase()) && (letter === 'All' || paper.label.toUpperCase().startsWith(letter)))
  const letters = ['All', ...'ABCDEFGH IJKLM PRSTUVW'.replaceAll(' ', '').split('')]
  const openPaper = async (paper) => { if (paper.access !== 'free' || !paper.freeDownloadUrl) { setSelectedPaper(paper); return } setDownloadUrls((current) => ({ ...current, [paper.id]: paper.freeDownloadUrl })); setSelectedPaper({ ...paper, previewUrl: paper.freeDownloadUrl }) }
  return <main className="papers-page">
    <header className="topbar"><BrandLockup /><nav className="main-nav"><a href="/#programs">Programs <ChevronDown size={13} /></a><a href="/#exam-prep">Exam Prep <ChevronDown size={13} /></a><a className="active-link" href="/premium-sources">Premium Sources</a><a href="/teachers">Our Teachers</a><a href="/#results">Results</a><a href="/#about">About Us</a></nav><div className="header-actions"><a className="phone" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a><a className="outline-button" href="/#contact">Enquire Now</a><a className="orange-button" href="/#contact">Book Free Demo</a></div></header>
    <section className="papers-content section"><a className="papers-back" href="/premium-sources">← Back to Premium Sources</a><div className="papers-heading"><div className="pill blue-pill">Past Papers Library</div><h1>{selectedSubject} <span>Past Papers</span></h1><p>Search and browse our curated collection of {selectedSubject} practice resources.</p></div><label className="papers-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page" aria-label="Search past papers" /></label><div className="paper-letters" aria-label="Filter papers by first letter">{letters.map((item) => <button className={letter === item ? 'active' : ''} type="button" key={item} onClick={() => setLetter(item)}>{item}</button>)}</div><div className="paper-list">{filteredPapers.length ? filteredPapers.map((paper) => <button className={paper.access === 'premium' ? 'paper-row paper-row-premium' : 'paper-row paper-row-free'} type="button" key={paper.label} onClick={() => openPaper(paper)}><span className="paper-icon">▤</span><span>{paper.label}</span><small>{paper.access === 'premium' ? 'Premium' : 'Free PDF'}</small><ArrowRight size={17} /></button>) : <p className="paper-empty">No papers match your search.</p>}</div></section>{selectedPaper && <div className="paper-modal-backdrop" role="presentation" onClick={() => setSelectedPaper(null)}><section className="paper-modal" role="dialog" aria-modal="true" aria-labelledby="paper-modal-title" onClick={(event) => event.stopPropagation()}><button className="paper-modal-close" type="button" onClick={() => setSelectedPaper(null)} aria-label="Close preview">×</button><span className="pill blue-pill">{selectedPaper.access === 'premium' ? 'Premium Resource' : 'Free PDF'}</span><h2 id="paper-modal-title">{selectedPaper.label}</h2>{selectedPaper.access === 'premium' ? <><div className="premium-preview"><span className="paper-icon">▤</span><strong>Premium preview</strong><p>This paper is available with premium access.</p></div><p className="paper-modal-copy">Unlock this resource to view the complete paper and download the PDF.</p><a className="orange-button" href="/#contact" onClick={() => setSelectedPaper(null)}>Request payment options <ArrowRight size={16} /></a></> : selectedPaper.previewError ? <><div className="premium-preview"><strong>Preview unavailable</strong><p>We could not load this PDF right now.</p></div><a className="outline-button" href="/#contact" onClick={() => setSelectedPaper(null)}>Contact admissions</a></> : <><div className="pdf-preview"><iframe title={`${selectedPaper.label} preview`} src={selectedPaper.previewUrl || downloadUrls[selectedPaper.id] || ''} /></div><button className="orange-button" type="button" onClick={() => window.open(downloadUrls[selectedPaper.id], '_blank', 'noopener,noreferrer')}>Download PDF <ArrowRight size={16} /></button></>}</section></div>}
  </main>
}

function Testimonials({ activeStory, setActiveStory }) {
  const [mountNode, setMountNode] = useState(null)
  const active = testimonials[activeStory]
  const next = testimonials[(activeStory + 1) % testimonials.length]
  useEffect(() => { const cta = document.querySelector('.cta'); if (!cta) return undefined; const node = document.createElement('div'); cta.parentNode.insertBefore(node, cta); const frame = window.requestAnimationFrame(() => setMountNode(node)); return () => { window.cancelAnimationFrame(frame); node.remove() } }, [])
  return mountNode ? createPortal(<section className="testimonials" id="testimonials"><div className="testimonial-intro section-intro centered"><div className="pill testimonial-pill">Testimonials</div><h2><span className="testimonial-word-what">What</span> <span className="testimonial-word-students">Students</span> <span className="testimonial-word-say">Say</span></h2><p>Hear directly from the students and families who have experienced the Philomathean difference.</p></div><div className="story-stage"><div className="story-heading">WATCH THEIR STORIES</div><div className="story-carousel"><button className="story-arrow" type="button" onClick={() => setActiveStory((activeStory - 1 + testimonials.length) % testimonials.length)} aria-label="Previous testimonial">‹</button><article className="story-card active-story"><video src={active[3]} controls muted playsInline preload="metadata" aria-label={`${active[0]} testimonial`} /><div className="story-overlay"><span>Student Story</span><h3>{active[0]}</h3><p>{active[1]}</p><blockquote>“{active[2]}”</blockquote></div></article><article className="story-card next-story"><video src={next[3]} muted playsInline preload="metadata" aria-label={`${next[0]} testimonial`} /><div className="story-overlay"><span>Student Story</span><h3>{next[0]}</h3><p>{next[1]}</p></div></article><button className="story-arrow" type="button" onClick={() => setActiveStory((activeStory + 1) % testimonials.length)} aria-label="Next testimonial">›</button></div><div className="story-dots"><span className="current-dot" />{testimonials.slice(1).map((_, index) => <button type="button" key={index} onClick={() => setActiveStory(index + 1)} aria-label={`Show testimonial ${index + 2}`} />)}</div></div></section>, mountNode) : null
}

function FacultyCard({ member }) {
  const [name, role, subject, image, description, experience] = member
  return <article className="teacher-card"><div className="teacher-image"><img src={image} alt={name} />{isLeadershipName(name) && <span className="leadership"><Award size={12} /> LEADERSHIP</span>}<span className="years"><Award size={12} /> {experience} Years</span><div className="teacher-name"><h3>{name}</h3><p>{role}</p></div></div><div className="teacher-body"><h4><GraduationCap size={18} /> {subject}</h4><p>{description}...</p><a className="profile-link" href={`/teachers/${teacherSlug(name)}`}>View full profile <ArrowRight size={14} /></a></div></article>
}

function FloatingSymbols() {
  useEffect(() => {
    const symbols = document.querySelector('.floating-symbols')
    if (!symbols) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const updateSymbols = () => {
      const targets = [...document.querySelectorAll('.results h2, .journey h2')]
      const focus = targets.reduce((highest, target) => {
        const distance = Math.abs(target.getBoundingClientRect().top - window.innerHeight * 0.55)
        return Math.max(highest, Math.max(0, 1 - distance / (window.innerHeight * 0.7)))
      }, 0)
      symbols.style.setProperty('--focus-opacity', `${focus * 0.16}`)
      symbols.style.setProperty('--scroll-offset', `${Math.sin(window.scrollY * 0.004) * 24}px`)
    }

    updateSymbols()
    if (reducedMotion) return undefined

    let animationFrame
    const updatePosition = () => {
      animationFrame = undefined
      updateSymbols()
    }
    const handleScroll = () => {
      if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(updatePosition)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    updatePosition()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  return <div className="floating-symbols" aria-hidden="true"><span className="floating-symbol chemistry"><FlaskConical /></span><span className="floating-symbol biology"><Dna /></span><span className="floating-symbol mathematics"><Sigma /></span><span className="floating-symbol physics"><Atom /></span></div>
}

function TeacherProfile({ teacher }) {
  const [name, role, subject, image, description, experience] = teacher
  return <main className="profile-page"><header className="topbar"><a className="logo-lockup" href="/#home" aria-label="Philomathean home"><img src="/media/logo.png" alt="Philomathean Career Institute" /></a><nav className="main-nav"><a href="/teachers">Our Teachers</a><a href="/#programs">Programs</a><a href="/#results">Results</a></nav><div className="header-actions"><a className="phone" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a><a className="orange-button" href="/#contact">Book Free Demo</a></div></header><div className="profile-back"><a href="/teachers">← &nbsp; Back to all faculty</a></div><section className="profile-content"><div className="profile-photo"><img src={image} alt={name} /></div><div className="profile-details"><span className="profile-role"><Award size={13} /> {role}</span><h1>{name}</h1><h2><GraduationCap size={18} /> {subject}</h2><div className="profile-tags"><span>{role}</span><span>Grades 4-12</span><span>{experience} Years Experience</span></div><hr /><h3>About {name.split(' ')[0]}</h3><p>{description} This educator is dedicated to building strong conceptual foundations, developing analytical thinking, and helping students approach examinations with confidence, clarity, and a structured learning plan.</p><div className="profile-actions"><a className="orange-button" href="/#contact">Book a Free Demo Class <ArrowRight size={16} /></a><a className="outline-button" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a></div></div></section></main>
}

function TeachersPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  return <main className="teachers-page">
    <header className="topbar"><a className="logo-lockup" href="/#home" aria-label="Philomathean home"><img src="/media/logo.png" alt="Philomathean Career Institute" /></a><button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Menu <span>{menuOpen ? 'x' : '+'}</span></button><nav className={menuOpen ? 'main-nav open' : 'main-nav'}><a href="/#programs" onClick={closeMenu}>Programs <ChevronDown size={13} /></a><ExamPrepDropdown closeMenu={closeMenu} /><a href="/premium-sources" onClick={closeMenu}>Premium Sources</a><a className="active-link" href="/teachers" onClick={closeMenu}>Our Teachers</a><a href="/#results" onClick={closeMenu}>Results</a><a href="/#about" onClick={closeMenu}>About Us</a></nav><div className="header-actions"><a className="phone" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a><a className="outline-button" href="/#contact">Enquire Now</a><a className="orange-button" href="/#contact">Book Free Demo</a></div></header>
    <section className="teachers-hero section"><div className="section-intro centered"><div className="pill green-pill">Our Expert Faculty</div><h1>Learn From the <span>Best</span></h1><p>Every educator at Philomathean is chosen through a rigorous process &mdash; evaluating<br className="desktop" /> academic credentials and the ability to connect with and inspire students.</p><div className="faculty-stats"><b>18+ <small>Expert Educators</small></b><b>10+ <small>Avg. Years Experience</small></b><b>IGCSE · IBDP · A Levels <small>Curriculums Covered</small></b></div></div></section>
    <section className="faculty-directory section"><h2 className="directory-title">Leadership &amp; Directors</h2><div className="faculty-grid director-grid">{directorFaculty.map((member) => <FacultyCard member={member} key={member[0]} />)}</div><h2 className="directory-title">Our Educators</h2><div className="faculty-grid">{educatorFaculty.map((member) => <FacultyCard member={member} key={member[0]} />)}</div></section>
    <section className="directory-cta section"><div className="section-intro centered"><div className="pill orange-soft">Book a Free Demo</div><h2>Start Your <span>Journey Today</span></h2><p>Book a free demo class and experience the Philomathean difference first-hand. No commitment required.</p></div><a className="blue-button" href="/#contact">Book My Free Demo Class &nbsp; <ArrowRight size={16} /></a></section>
    <footer><div className="footer-brand"><img src="/media/logo.png" alt="Philomathean" /><p>India's premier tutoring institute for MYP, IBDP,<br /> IGCSE, AS &amp; A-Level, and competitive exams.<br /> Your partner for academic success.</p><p><Phone size={14} /> &nbsp;+91 93241 64073<br />✉ &nbsp; philomathean22@gmail.com<br />⌖ &nbsp; Shop no 35, Aardhya Highpark, Mumbai</p></div><div><h3>Programs</h3><p>IB MYP<br />IGCSE<br />IBDP<br />A Levels<br />All Programs</p></div><div><h3>Exam Prep</h3><p>SAT<br />ACT<br />UCAT<br />TOEFL<br />BMAT<br />Olympiads</p></div><div><h3>Quick Links</h3><p><a href="/#about">Founder</a><br /><a href="/teachers">Our Teachers</a><br /><a href="/#results">Results</a><br /><a href="/#about">About Us</a><br /><a href="/#contact">Contact</a></p></div><small className="copyright">© 2026 Philomathean Career Institute Pvt. Ltd. All rights reserved.</small></footer>
  </main>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [resultTab, setResultTab] = useState('IBDP Results')
  const [formSent, setFormSent] = useState(false)
  const [formError, setFormError] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [activeStory, setActiveStory] = useState(0)
  const [publicResults, setPublicResults] = useState([])
  useEffect(() => subscribeToPublishedResults(setPublicResults, () => setPublicResults([])), [])
  const submitEnquiry = async (event) => {
    event.preventDefault()
    setFormError(false)
    setFormSubmitting(true)
    const form = event.currentTarget
    try {
      const formData = new FormData(form)
      const enquiry = Object.fromEntries(formData.entries())
      const response = await fetch('https://formsubmit.co/ajax/philomathean22@gmail.com', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...enquiry, _replyto: enquiry.email, _template: 'table' }),
      })
      if (!response.ok) throw new Error('Enquiry submission failed')
      setFormSent(true)
    } catch {
      setFormError(true)
    } finally {
      setFormSubmitting(false)
    }
  }
  if (window.location.pathname === '/admin/login') return <AdminLogin />
  if (window.location.pathname === '/admin') return <AdminGuard onUnauthenticated={() => { window.location.href = '/admin/login' }}>{(user) => <AdminDashboard user={user} />}</AdminGuard>
  const profileSlug = window.location.pathname.match(/^\/teachers\/([^/]+)$/)?.[1]
  if (profileSlug) {
    const teacher = allFaculty.find((member) => teacherSlug(member[0]) === profileSlug)
    if (teacher) return <TeacherProfile teacher={teacher} />
  }
  if (window.location.pathname === '/past-papers') return <PastPapersPage subject={new URLSearchParams(window.location.search).get('subject')} />
  if (window.location.pathname === '/premium-sources') return <PremiumSourcesPage />
  if (window.location.pathname === '/teachers') return <TeachersPage />
  const closeMenu = () => setMenuOpen(false)
  const displayedResults = publicResults.length ? publicResults.map((item) => [item.score, item.studentName, item.subjects, item.school]) : results
  return <main>
    <FloatingSymbols />
    <Testimonials activeStory={activeStory} setActiveStory={setActiveStory} />
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar">
      <BrandLockup />
      <button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>Menu <span>{menuOpen ? 'x' : '+'}</span></button>
      <nav className={menuOpen ? 'main-nav open' : 'main-nav'}><a href="#programs" onClick={closeMenu}>Programs <ChevronDown size={13} /></a><ExamPrepDropdown closeMenu={closeMenu} /><a href="/premium-sources" onClick={closeMenu}>Premium Sources</a><a href="#faculty" onClick={closeMenu}>Our Teachers</a><a href="#results" onClick={closeMenu}>Results</a><a href="#about" onClick={closeMenu}>About Us</a></nav>
      <div className="header-actions"><a className="phone" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a><a className="outline-button" href="#contact">Enquire Now</a><a className="orange-button" href="#contact">Book Free Demo</a></div>
    </header>

    <section className="home-hero" id="home"><div className="hero-copy"><div className="pill orange-pill">Your trusted learning partner</div><h1 id="main-content">Your Partner for<br /><span>Academic Success</span></h1><p>Expert tutoring, personalised coaching, and results-driven preparation for international boards and competitive exams<br className="desktop" /> &mdash; all under one roof.</p><div className="hero-pills"><span>MYP &amp; IBDP</span><span>IGCSE &amp; AS-A Level</span><span>SAT / ACT</span></div><div className="hero-buttons"><a className="orange-button" href="#contact">Book Free Demo <ArrowRight size={16} /></a><a className="outline-button" href="#programs"><Play size={14} fill="currentColor" /> Explore Programs</a></div><div className="hero-stats"><div><Users /><strong>240+</strong><small>Students Mentored</small></div><div><BookOpen /><strong>6+</strong><small>Subjects Covered</small></div><div><GraduationCap /><strong>20+</strong><small>Expert Tutors</small></div><div><Award /><strong>45/45</strong><small>Top IB Score</small></div></div></div><div className="hero-art"><img src="/media/hero-section.jpeg" alt="Philomathean subjects and programs" /><span className="score-badge"><small>Latest Result</small><strong>45 / 45</strong><em>IB Perfect Score</em></span><span className="exam-badge"><small>Exam Prep</small><strong>SAT · ACT</strong><em>UCAT · TOEFL · BMAT</em></span></div></section>

    <section className="founder section" id="about"><div className="section-intro centered"><div className="pill blue-pill"><Award size={14} /> &nbsp; Meet Our Founder</div><h2>Led by <span>Satish Vishwakarma</span></h2><p>Founder &amp; Director of Philomathean Career Institute &mdash; a visionary educator shaping the<br className="desktop" /> next generation of global achievers.</p></div><div className="founder-grid"><div className="founder-photo"><img src="/media/faculty-01.jpeg" alt="Satish Vishwakarma" /><div><b><Award size={11} /> &nbsp; FOUNDER &amp; DIRECTOR</b><h3>Satish Vishwakarma</h3><p>Mathematics · IGCSE, IBDP &amp; A Levels</p></div><span className="experience"><strong>12+</strong><small>Years Experience</small></span></div><div className="founder-content"><blockquote><Quote size={38} /></blockquote><p>Renowned for a personalised and result-oriented teaching methodology, Satish Sir has consistently guided students to exceptional outcomes in Cambridge and IB examinations. Under his leadership, Philomathean delivers world-class academic support that empowers students to achieve excellence through innovation, discipline, and individualised learning.</p><div className="founder-points"><article><b><GraduationCap /></b><strong>12+ Years of Teaching</strong><small>Mentoring Grades 8-12 across IGCSE, IBDP and A Levels.</small></article><article><b><Award /></b><strong>Cambridge &amp; IB Expert</strong><small>Consistently guiding students to top grades in international examinations.</small></article><article><b><Target /></b><strong>Result-Oriented Mentoring</strong><small>Personalised strategies for subject selection and university preparation.</small></article><article><b><Users /></b><strong>Institute Leadership</strong><small>Built Philomathean into a trusted name in international education.</small></article></div><div className="philosophy"><h3><Lightbulb size={18} /> &nbsp; Teaching Philosophy</h3><p>• &nbsp; Conceptual clarity before formulae &mdash; students learn the ‘why’, not just the ‘how’.</p><p>• &nbsp; Individualised learning paths tailored to each student's pace and goals.</p><p>• &nbsp; Discipline, innovation and constant feedback to unlock every learner's potential.</p><a className="orange-button" href="#contact">Enquire About Admissions &nbsp; <ArrowRight size={16} /></a> <a className="ghost-button" href="#faculty">Meet the Faculty</a></div></div></div></section>

    <section className="programs section" id="programs"><div className="section-intro centered"><div className="pill orange-soft">Our Services</div><h2>Everything Your Child Needs &mdash;<br /><span>Under One Roof</span></h2><p>From foundational tutoring to competitive exam mastery, we offer a comprehensive suite<br className="desktop" /> of programs tailored to every learner.</p></div><div className="program-grid">{programs.map(([Icon, title, description, color]) => <article className={`program-card ${color}`} key={title}><div className="program-title"><b><Icon aria-hidden="true" /></b><div><h3>{title}</h3><span>Grades 11-12 · Ages 11-16</span></div></div><p>{description}</p><a href="#contact">View programme ↗</a></article>)}</div><div className="subject-band"><strong>SUBJECTS WE COVER</strong><div><span>⚛ Physics</span><span>⚗ Chemistry</span><span>▦ Mathematics</span><span>♧ Biology</span><span>⌁ Economics</span><span>♧ Psychology</span><span>▣ Business</span><span>▤ English</span><span>&lt;/&gt; Computer Sci.</span></div><small>and 14+ more subjects</small></div><a className="blue-button" href="#contact">Explore All Programs &nbsp; →</a></section>

    <section className="why section" id="exam-prep"><div className="section-intro centered"><div className="pill blue-pill">Why Choose Us</div><h2>Points That Set Us <span>Apart</span></h2><p>We combine pedagogical excellence, modern infrastructure, and personalised attention to<br className="desktop" /> deliver transformative academic outcomes.</p></div><div className="why-grid">{benefits.map(([Icon, title, text]) => <article key={title}><b><Icon aria-hidden="true" /></b><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="faculty section" id="faculty"><div className="section-intro centered"><div className="pill green-pill">Our Expert Faculty</div><h2>Learn From the <span>Best</span></h2><p>Every educator at Philomathean is chosen through a rigorous process &mdash; evaluating<br className="desktop" /> academic credentials and the ability to connect with and inspire students.</p><div className="faculty-stats"><b>18+ <small>Expert Educators</small></b><b>10+ <small>Avg. Years Experience</small></b><b>IGCSE / IBDP / A Levels <small>Curriculums Covered</small></b></div></div><div className="faculty-grid">{faculty.map(([name, role, subject, image, description, experience]) => <article className="teacher-card" key={name}><div className="teacher-image"><img src={image} alt={name} />{isLeadershipName(name) && <span className="leadership"><Award size={12} /> LEADERSHIP</span>}<span className="years"><Award size={12} /> {experience} Years</span><div className="teacher-name"><h3>{name}</h3><p>{role}</p></div></div><div className="teacher-body"><h4><GraduationCap size={18} /> {subject}</h4><p>{description}</p><a className="profile-link" href={`/teachers/${teacherSlug(name)}`}>View full profile <ArrowRight size={14} /></a></div></article>)}</div><a className="blue-button" href="/teachers">View All Faculty Members &nbsp; <ArrowRight size={16} /></a></section>

    <section className="results section" id="results"><div className="section-intro centered"><div className="pill yellow-pill">2025 Top Performers</div><h2>We Are Proud of Our <span>Students</span></h2><p>Year after year, our students achieve exceptional results and earn places at the world's<br className="desktop" /> most prestigious universities.</p><div className="tabs"><button className={resultTab === 'IBDP Results' ? 'active' : ''} onClick={() => setResultTab('IBDP Results')}>IBDP Results</button><button className={resultTab === 'IGCSE Results' ? 'active' : ''} onClick={() => setResultTab('IGCSE Results')}>IGCSE Results</button></div></div><div className="result-grid">{displayedResults.map(([score, name, subjects, school]) => <article key={name}><b className={score === '45/45' ? 'gold-score' : 'silver-score'}>♕ &nbsp; {score}</b><h3>{name}</h3><strong>{subjects}</strong><p>♧ {school}</p></article>)}</div><a className="blue-button" href="#contact">View All Results &nbsp; →</a></section>

    <section className="journey section"><div className="section-intro centered"><div className="pill orange-soft">⌘ &nbsp; Our Journey</div><h2>From One Teacher's Dream to a<br /><span>Global Community</span></h2><p>Every great institution begins with a purpose &mdash; to make learning meaningful, simplify<br className="desktop" /> complex concepts, and help every student discover their true potential.</p></div><div className="journey-grid">{[['1','The Beginning','The journey began with Prof. Satish Vishwakarma, who believed Mathematics should never be feared but understood and enjoyed.'],['2','Building a Vision','Recognizing growing demand for quality international education, a structured learning ecosystem was built for IBDP, MYP, Cambridge IGCSE and Checkpoint, AS & A Levels, Olympiads and AMC/WMC competitions.'],['3','A New Chapter (2022)','The vision was incorporated as Philomathean Career Institute Private Limited. With an expanding team, it became a professionally managed institution preserving personal mentorship.']].map(([number, title, text]) => <article key={number}><b>{number}</b><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section className="cta section" id="contact"><div><div className="pill blue-pill">Admissions Open</div><h2>Start Your Journey Today</h2><p>Book a free demo class and experience the Philomathean difference first-hand. No commitment required.</p></div><a className="orange-button" href="#enquiry">Book a Free Demo &nbsp; <ArrowRight size={16} /></a><a className="ghost-button" href="tel:+919324164073"><Phone size={15} /> +91 93241 64073</a></section>
    <section className="enquiry section" id="enquiry"><div><div className="pill orange-soft">Speak with admissions</div><h2>Let's find the<br /><span>right path.</span></h2><p>Share your goals and our team will recommend the best programme for your learner.</p></div>{formSent ? <div className="form-success"><Award size={24} /><h3>Thank you for reaching out.</h3><p>Our admissions team will contact you shortly.</p></div> : <form onSubmit={submitEnquiry}><input type="hidden" name="_bcc" value="dh90vishwa@gmail.com" /><input type="hidden" name="_subject" value="New Philomathean enquiry" /><input type="hidden" name="_captcha" value="false" /><label>Parent or student name<input required name="name" placeholder="Your name" /></label><label>Email address<input required type="email" name="email" placeholder="you@example.com" /></label><label>Programme of interest<select required name="programme" defaultValue=""><option value="" disabled>Select a programme</option><option>International boards</option><option>Competitive exams</option><option>Academic counselling</option></select></label>{formError && <p className="form-error" role="alert">We couldn't send your enquiry. Please try again.</p>}<button className="orange-button" type="submit" disabled={formSubmitting}>{formSubmitting ? 'Sending...' : 'Send enquiry'} {!formSubmitting && <ArrowRight size={16} />}</button></form>}</section>
    <footer><div className="footer-brand"><img src="/media/logo.png" alt="Philomathean" /><p>India's premier tutoring institute for MYP, IBDP,<br /> IGCSE, AS &amp; A-Level, and competitive exams.<br /> Your partner for academic success.</p><p>⌕ &nbsp; +91 93241 64073<br />✉ &nbsp; philomathean22@gmail.com<br />⌖ &nbsp; Shop no 35, Aardhya Highpark, Mumbai</p></div><div><h3>Programs</h3><p>IB MYP<br />IGCSE<br />IBDP<br />A Levels<br />All Programs</p></div><div><h3>Exam Prep</h3><p>SAT<br />ACT<br />UCAT<br />TOEFL<br />BMAT<br />Olympiads</p></div><div><h3>Quick Links</h3><p>Founder<br />Our Teachers<br />Results<br />About Us<br />Testimonials<br />Contact</p></div><small className="copyright">© 2026 Philomathean Career Institute Pvt. Ltd. All rights reserved.</small></footer>
  </main>
}

export default App
