import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Clock3, Crown, FileText, Home, Lock, Orbit,
  PencilLine, Plus, TrendingUp, Wrench,
} from 'lucide-react'
import { SiteFooter } from '../components/site/SiteChrome'
import { enrollInCourse } from '../firebase/student'
import { canEnroll, canOpenQuiz, quizUrl } from '../student/access'
import {
  COURSES, coursesForSubject, courseUrl, getCourse, getFamily, getSubject, ladderQuizzes, mockQuizzes, predictionQuiz, PROGRAMMES, topicQuiz,
} from '../student/catalog'
import { courseProgress } from '../student/progress'
import { CatalogIcon, StudentHeader } from '../student/StudentChrome'
import { Modal, UpgradeDialog } from '../student/StudentDialogs'
import { loginUrl, useSession } from '../student/session'
import { useStudentData } from '../student/useStudent'
import { useQuestionBanks } from '../student/useQuestionBanks'
import '../student/student.css'

const REVISION_TYPES = [
  ['topic-quizzes', 'Topic Quizzes', 'Test Yourself', PencilLine, 'rose'],
  ['revision-ladder', 'Revision Ladder', 'Exams by Difficulty', TrendingUp, 'plum'],
  ['mock-exams', 'Mock Exam Papers', 'Full timed papers', ClipboardList, 'mint'],
  ['prediction-exam', 'Prediction Exam', 'Upcoming session', Orbit, 'slate'],
]

function Crumb({ label, items, current }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return <div className={current ? 'st-crumb st-crumb-current' : 'st-crumb'} ref={ref}>
    <span>{label}</span>
    <button type="button" aria-label={`More options for ${label}`} aria-expanded={open} onClick={() => setOpen(!open)}><ChevronDown size={15} /></button>
    {open && <div className="st-crumb-menu" role="menu">{items.map(([text, href]) => <a key={href} role="menuitem" href={href} onClick={() => setOpen(false)}>{text}</a>)}</div>}
  </div>
}

function QuizCard({ course, quiz, best, profile, onLocked, loading }) {
  const open = canOpenQuiz(course, quiz.id, profile)
  const attempted = best != null
  const empty = !loading && !quiz.count
  const go = (event) => { if (empty) event.preventDefault(); else if (!open) { event.preventDefault(); onLocked(quiz) } }
  return <article className={empty ? 'st-quiz-card st-quiz-empty' : open ? 'st-quiz-card' : 'st-quiz-card st-quiz-locked'}>
    <div className="st-quiz-body">
      <h4>{quiz.title}{!open && <Lock size={14} aria-label="Gold only" />}</h4>
      {quiz.blurb && <p>{quiz.blurb}</p>}
      <div className="st-quiz-meta">{loading ? <span><CircleHelp size={15} /> Loading…</span> : empty ? <span><CircleHelp size={15} /> No questions yet</span> : <><span><CircleHelp size={15} /> {quiz.count} question{quiz.count === 1 ? '' : 's'}</span><span><Clock3 size={15} /> {quiz.minutes} mins</span></>}</div>
      {attempted && <span className={best >= 80 ? 'st-score st-score-good' : best >= 50 ? 'st-score st-score-mid' : 'st-score st-score-low'}>Best: {best}%</span>}
    </div>
    <div className="st-quiz-actions">
      <a className="st-outline-pill" href={quizUrl(course, quiz.id, 'study')} onClick={go} aria-disabled={empty || undefined}>{empty ? 'Coming soon' : open ? 'Open Study' : <><Crown size={14} /> Unlock with Gold</>}</a>
      <a className="st-round-icon" href={quizUrl(course, quiz.id, 'exam')} onClick={go} title="Exam mode (timed)" aria-label={`Start ${quiz.title} in timed exam mode`}><ClipboardList size={16} /></a>
    </div>
  </article>
}

function BuildExamDialog({ course, onClose }) {
  const [topics, setTopics] = useState(course.topics.map((item) => item.id))
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState('exam')
  const toggle = (id) => setTopics(topics.includes(id) ? topics.filter((item) => item !== id) : [...topics, id])
  const start = () => { window.location.href = quizUrl(course, `custom:${topics.join('+')}:${count}:${Math.floor(Math.random() * 1e9)}`, mode) }
  return <Modal title="Build my exam" onClose={onClose}>
    <div className="st-builder">
      <span className="st-upgrade-icon st-upgrade-icon-blue"><Wrench size={22} /></span>
      <h2>Build my exam</h2>
      <p>Choose topics and length — we’ll assemble a fresh paper from the {course.title} question bank.</p>
      <fieldset><legend>Topics</legend>{course.topics.map((item) => <label key={item.id} className="st-check-card"><input type="checkbox" checked={topics.includes(item.id)} onChange={() => toggle(item.id)} /><span><small>Topic {item.number}</small>{item.title}</span></label>)}</fieldset>
      <fieldset><legend>Number of questions</legend><div className="st-segment">{[5, 10, 15, 20].map((value) => <button type="button" key={value} className={count === value ? 'active' : ''} onClick={() => setCount(value)}>{value}</button>)}</div></fieldset>
      <fieldset><legend>Mode</legend><div className="st-segment">{[['exam', 'Exam (timed)'], ['study', 'Study (instant feedback)']].map(([value, label]) => <button type="button" key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>)}</div></fieldset>
      <button type="button" className="st-primary st-block" disabled={!topics.length} onClick={start}>Start exam</button>
    </div>
  </Modal>
}

export default function CoursePage({ courseId }) {
  const course = getCourse(courseId)
  const { user, profile } = useSession()
  const { attempts, enrollments } = useStudentData(user?.uid)
  const { banks, loading: banksLoading } = useQuestionBanks()
  const [upgrade, setUpgrade] = useState(null)
  const [builder, setBuilder] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { if (course) document.title = `${course.fullTitle} Practice Exams | Philomathean` }, [course])

  if (!course) return <main className="st-page"><StudentHeader active="courses" /><section className="st-empty-page"><h1>Course not found</h1><p>That course may have moved.</p><a className="st-primary" href="/courses">Browse all courses</a></section><SiteFooter /></main>

  const subject = getSubject(course.subject)
  const family = getFamily(course.family)
  const programme = PROGRAMMES.find((item) => item.id === course.programme)
  const progress = courseProgress(course, attempts)
  const enrolled = enrollments.some((item) => item.id === course.id)
  const ladder = ladderQuizzes(course, banks)
  const mocks = mockQuizzes(course, banks)
  const prediction = predictionQuiz(course, banks)
  const card = (quiz) => <QuizCard key={quiz.id} course={course} quiz={quiz} best={progress.best[quiz.id]} profile={profile} onLocked={onLocked} loading={banksLoading} />
  const isFreeCourse = course.tier === 'free'

  const lockReason = (quiz) => quiz.kind === 'prediction' ? 'Prediction exams are part of Gold.' : `${course.title} is a Gold course. You can try its first topic quiz for free.`
  const onLocked = (quiz) => user ? setUpgrade(lockReason(quiz)) : window.location.assign(loginUrl())
  const enroll = async () => {
    if (!user) return window.location.assign(loginUrl())
    if (!canEnroll(course, profile)) return setUpgrade(`Enrolling in ${course.title} needs the Gold plan.`)
    setBusy(true)
    try { await enrollInCourse(user.uid, course) } finally { setBusy(false) }
  }
  const openBuilder = () => {
    if (!user) return window.location.assign(loginUrl())
    if (!canOpenQuiz(course, 'custom:x', profile)) return setUpgrade(`“Build my Exam” for ${course.title} is part of Gold.`)
    setBuilder(true)
  }
  const description = `The ${course.fullTitle} practice exams are the perfect resource to customise your revision plan. Hone your skills on important concepts with ${course.title} Topic Quizzes, climb the Revision Ladder to reach the hardest questions, then sit full-length Mock Exam Papers to simulate the real exam from start to finish.`

  return <main className="st-page">
    <StudentHeader programme={course.programme} active="courses" />

    <section className="st-course-hero">
      <div className="st-wrap">
        <nav className="st-crumbs" aria-label="Breadcrumb">
          <a className="st-crumb-home" href="/courses" aria-label="All courses"><Home size={16} /></a><span className="st-crumb-sep">/</span>
          <Crumb label={family.title.replace('Individuals & Societies', 'I&S')} items={family.subjects.flatMap((id) => coursesForSubject(id)).map((item) => [item.title, courseUrl(item)])} />
          <span className="st-crumb-sep">/</span>
          <Crumb label={course.title} items={COURSES.filter((item) => item.programme === course.programme).map((item) => [item.title, courseUrl(item)])} />
          <span className="st-crumb-sep">/</span>
          <Crumb current label="Practice Exams" items={REVISION_TYPES.map(([id, title]) => [title, `#${id}`])} />
        </nav>
        <div className="st-course-head">
          <div>
            <span className={isFreeCourse ? 'st-tier st-tier-free' : 'st-tier st-tier-gold'}>{isFreeCourse ? 'Free course' : <><Crown size={13} /> Gold course</>}</span>
            <h1><span>{course.fullTitle}</span> Practice Exams</h1>
            <p>{description}</p>
            <div className="st-course-actions">
              <button type="button" className="st-primary" onClick={openBuilder}><Wrench size={17} /> Build my Exam</button>
              {enrolled ? <span className="st-enrolled"><CheckCircle2 size={17} /> Enrolled</span>
                : <button type="button" className="st-secondary" onClick={enroll} disabled={busy}>{canEnroll(course, profile) || !user ? <Plus size={17} /> : <Crown size={16} />} {busy ? 'Enrolling…' : 'Enrol in course'}</button>}
            </div>
            {user && (enrolled || progress.attempts > 0) && <div className="st-course-progress">
              <div><strong>{progress.progress}%</strong><small>topic quizzes completed ({progress.completed}/{progress.total})</small></div>
              <div className="st-bar" role="progressbar" aria-valuenow={progress.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><span style={{ width: `${progress.progress}%` }} /></div>
              <div><strong>{progress.accuracy}%</strong><small>accuracy · {progress.answered} questions</small></div>
            </div>}
          </div>
          <div className="st-course-tiles" aria-hidden="true">
            <span className="st-tile st-tile-blue"><CatalogIcon name={subject.icon} size={34} /></span>
            <span className="st-tile"><FileText size={34} /></span>
          </div>
        </div>
      </div>
    </section>

    <section className="st-types">
      <div className="st-wrap">
        <h2>Choose Revision Type</h2>
        <div className="st-type-grid">{REVISION_TYPES.map(([id, title, text, Icon, tone]) => <a key={id} className="st-type-card" href={`#${id}`}>
          {id === 'prediction-exam' && <span className="st-new">New</span>}
          <span className={`st-type-icon st-type-${tone}`}><Icon size={26} /></span>
          <h3>{title}</h3>
          <p>{id === 'prediction-exam' ? `${course.session} Prediction Exam` : id === 'mock-exams' ? `Official-style ${course.session.split(' ').pop()} trial exams` : text}</p>
          <span className="st-round-icon st-type-arrow"><ArrowDown size={18} /></span>
        </a>)}</div>
      </div>
    </section>

    <section className="st-practice">
      <div className="st-wrap">
        <div className="st-section-card" id="topic-quizzes">
          <span className="st-type-icon st-type-rose st-type-lg"><PencilLine size={30} /></span>
          <div><h2>Topic Quizzes</h2><p>Perfect for a quick study session on any topic or concept.{!isFreeCourse && !canOpenQuiz(course, 'topic:x', profile) && ' Try the first quiz free — upgrade to Gold for the rest.'}</p></div>
        </div>
        {course.topics.map((item) => <div className="st-topic" key={item.id}>
          <p className="st-topic-num">Topic {item.number}</p>
          <h3>{item.title}</h3>
          <div className="st-quiz-grid">{item.quizzes.map((quiz) => card(topicQuiz(quiz, banks)))}</div>
        </div>)}

        <div className="st-section-card" id="revision-ladder">
          <span className="st-type-icon st-type-plum st-type-lg"><TrendingUp size={30} /></span>
          <div><h2>Revision Ladder</h2><p>Questions grouped by difficulty across the whole syllabus — climb one rung at a time.</p></div>
        </div>
        <div className="st-quiz-grid st-quiz-grid-3">{ladder.map(card)}</div>

        <div className="st-section-card" id="mock-exams">
          <span className="st-type-icon st-type-mint st-type-lg"><ClipboardList size={30} /></span>
          <div><h2>Mock Exam Papers</h2><p>Full-length, timed papers. Every mock you finish is recorded under “Exams” on your dashboard.</p></div>
        </div>
        <div className="st-quiz-grid st-quiz-grid-3">{mocks.map(card)}</div>

        <div className="st-section-card" id="prediction-exam">
          <span className="st-type-icon st-type-slate st-type-lg"><Orbit size={30} /></span>
          <div><h2>Prediction Exam <span className="st-tier st-tier-gold"><Crown size={12} /> Gold</span></h2><p>Our faculty’s selection of exam-standard questions for the {course.session} session.</p></div>
        </div>
        <div className="st-quiz-grid st-quiz-grid-3">{card(prediction)}</div>

        <div className="st-past-papers"><div><h3>Want the real thing?</h3><p>Practise with official {programme.title} past papers and mark schemes.</p></div><a className="st-secondary" href={`/past-papers?subject=${encodeURIComponent(programme.pastPapers)}`}>Browse past papers</a></div>
      </div>
    </section>

    {showTop && <button type="button" className="st-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"><ArrowUp size={20} /></button>}
    {upgrade && <UpgradeDialog reason={upgrade} onClose={() => setUpgrade(null)} />}
    {builder && <BuildExamDialog course={course} onClose={() => setBuilder(false)} />}
    <SiteFooter />
  </main>
}
