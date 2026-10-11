import { useEffect, useState } from 'react'
import { Award, CircleHelp, ClipboardList, Clock3, Crown, Flame, Target } from 'lucide-react'
import { SiteFooter, SiteHeader } from '../components/site/SiteChrome'
import { loadProgressShare } from '../firebase/student'
import { ProgressBar, StatTile } from '../student/DashboardWidgets'
import { formatDate, formatMinutes } from '../student/format'
import { Avatar } from '../student/AccountMenu'
import '../student/student.css'

export default function SharedProgress({ shareId }) {
  const [state, setState] = useState({ loading: true, share: null })
  useEffect(() => {
    let active = true
    loadProgressShare(shareId).then((share) => { if (active) setState({ loading: false, share }) }).catch(() => { if (active) setState({ loading: false, share: null }) })
    return () => { active = false }
  }, [shareId])
  const { loading, share } = state
  useEffect(() => { if (share) document.title = `${share.displayName}’s progress | Philomathean` }, [share])

  return <main className="st-page">
    <SiteHeader />
    {loading ? <div className="st-dash-loading" aria-busy="true"><span className="st-spinner" /> Loading progress…</div>
      : !share ? <section className="st-empty-page"><h1>This progress card isn’t available</h1><p>The student may have stopped sharing it.</p><a className="st-primary" href="/courses">Explore Philomathean practice</a></section>
      : <section className="st-shared">
        <div className="st-shared-card">
          <div className="st-shared-head">
            <Avatar name={share.displayName} src={share.photoURL} size={88} />
            <div>
              <p className="st-eyebrow">Student progress card</p>
              <h1>{share.displayName}</h1>
              <p>{[share.curriculum, share.grade].filter(Boolean).join(' · ')}{share.plan === 'gold' && <span className="st-plan st-plan-gold"><Crown size={12} /> Gold</span>}</p>
              {share.updatedAt && <small>Updated {formatDate(share.updatedAt)}</small>}
            </div>
          </div>
          <div className="st-stats">
            <StatTile icon={CircleHelp} label="Questions attempted" value={share.stats.answered} tone="blue" />
            <StatTile icon={Target} label="Accuracy" value={`${share.stats.accuracy}%`} tone="green" />
            <StatTile icon={ClipboardList} label="Exams given" value={share.stats.exams} hint={share.stats.exams ? `${share.stats.examAverage}% average` : ''} tone="purple" />
            <StatTile icon={Flame} label="Study streak" value={`${share.stats.streak} days`} hint={<><Clock3 size={12} /> {formatMinutes(share.stats.minutes)} practised</>} tone="orange" />
          </div>
          {share.courses?.length > 0 && <div className="st-card"><div className="st-card-head"><h2>Courses</h2></div>
            {share.courses.map((course) => <div className="st-mastery-row" key={course.courseId}><span className="st-mastery-name">{course.title}</span><ProgressBar value={course.progress} label={`${course.title} progress`} /><span className="st-mastery-value">{course.progress}%</span></div>)}</div>}
          {share.achievements?.length > 0 && <div className="st-card"><div className="st-card-head"><h2>Achievements</h2></div><ul className="st-badges">{share.achievements.map((title) => <li key={title} className="earned"><span className="st-badge-icon"><Award size={20} /></span><strong>{title}</strong></li>)}</ul></div>}
        </div>
        <div className="st-shared-cta"><h2>Practise with Philomathean</h2><p>Topic quizzes, mock exams and progress tracking for IB, IGCSE and A Level.</p><a className="st-primary" href="/login?mode=signup">Create a free account</a></div>
      </section>}
    <SiteFooter />
  </main>
}
