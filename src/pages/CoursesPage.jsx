import { useState } from 'react'
import { ArrowRight, CheckCircle2, CircleHelp, Crown, Layers } from 'lucide-react'
import { SiteFooter } from '../components/site/SiteChrome'
import { COURSES, courseBankIds, courseQuestionCount, courseUrl, FAMILIES, getSubject, PROGRAMMES } from '../student/catalog'
import { courseProgress } from '../student/progress'
import { CatalogIcon, StudentHeader, SubjectExplorer } from '../student/StudentChrome'
import { useSession } from '../student/session'
import { useStudentData } from '../student/useStudent'
import { useQuestionBanks } from '../student/useQuestionBanks'
import '../student/student.css'

const startProgramme = () => { const value = new URLSearchParams(window.location.search).get('programme'); return PROGRAMMES.some((item) => item.id === value) ? value : 'ib' }

export default function CoursesPage() {
  const { user } = useSession()
  const { attempts, enrollments } = useStudentData(user?.uid)
  const { banks, loading: banksLoading } = useQuestionBanks()
  const [programme, setProgramme] = useState(startProgramme)
  const pick = (id) => { setProgramme(id); window.history.replaceState(null, '', id === 'ib' ? '/courses' : `/courses?programme=${id}`) }
  const families = FAMILIES.filter((family) => family.programme === programme)
  const totalQuestions = [...new Set(COURSES.flatMap(courseBankIds))].reduce((sum, bank) => sum + (banks[bank] || []).length, 0)

  return <main className="st-page">
    <StudentHeader programme={programme} active="courses" />
    <section className="st-course-hero st-hub-hero">
      <div className="st-wrap">
        <span className="st-eyebrow">Practice & revision</span>
        <h1><span>Exam practice</span> built by our faculty</h1>
        <p>Topic quizzes, difficulty ladders, timed mock exams and prediction papers for IB, IGCSE and A Level — with your progress tracked on every question.</p>
        <div className="st-hub-stats"><div><strong>{COURSES.length}</strong><small>courses</small></div><div><strong>{banksLoading ? '…' : totalQuestions}</strong><small>practice questions</small></div><div><strong>4</strong><small>revision formats</small></div></div>
      </div>
    </section>

    <section className="st-hub">
      <div className="st-wrap">
        <div className="st-programme-tabs" role="tablist" aria-label="Programme">{PROGRAMMES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={programme === item.id} className={programme === item.id ? 'active' : ''} onClick={() => pick(item.id)}>{item.label}<small>{item.title}</small></button>)}</div>
        <div className="st-explorer-card"><h2 className="sr-only">Explore subjects</h2><SubjectExplorer key={programme} programme={programme} /></div>

        {families.map((family) => <div className="st-family" key={family.id}>
          <h2><span className={`st-hex st-hex-${family.tone}`}><CatalogIcon name={family.icon} /></span>{family.title}</h2>
          <div className="st-course-grid">{COURSES.filter((course) => course.family === family.id).map((course) => {
            const subject = getSubject(course.subject)
            const progress = user ? courseProgress(course, attempts) : null
            const enrolled = enrollments.some((item) => item.id === course.id)
            return <a className="st-course-card" href={courseUrl(course)} key={course.id}>
              <div className="st-course-card-top"><span className="st-square st-square-lg"><CatalogIcon name={subject.icon} size={20} /></span>
                <span className={course.tier === 'free' ? 'st-tier st-tier-free' : 'st-tier st-tier-gold'}>{course.tier === 'free' ? 'Free' : <><Crown size={12} /> Gold</>}</span></div>
              <h3>{course.title}</h3>
              <p>{course.fullTitle}</p>
              <div className="st-quiz-meta"><span><Layers size={15} /> {course.topics.length} topics</span><span><CircleHelp size={15} /> {banksLoading ? '…' : courseQuestionCount(course, banks)} questions</span></div>
              {progress && (enrolled || progress.attempts > 0) && <div className="st-mini-progress"><div className="st-bar"><span style={{ width: `${progress.progress}%` }} /></div><small>{enrolled && <><CheckCircle2 size={13} /> Enrolled · </>}{progress.progress}% complete</small></div>}
              <span className="st-card-link">Open practice exams <ArrowRight size={15} /></span>
            </a>
          })}</div>
        </div>)}
      </div>
    </section>
    <SiteFooter />
  </main>
}
