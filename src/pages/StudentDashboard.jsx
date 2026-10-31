import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Camera, Check, CheckCircle2, CircleHelp, ClipboardList, Clock3, Copy, Crown, Flame, Link2, LogOut, Mail, MessageCircle,
  Share2, Target, Trash2, Upload,
} from 'lucide-react'
import { SiteFooter } from '../components/site/SiteChrome'
import {
  cancelPlanRequest, ensureStudentProfile, leaveCourse, PROVIDER_LABELS, publishProgressShare, removeStudentPhoto, resetStudentPassword,
  signOutStudent, stopProgressShare, updateStudentProfile, uploadStudentPhoto,
} from '../firebase/student'
import { COURSES, courseUrl, getCourse, isExamKind } from '../student/catalog'
import { shareSnapshot } from '../student/progress'
import { Avatar, PlanBadge } from '../student/AccountMenu'
import { StudentHeader } from '../student/StudentChrome'
import { DASHBOARD_TABS, dashboardUrl } from '../student/links'
import { Modal, UpgradeDialog } from '../student/StudentDialogs'
import {
  Achievements, ActivityChart, AttemptList, CourseProgressCard, StatTile, TopicMastery,
} from '../student/DashboardWidgets'
import { formatDate, formatMinutes, kindLabel } from '../student/format'
import { GOLD_FEATURES, hasGold } from '../student/access'
import { loginUrl, useSession } from '../student/session'
import { useStudentData } from '../student/useStudent'
import '../student/student.css'

const readTab = () => { const tab = new URLSearchParams(window.location.search).get('tab'); return DASHBOARD_TABS.some(([id]) => id === tab) ? tab : 'overview' }
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening' }
const PROFILE_CHECKS = ['photoURL', 'phone', 'grade', 'school', 'curriculum', 'targetSession']
const CURRICULUM_PROGRAMME = { IBDP: 'ib', 'IB MYP': 'ib', IGCSE: 'igcse', 'AS & A Level': 'alevel' }

export default function StudentDashboard() {
  const { status, user, profile } = useSession()
  const [tab, setTab] = useState(readTab)
  const [share, setShare] = useState(false)
  const [upgrade, setUpgrade] = useState(false)
  const data = useStudentData(user?.uid)
  const creating = useRef(false)
  const [profileError, setProfileError] = useState(false)

  useEffect(() => { if (status === 'signed-out') window.location.replace(loginUrl('/dashboard')) }, [status])
  // Accounts created before the portal (or by an administrator) get their profile on first visit.
  useEffect(() => {
    if (status === 'ready' && user && !profile && !creating.current) { creating.current = true; ensureStudentProfile(user).catch(() => setProfileError(true)) }
  }, [status, user, profile])
  useEffect(() => { document.title = 'My dashboard | Philomathean' }, [])
  useEffect(() => {
    const onPop = () => setTab(readTab())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const select = (next) => { setTab(next); window.history.pushState(null, '', dashboardUrl(next)); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  if (profileError && !profile) return <main className="st-page"><StudentHeader active="dashboard" /><section className="st-empty-page"><h1>We couldn’t load your profile</h1><p>Check your connection and try again. If this keeps happening, contact the institute.</p><button type="button" className="st-primary" onClick={() => window.location.reload()}>Try again</button></section></main>
  if (!user || !profile || !data.ready) return <main className="st-page"><StudentHeader active="dashboard" /><div className="st-dash-loading" aria-busy="true"><span className="st-spinner" /> Loading your dashboard…</div></main>

  const { summary, attempts, enrollments } = data
  const name = profile.displayName || user.displayName || 'Student'
  const panelProps = { user, profile, summary, attempts, enrollments, select, openShare: () => setShare(true), openUpgrade: () => setUpgrade(true) }
  return <main className="st-page st-dash-page">
    <StudentHeader programme={CURRICULUM_PROGRAMME[profile.curriculum] || 'igcse'} active="dashboard" />
    <div className="st-dash">
      <aside className="st-dash-side">
        <div className="st-side-profile">
          <Avatar name={name} src={profile.photoURL} size={64} />
          <strong>{name}</strong>
          <small>{[profile.curriculum, profile.grade].filter(Boolean).join(' · ') || user.email}</small>
          <PlanBadge profile={profile} />
        </div>
        <nav className="st-side-nav" aria-label="Dashboard">{DASHBOARD_TABS.map(([id, label, Icon]) => <a key={id} href={dashboardUrl(id)} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={(event) => { event.preventDefault(); select(id) }}><Icon size={18} /> <span>{label}</span></a>)}</nav>
        <button type="button" className="st-share-button" onClick={() => setShare(true)}><Share2 size={16} /> Share my progress</button>
        {!hasGold(profile) && <div className="st-side-gold"><Crown size={20} /><strong>Go Gold</strong><p>Unlock every course, prediction exams and custom papers.</p><button type="button" className="st-gold-button st-block" onClick={() => setUpgrade(true)}>Upgrade</button></div>}
      </aside>
      <section className="st-dash-main">
        {tab === 'overview' && <Overview {...panelProps} name={name} />}
        {tab === 'courses' && <CoursesPanel {...panelProps} />}
        {tab === 'progress' && <ProgressPanel {...panelProps} />}
        {tab === 'exams' && <ExamsPanel {...panelProps} />}
        {tab === 'profile' && <ProfilePanel {...panelProps} />}
        {tab === 'subscription' && <SubscriptionPanel {...panelProps} />}
      </section>
    </div>
    {share && <ShareDialog user={user} profile={profile} summary={summary} onClose={() => setShare(false)} />}
    {upgrade && <UpgradeDialog onClose={() => setUpgrade(false)} />}
    <SiteFooter />
  </main>
}

function PanelHead({ title, text, children }) {
  return <div className="st-panel-head"><div><h1>{title}</h1>{text && <p>{text}</p>}</div>{children && <div className="st-panel-actions">{children}</div>}</div>
}

function StatRow({ summary }) {
  return <div className="st-stats">
    <StatTile icon={CircleHelp} label="Questions attempted" value={summary.answered} hint={`${summary.attempts} quizzes & exams`} tone="blue" />
    <StatTile icon={Target} label="Accuracy" value={`${summary.accuracy}%`} hint={`${summary.correct} correct answers`} tone="green" />
    <StatTile icon={ClipboardList} label="Exams given" value={summary.exams} hint={summary.exams ? `${summary.examAverage}% average` : 'Mock & prediction exams'} tone="purple" />
    <StatTile icon={Flame} label="Study streak" value={`${summary.streak} day${summary.streak === 1 ? '' : 's'}`} hint={`${formatMinutes(summary.minutes)} practised in total`} tone="orange" />
  </div>
}

function Overview({ profile, summary, attempts, select, openShare, name }) {
  const completeness = Math.round(PROFILE_CHECKS.filter((key) => profile[key]).length / PROFILE_CHECKS.length * 100)
  const active = summary.courses.slice().sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0)).slice(0, 4)
  const lastCourse = active[0] && getCourse(active[0].courseId)
  return <>
    <div className="st-welcome">
      <div>
        <p className="st-eyebrow">{greeting()}</p>
        <h1>Welcome back, {name.split(' ')[0]}!</h1>
        <p>{summary.answered ? `You’ve answered ${summary.answered} questions with ${summary.accuracy}% accuracy. Keep the momentum going.` : 'Start with a topic quiz — your progress will appear here as you practise.'}</p>
        <div className="st-welcome-actions">
          <a className="st-primary" href={lastCourse ? courseUrl(lastCourse, '#topic-quizzes') : '/courses'}>{lastCourse ? `Continue ${lastCourse.title}` : 'Find a course'} <ArrowRight size={16} /></a>
          <button type="button" className="st-secondary st-on-dark" onClick={openShare}><Share2 size={16} /> Share progress</button>
        </div>
      </div>
      {completeness < 100 && <button type="button" className="st-complete" onClick={() => select('profile')}>
        <span className="st-complete-ring" style={{ '--value': completeness }}><b>{completeness}%</b></span>
        <span><strong>Complete your profile</strong><small>Add a photo and details so teachers know you.</small></span>
      </button>}
    </div>
    <StatRow summary={summary} />
    <div className="st-grid-2">
      <div className="st-card"><div className="st-card-head"><h2>Activity</h2><small>Questions answered · last 14 days</small></div><ActivityChart daily={summary.daily} /></div>
      <div className="st-card"><div className="st-card-head"><h2>Recent attempts</h2><button type="button" className="st-text-button" onClick={() => select('exams')}>View all</button></div><AttemptList attempts={attempts.slice(0, 5)} empty="No attempts yet. Your quizzes and exams will appear here." /></div>
    </div>
    <div className="st-card">
      <div className="st-card-head"><h2>Continue learning</h2><button type="button" className="st-text-button" onClick={() => select('courses')}>My courses</button></div>
      {active.length ? <div className="st-progress-grid">{active.map((item) => <CourseProgressCard key={item.courseId} item={item} />)}</div>
        : <div className="st-muted-box">You haven’t enrolled in a course yet. <a href="/courses">Browse courses</a> and press “Enrol in course”.</div>}
    </div>
    <div className="st-card"><div className="st-card-head"><h2>Achievements</h2><small>{summary.achievements.filter((item) => item.earned).length} of {summary.achievements.length} earned</small></div><Achievements items={summary.achievements} /></div>
  </>
}

function CoursesPanel({ user, profile, summary, openUpgrade }) {
  const [leaving, setLeaving] = useState('')
  const enrolled = summary.courses.filter((item) => item.enrolled)
  const practised = summary.courses.filter((item) => !item.enrolled)
  const programme = CURRICULUM_PROGRAMME[profile.curriculum]
  const known = new Set(summary.courses.map((item) => item.courseId))
  const suggestions = COURSES.filter((course) => !known.has(course.id) && (!programme || course.programme === programme)).slice(0, 4)
  const leave = async (courseId) => { setLeaving(courseId); try { await leaveCourse(user.uid, courseId) } finally { setLeaving('') } }
  return <>
    <PanelHead title="My courses" text="Courses you’re enrolled in and how far you’ve got."><a className="st-primary" href="/courses">Browse courses</a></PanelHead>
    {enrolled.length ? <div className="st-progress-grid">{enrolled.map((item) => <CourseProgressCard key={item.courseId} item={item} actions={<span className="st-card-actions">
      <button type="button" className="st-text-button st-danger" onClick={() => leave(item.courseId)} disabled={leaving === item.courseId}>{leaving === item.courseId ? 'Leaving…' : 'Leave'}</button>
      <a className="st-card-link" href={courseUrl(getCourse(item.courseId), '#topic-quizzes')}>{item.attempts ? 'Continue' : 'Start'} <ArrowRight size={14} /></a></span>} />)}</div>
      : <div className="st-muted-box">No enrolments yet. Open any course and press “Enrol in course” to track it here.</div>}
    {practised.length > 0 && <><h2 className="st-subhead">Practised without enrolling</h2><div className="st-progress-grid">{practised.map((item) => <CourseProgressCard key={item.courseId} item={item} />)}</div></>}
    {suggestions.length > 0 && <><h2 className="st-subhead">Recommended for you</h2><div className="st-suggest-grid">{suggestions.map((course) => <a key={course.id} className="st-suggest" href={courseUrl(course)}>
      <span className={course.tier === 'free' ? 'st-tier st-tier-free' : 'st-tier st-tier-gold'}>{course.tier === 'free' ? 'Free' : <><Crown size={12} /> Gold</>}</span>
      <strong>{course.title}</strong><small>{course.topics.length} topics · {course.session}</small><span className="st-card-link">View course <ArrowRight size={14} /></span></a>)}</div>
      {!hasGold(profile) && <p className="st-hint">Gold courses need the Gold plan to enrol. <button type="button" className="st-text-button" onClick={openUpgrade}>See Gold benefits</button></p>}</>}
  </>
}

function ProgressPanel({ summary, openShare }) {
  const topics = summary.courses.flatMap((item) => item.topics.filter((topic) => topic.completed).map((topic) => ({ ...topic, course: getCourse(item.courseId).title })))
  const strong = topics.slice().sort((a, b) => b.mastery - a.mastery).slice(0, 3)
  const weak = topics.filter((topic) => topic.mastery < 80).sort((a, b) => a.mastery - b.mastery).slice(0, 3)
  return <>
    <PanelHead title="Progress" text="Accuracy, consistency and topic mastery across all your courses."><button type="button" className="st-primary" onClick={openShare}><Share2 size={16} /> Share progress</button></PanelHead>
    <StatRow summary={summary} />
    <div className="st-card"><div className="st-card-head"><h2>Daily activity</h2><small>Questions answered · last 14 days</small></div><ActivityChart daily={summary.daily} /></div>
    <div className="st-grid-2">
      <div className="st-card"><div className="st-card-head"><h2>Strongest topics</h2></div>{strong.length ? <ul className="st-topic-list">{strong.map((topic) => <li key={topic.course + topic.id}><span><strong>{topic.title}</strong><small>{topic.course}</small></span><span className="st-score st-score-good">{topic.mastery}%</span></li>)}</ul> : <p className="st-muted-box">Finish a few topic quizzes to see your strengths.</p>}</div>
      <div className="st-card"><div className="st-card-head"><h2>Focus next</h2></div>{weak.length ? <ul className="st-topic-list">{weak.map((topic) => <li key={topic.course + topic.id}><span><strong>{topic.title}</strong><small>{topic.course}</small></span><span className={topic.mastery >= 50 ? 'st-score st-score-mid' : 'st-score st-score-low'}>{topic.mastery}%</span></li>)}</ul> : <p className="st-muted-box">{topics.length ? 'Every topic you’ve practised is above 80% — great work!' : 'Topics below 80% mastery will be suggested here.'}</p>}</div>
    </div>
    <div className="st-card"><div className="st-card-head"><h2>Topic mastery</h2><small>Average best score across each topic’s quizzes</small></div>
      {summary.courses.length ? <div className="st-mastery-list">{summary.courses.map((item) => <TopicMastery key={item.courseId} item={item} />)}</div> : <p className="st-muted-box">Enrol in a course to see topic mastery.</p>}</div>
    <div className="st-card"><div className="st-card-head"><h2>Achievements</h2></div><Achievements items={summary.achievements} /></div>
  </>
}

function ExamsPanel({ attempts, summary }) {
  const [filter, setFilter] = useState('all')
  const list = attempts.filter((attempt) => filter === 'all' || (filter === 'exams' ? isExamKind(attempt.kind) : !isExamKind(attempt.kind)))
  const exams = attempts.filter((attempt) => isExamKind(attempt.kind))
  const best = exams.reduce((top, attempt) => Math.max(top, attempt.scorePct), 0)
  return <>
    <PanelHead title="Exams & attempts" text="Every quiz and exam you’ve finished, newest first." />
    <div className="st-stats">
      <StatTile icon={ClipboardList} label="Exams given" value={summary.exams} tone="purple" />
      <StatTile icon={Target} label="Average exam score" value={exams.length ? `${summary.examAverage}%` : '—'} tone="green" />
      <StatTile icon={Crown} label="Best exam score" value={exams.length ? `${best}%` : '—'} tone="orange" />
      <StatTile icon={CircleHelp} label="Questions attempted" value={summary.answered} tone="blue" />
    </div>
    <div className="st-card">
      <div className="st-card-head"><div className="st-segment" role="tablist">{[['all', 'All'], ['exams', 'Exams'], ['quizzes', 'Quizzes']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div><small>{list.length} records</small></div>
      {list.length ? <div className="st-table-wrap"><table className="st-table">
        <thead><tr><th>Date</th><th>Quiz / exam</th><th>Type</th><th>Mode</th><th>Questions</th><th>Time</th><th>Score</th></tr></thead>
        <tbody>{list.map((attempt) => <tr key={attempt.id}>
          <td>{formatDate(attempt.createdAt)}</td>
          <td><strong>{attempt.title}</strong><small>{getCourse(attempt.courseId)?.title || attempt.courseId}</small></td>
          <td>{kindLabel(attempt.kind)}</td>
          <td className="st-cap">{attempt.mode}</td>
          <td>{attempt.correct}/{attempt.total}{attempt.answered < attempt.total && <small>{attempt.total - attempt.answered} skipped</small>}</td>
          <td>{Math.floor(attempt.durationSec / 60)}m {attempt.durationSec % 60}s</td>
          <td><span className={attempt.scorePct >= 80 ? 'st-score st-score-good' : attempt.scorePct >= 50 ? 'st-score st-score-mid' : 'st-score st-score-low'}>{attempt.scorePct}%</span></td>
        </tr>)}</tbody>
      </table></div> : <p className="st-muted-box">{filter === 'exams' ? 'No exams yet — try a Mock Exam Paper from any course.' : 'Nothing here yet. Finish a quiz to see it listed.'}</p>}
    </div>
  </>
}

const CURRICULA = ['IGCSE', 'IBDP', 'AS & A Level', 'IB MYP', 'Grades 6–8 Foundation', 'SAT / ACT', 'AMC / Olympiad / PSAT', 'Other']
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Gap year / Other']
const SESSIONS = ['November 2026', 'May 2027', 'November 2027', 'May 2028', 'Oct/Nov 2026', 'May/June 2027', 'Oct/Nov 2027']

function ProfilePanel({ user, profile }) {
  const [form, setForm] = useState(() => ({ displayName: profile.displayName || '', phone: profile.phone || '', grade: profile.grade || '', school: profile.school || '', curriculum: profile.curriculum || '', targetSession: profile.targetSession || '', bio: profile.bio || '', parentEmail: profile.parentEmail || '' }))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [preview, setPreview] = useState('')
  const fileRef = useRef(null)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const save = async (event) => {
    event.preventDefault()
    if (!form.displayName.trim()) return setMessage(['error', 'Please enter your name.'])
    setSaving(true); setMessage(null)
    try { await updateStudentProfile(user.uid, form); setMessage(['success', 'Profile saved.']) } catch { setMessage(['error', 'Could not save your profile. Please try again.']) } finally { setSaving(false) }
  }
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true); setMessage(null); setPreview(URL.createObjectURL(file))
    try { await uploadStudentPhoto(user.uid, file); setMessage(['success', 'Photo updated.']) } catch (error) {
      setMessage(['error', error.message === 'PHOTO_TYPE' ? 'Please choose an image file (JPG, PNG or WebP).' : error.message === 'PHOTO_SIZE' ? 'That image is larger than 5 MB.' : 'Could not upload the photo. Please try again.'])
    } finally { setPhotoBusy(false); setPreview('') }
  }
  const removePhoto = async () => { setPhotoBusy(true); try { await removeStudentPhoto(user.uid, profile.photoPath) } finally { setPhotoBusy(false) } }
  const reset = async () => { await resetStudentPassword(user.email); setMessage(['success', `Password reset link sent to ${user.email}.`]) }
  const created = profile.createdAt?.toDate?.()
  const methods = user.providerData.map((item) => PROVIDER_LABELS[item.providerId]).filter(Boolean)
  const hasPassword = user.providerData.some((item) => item.providerId === 'password')
  return <>
    <PanelHead title="Profile" text="Your details help teachers personalise feedback." />
    <div className="st-card st-photo-card">
      <div className="st-photo">
        <Avatar name={form.displayName} src={preview || profile.photoURL} size={112} />
        {photoBusy && <span className="st-photo-busy"><span className="st-spinner" /></span>}
        <button type="button" className="st-photo-edit" onClick={() => fileRef.current?.click()} aria-label="Change photo"><Camera size={16} /></button>
      </div>
      <div>
        <h2>Profile photo</h2>
        <p>JPG, PNG or WebP up to 5 MB. We crop it to a square automatically.</p>
        <div className="st-row">
          <button type="button" className="st-primary" onClick={() => fileRef.current?.click()} disabled={photoBusy}><Upload size={16} /> {profile.photoURL ? 'Change photo' : 'Upload photo'}</button>
          {profile.photoURL && <button type="button" className="st-secondary" onClick={removePhoto} disabled={photoBusy}><Trash2 size={16} /> Remove</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />
      </div>
    </div>
    <form className="st-card st-form" onSubmit={save}>
      <div className="st-card-head"><h2>Personal details</h2></div>
      <div className="st-field-grid">
        <label className="st-field"><span>Full name</span><input required value={form.displayName} onChange={set('displayName')} maxLength={80} /></label>
        <label className="st-field"><span>Phone</span><input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91" maxLength={20} /></label>
        <label className="st-field"><span>Curriculum</span><select value={form.curriculum} onChange={set('curriculum')}><option value="">Select…</option>{CURRICULA.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="st-field"><span>Grade</span><select value={form.grade} onChange={set('grade')}><option value="">Select…</option>{GRADES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="st-field"><span>School</span><input value={form.school} onChange={set('school')} maxLength={120} /></label>
        <label className="st-field"><span>Target exam session</span><select value={form.targetSession} onChange={set('targetSession')}><option value="">Select…</option>{SESSIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="st-field"><span>Parent / guardian email</span><input type="email" value={form.parentEmail} onChange={set('parentEmail')} maxLength={120} /></label>
        <label className="st-field st-field-wide"><span>About me &amp; goals</span><textarea rows={3} value={form.bio} onChange={set('bio')} maxLength={500} placeholder="e.g. Aiming for a 7 in Math AA HL; need help with calculus." /></label>
      </div>
      {message && <p className={`st-alert st-alert-${message[0]}`} role={message[0] === 'error' ? 'alert' : 'status'}>{message[0] === 'success' && <CheckCircle2 size={16} />} {message[1]}</p>}
      <div className="st-row st-row-end"><button className="st-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>
    <div className="st-card">
      <div className="st-card-head"><h2>Account</h2></div>
      <dl className="st-dl"><div><dt>Email</dt><dd>{user.email || '—'}</dd></div><div><dt>Sign-in method</dt><dd>{methods.join(', ') || '—'}</dd></div><div><dt>Member since</dt><dd>{formatDate(created)}</dd></div><div><dt>Plan</dt><dd><PlanBadge profile={profile} /></dd></div></dl>
      <div className="st-row">{hasPassword && <button type="button" className="st-secondary" onClick={reset}><Mail size={16} /> Send password reset email</button>}<button type="button" className="st-secondary" onClick={async () => { await signOutStudent(); window.location.href = '/' }}><LogOut size={16} /> Sign out</button></div>
    </div>
  </>
}

function SubscriptionPanel({ user, profile, openUpgrade }) {
  const gold = hasGold(profile)
  const [busy, setBusy] = useState(false)
  const cancel = async () => { setBusy(true); try { await cancelPlanRequest(user.uid) } finally { setBusy(false) } }
  const free = [`Free courses: ${COURSES.filter((course) => course.tier === 'free').map((course) => course.title).join(', ')}`, 'Topic quizzes, revision ladders and mock exams on free courses', 'A free preview quiz in every Gold course', 'Progress tracking, achievements and sharing']
  return <>
    <PanelHead title="Subscription" text="Your plan and what it includes." />
    <div className={gold ? 'st-plan-current gold' : 'st-plan-current'}>
      <div><small>Current plan</small><h2>{gold ? <><Crown size={22} /> Gold</> : 'Free'}</h2><p>{gold ? (profile.planExpiresAt ? `Active until ${formatDate(profile.planExpiresAt)}` : 'Active') : 'Upgrade any time to unlock every course.'}</p></div>
      {!gold && !profile.planRequest && <button type="button" className="st-gold-button" onClick={openUpgrade}><Crown size={16} /> Upgrade to Gold</button>}
    </div>
    {!gold && profile.planRequest && <div className="st-alert st-alert-info st-request"><Clock3 size={18} /><div><strong>Gold request pending</strong><p>Sent {formatDate(profile.planRequest.at)}. Our admissions team will contact you to activate it.</p></div><button type="button" className="st-text-button st-danger" onClick={cancel} disabled={busy}>Cancel request</button></div>}
    <div className="st-plans">
      <div className={gold ? 'st-plan-card' : 'st-plan-card current'}><h3>Free</h3><p className="st-plan-price">₹0</p><ul>{free.map((item) => <li key={item}><Check size={16} /> {item}</li>)}</ul>{!gold && <span className="st-plan-tag">Your plan</span>}</div>
      <div className={gold ? 'st-plan-card gold current' : 'st-plan-card gold'}><h3><Crown size={18} /> Gold</h3><p className="st-plan-price">Talk to admissions</p><ul><li><Check size={16} /> Everything in Free</li>{GOLD_FEATURES.map((item) => <li key={item}><Check size={16} /> {item}</li>)}</ul>
        {gold ? <span className="st-plan-tag">Your plan</span> : !profile.planRequest && <button type="button" className="st-gold-button st-block" onClick={openUpgrade}>Request Gold</button>}</div>
    </div>
    <p className="st-hint">Already a Philomathean classroom student? Request Gold and mention your batch — we’ll activate it for you.</p>
  </>
}

function ShareDialog({ user, profile, summary, onClose }) {
  const [shareId, setShareId] = useState(profile.shareId || '')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const snapshot = useMemo(() => shareSnapshot(profile, summary), [profile, summary])
  const url = shareId ? `${window.location.origin}/progress/${shareId}` : ''
  const text = `${snapshot.displayName} has answered ${snapshot.stats.answered} questions with ${snapshot.stats.accuracy}% accuracy on Philomathean.`
  const publish = async () => { setBusy(true); setError(''); try { setShareId(await publishProgressShare(user.uid, profile, snapshot)) } catch { setError('Could not create the link. Please try again.') } finally { setBusy(false) } }
  const stop = async () => { setBusy(true); try { await stopProgressShare(user.uid, shareId); setShareId('') } finally { setBusy(false) } }
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setError('Copy failed — select the link and copy it manually.') } }
  const native = () => navigator.share?.({ title: 'My Philomathean progress', text, url }).catch(() => {})
  return <Modal title="Share my progress" onClose={onClose}>
    <div className="st-share">
      <span className="st-upgrade-icon st-upgrade-icon-blue"><Share2 size={22} /></span>
      <h2>Share your progress</h2>
      <p>Create a read-only progress card for parents, teachers or friends. It shows your name, photo, stats, course progress and achievements — never your email or phone.</p>
      <div className="st-share-preview">
        <Avatar name={snapshot.displayName} src={snapshot.photoURL} size={44} />
        <div><strong>{snapshot.displayName}</strong><small>{snapshot.stats.answered} questions · {snapshot.stats.accuracy}% accuracy · {snapshot.stats.exams} exams</small></div>
      </div>
      {!shareId ? <button type="button" className="st-primary st-block" onClick={publish} disabled={busy}><Link2 size={16} /> {busy ? 'Creating link…' : 'Create share link'}</button> : <>
        <div className="st-copy"><input readOnly value={url} onFocus={(event) => event.target.select()} aria-label="Share link" /><button type="button" className="st-primary" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}</button></div>
        <div className="st-share-targets">
          <a className="st-secondary" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
          <a className="st-secondary" href={`mailto:${profile.parentEmail || ''}?subject=${encodeURIComponent('My Philomathean progress')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}><Mail size={16} /> Email</a>
          {typeof navigator.share === 'function' && <button type="button" className="st-secondary" onClick={native}><Share2 size={16} /> More…</button>}
        </div>
        <div className="st-row st-row-between"><button type="button" className="st-text-button" onClick={publish} disabled={busy}>Update with latest stats</button><button type="button" className="st-text-button st-danger" onClick={stop} disabled={busy}>Stop sharing</button></div>
      </>}
      {error && <p className="st-alert st-alert-error" role="alert">{error}</p>}
    </div>
  </Modal>
}
