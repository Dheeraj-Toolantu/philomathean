import { useState } from 'react'
import { Atom, BookOpen, ChartLine, ChevronDown, ChevronRight, ChevronUp, Crown, FlaskConical, Sigma, TrendingUp, Users } from 'lucide-react'
import { hasGold } from './access'
import { useOutsideClose } from './AccountMenu'
import { coursesForSubject, courseUrl, FAMILIES, getSubject, PROGRAMMES } from './catalog'
import { dashboardUrl } from './links'
import { useSession } from './session'

const ICONS = { Atom, ChartLine, FlaskConical, Sigma, TrendingUp, Users }
export const CatalogIcon = ({ name, size = 18 }) => { const Icon = ICONS[name] || BookOpen; return <Icon size={size} aria-hidden="true" /> }

// The three-column subject explorer from the course bar ("Subjects ▾"), also used on /courses.
export function SubjectExplorer({ programme, onNavigate }) {
  const families = FAMILIES.filter((family) => family.programme === programme)
  const [familyId, setFamilyId] = useState(families[0]?.id)
  const family = families.find((item) => item.id === familyId) || families[0]
  const [subjectId, setSubjectId] = useState(family?.subjects[0])
  const subject = getSubject(family?.subjects.includes(subjectId) ? subjectId : family?.subjects[0])
  const pathway = PROGRAMMES.find((item) => item.id === programme)?.pastPapers
  if (!family) return null
  const pickFamily = (item) => { setFamilyId(item.id); setSubjectId(item.subjects[0]) }
  return <div className="st-explorer">
    <ul className="st-explorer-col st-explorer-families" aria-label="Subject groups">
      {families.map((item) => <li key={item.id}><button type="button" className={item.id === family.id ? 'active' : ''} onMouseEnter={() => pickFamily(item)} onFocus={() => pickFamily(item)} onClick={() => pickFamily(item)}>
        <span className={`st-hex st-hex-${item.tone}`}><CatalogIcon name={item.icon} /></span>
        <span className="st-explorer-label">{item.title}</span>
        {item.badge && <span className={`st-tag st-tag-${item.badge.toLowerCase()}`}>{item.badge}</span>}
        {item.id === family.id && <ChevronRight size={16} className="st-explorer-arrow" />}
      </button></li>)}
    </ul>
    <ul className="st-explorer-col st-explorer-subjects" aria-label="Subjects">
      {family.subjects.map((id) => { const item = getSubject(id); return <li key={id}><button type="button" className={id === subject.id ? 'active' : ''} onMouseEnter={() => setSubjectId(id)} onFocus={() => setSubjectId(id)} onClick={() => setSubjectId(id)}>
        <span className="st-square"><CatalogIcon name={item.icon} size={15} /></span>
        <span className="st-explorer-label">{item.title}</span>
        {id === subject.id && <ChevronRight size={16} className="st-explorer-arrow" />}
      </button></li> })}
    </ul>
    <div className="st-explorer-levels">
      {coursesForSubject(subject.id).map((course) => <div key={course.id} className="st-explorer-level">
        <h4><a href={courseUrl(course)} onClick={onNavigate}>{course.title}</a>{course.tier === 'premium' && <Crown size={13} className="st-gold-icon" aria-label="Gold course" />}</h4>
        <a href={courseUrl(course)} onClick={onNavigate}>Practice Exams</a>
        <a href={courseUrl(course, '#topic-quizzes')} onClick={onNavigate}>Topic Quizzes</a>
        <a href={courseUrl(course, '#revision-ladder')} onClick={onNavigate}>Revision Ladder</a>
        <a href={courseUrl(course, '#mock-exams')} onClick={onNavigate}>Mock Exam Papers</a>
        <a href={courseUrl(course, '#prediction-exam')} onClick={onNavigate}>Prediction Exam</a>
        <a href={`/past-papers?subject=${encodeURIComponent(pathway)}`} onClick={onNavigate}>Past Papers</a>
      </div>)}
    </div>
  </div>
}

// Secondary bar under the site header on student pages: programme switcher, Subjects mega menu, quick links.
export function CourseBar({ programme: initialProgramme = 'ib', active }) {
  const { user, profile } = useSession()
  const [programme, setProgramme] = useState(initialProgramme)
  const [menu, setMenu] = useState(null)
  const ref = useOutsideClose(Boolean(menu), () => setMenu(null))
  const toggle = (name) => setMenu(menu === name ? null : name)
  const current = PROGRAMMES.find((item) => item.id === programme)
  return <div className="st-coursebar" ref={ref}>
    <div className="st-coursebar-inner">
      <div className="st-coursebar-group">
        <button type="button" className={menu === 'programme' ? 'st-bar-button open' : 'st-bar-button'} aria-expanded={menu === 'programme'} onClick={() => toggle('programme')}>{current.label} {menu === 'programme' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
        {menu === 'programme' && <div className="st-programme-menu" role="menu">{PROGRAMMES.map((item) => <button type="button" role="menuitemradio" aria-checked={item.id === programme} key={item.id} className={item.id === programme ? 'active' : ''} onClick={() => { setProgramme(item.id); setMenu('subjects') }}><strong>{item.label}</strong><small>{item.title}</small></button>)}</div>}
        <span className="st-bar-divider" aria-hidden="true" />
        <button type="button" className={menu === 'subjects' ? 'st-bar-button st-bar-pill open' : 'st-bar-button'} aria-expanded={menu === 'subjects'} onClick={() => toggle('subjects')}>Subjects {menu === 'subjects' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
        <a className={active === 'courses' ? 'st-bar-link active' : 'st-bar-link'} href="/courses">All courses</a>
        {user && <a className={active === 'dashboard' ? 'st-bar-link active' : 'st-bar-link'} href="/dashboard">My dashboard</a>}
        {user && <a className="st-bar-link st-hide-sm" href={dashboardUrl('progress')}>Progress</a>}
      </div>
      {!hasGold(profile) && <a className="st-gold-button" href={user ? dashboardUrl('subscription') : '/login?mode=signup&next=%2Fdashboard%3Ftab%3Dsubscription'}><Crown size={15} /> Upgrade to Gold</a>}
    </div>
    {menu === 'subjects' && <div className="st-mega"><SubjectExplorer key={programme} programme={programme} onNavigate={() => setMenu(null)} /></div>}
  </div>
}
