import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Mail, MapPin, Menu, Phone, X } from 'lucide-react'

const PHONE = '+91 93241 64073'
const examPrepOptions = [['SAT', 'US college admissions'], ['ACT', 'US college admissions'], ['UCAT', 'Medical school entrance'], ['TOEFL', 'English proficiency'], ['BMAT', 'Biomedical admissions'], ['Olympiads', 'Competitive science & maths']]

export function BrandLockup() {
  return <a className="logo-lockup" href="/#home" aria-label="Philomathean home"><img src="/media/logo.png" alt="" /><span><strong>PHILOMATHEAN</strong><small>CAREER INSTITUTE PVT. LTD.</small></span></a>
}

function ExamPrepDropdown({ base, closeMenu }) {
  const [open, setOpen] = useState(false)
  const closeDropdown = () => { setOpen(false); closeMenu() }
  return <div className={open ? 'nav-dropdown-wrap dropdown-open' : 'nav-dropdown-wrap'} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button className="nav-dropdown-trigger" type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>Exam Prep {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
    {open && <div className="nav-dropdown" role="menu">{examPrepOptions.map(([title, description]) => <a href={`${base}#exam-prep`} role="menuitem" key={title} onClick={closeDropdown}><strong>{title}</strong><small>{description}</small></a>)}</div>}
  </div>
}

// One header for every page. `active` highlights the current section; on the home page links stay in-page.
export function SiteHeader({ active, home = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const base = home ? '' : '/'
  const closeMenu = () => setMenuOpen(false)
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])
  const link = (id, href, label) => <a href={href} className={active === id ? 'active-link' : undefined} aria-current={active === id ? 'page' : undefined} onClick={closeMenu}>{label}</a>
  return <header className="topbar site-topbar">
    <BrandLockup />
    <button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="site-nav">{menuOpen ? <X size={20} /> : <Menu size={20} />}<span className="sr-only">Menu</span></button>
    <nav id="site-nav" className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Main">
      {link('programs', `${base}#programs`, <>Programs</>)}
      <ExamPrepDropdown base={base} closeMenu={closeMenu} />
      {link('premium', '/premium-sources', 'Past Papers')}
      {link('teachers', home ? '#faculty' : '/teachers', 'Our Teachers')}
      {link('results', `${base}#results`, 'Results')}
      {link('about', `${base}#about`, 'About Us')}
    </nav>
    <div className="header-actions"><a className="phone" href="tel:+919324164073"><Phone size={15} /> {PHONE}</a><a className="outline-button" href={`${base}#contact`}>Enquire Now</a><a className="orange-button" href={`${base}#contact`}>Book Free Demo</a></div>
  </header>
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-brand"><img src="/media/logo.png" alt="Philomathean" /><p>India's premier tutoring institute for MYP, IBDP,<br /> IGCSE, AS &amp; A-Level, and competitive exams.<br /> Your partner for academic success.</p><p className="footer-contact"><a href="tel:+919324164073"><Phone size={14} /> {PHONE}</a><a href="mailto:philomathean22@gmail.com"><Mail size={14} /> philomathean22@gmail.com</a><span><MapPin size={14} /> Shop no 35, Aardhya Highpark, Mumbai</span></p></div>
    <div><h3>Programs</h3><p><a href="/#programs">IB MYP</a><br /><a href="/#programs">IGCSE</a><br /><a href="/#programs">IBDP</a><br /><a href="/#programs">A Levels</a><br /><a href="/#programs">All Programs</a></p></div>
    <div><h3>Study Resources</h3><p><a href="/past-papers?subject=IGCSE">IGCSE Past Papers</a><br /><a href="/past-papers?subject=AS%20%26%20A%20Level">A Level Past Papers</a><br /><a href="/past-papers?subject=IBDP">IBDP Past Papers</a><br /><a href="/premium-sources">All Resources</a><br /><a href="/#exam-prep">Exam Prep</a></p></div>
    <div><h3>Quick Links</h3><p><a href="/#about">Founder</a><br /><a href="/teachers">Our Teachers</a><br /><a href="/#results">Results</a><br /><a href="/#testimonials">Testimonials</a><br /><a href="/#contact">Contact</a></p></div>
    <small className="copyright">© {new Date().getFullYear()} Philomathean Career Institute Pvt. Ltd. All rights reserved.</small>
  </footer>
}
