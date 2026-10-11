import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, ClipboardList, Clock3, Crown, Flag, LayoutDashboard, Lightbulb, Lock, PencilLine,
  RotateCcw, Timer, XCircle,
} from 'lucide-react'
import { BrandLockup } from '../components/site/SiteChrome'
import { saveAttempt } from '../firebase/student'
import { canOpenQuiz } from '../student/access'
import { buildQuiz, courseUrl, getCourse, isExamKind } from '../student/catalog'
import { AccountMenu } from '../student/AccountMenu'
import { UpgradeDialog } from '../student/StudentDialogs'
import { loginUrl, useSession } from '../student/session'
import '../student/student.css'

const params = new URLSearchParams(window.location.search)
const LETTERS = 'ABCDEF'
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`

function ScoreRing({ value }) {
  const radius = 52
  const length = 2 * Math.PI * radius
  return <svg className="st-ring" viewBox="0 0 120 120" role="img" aria-label={`Score ${value}%`}>
    <circle cx="60" cy="60" r={radius} className="st-ring-track" />
    <circle cx="60" cy="60" r={radius} className={value >= 80 ? 'st-ring-value good' : value >= 50 ? 'st-ring-value mid' : 'st-ring-value low'} strokeDasharray={`${length * value / 100} ${length}`} transform="rotate(-90 60 60)" />
    <text x="60" y="58" textAnchor="middle" className="st-ring-text">{value}%</text>
    <text x="60" y="78" textAnchor="middle" className="st-ring-sub">score</text>
  </svg>
}

export default function QuizPage() {
  const course = getCourse(params.get('course'))
  const quizId = params.get('quiz') || ''
  const { status, user, profile } = useSession()
  const [seed] = useState(() => Date.now())
  const [mode, setMode] = useState(params.get('mode') === 'exam' ? 'exam' : 'study')
  const quiz = useMemo(() => course ? buildQuiz(course, quizId, seed) : null, [course, quizId, seed])
  const [phase, setPhase] = useState('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [flags, setFlags] = useState({})
  const [revealed, setRevealed] = useState({})
  const [startedAt, setStartedAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [result, setResult] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [upgrade, setUpgrade] = useState(false)
  const finishing = useRef(false)

  useEffect(() => { if (quiz) document.title = `${quiz.title} · ${course.title} | Philomathean` }, [quiz, course])

  const finish = useCallback(() => {
    if (finishing.current || !quiz) return
    finishing.current = true
    const total = quiz.questions.length
    const answered = Object.keys(answers).length
    const correct = quiz.questions.filter((question, i) => answers[i] === question.answer).length
    const durationSec = Math.round((Date.now() - startedAt) / 1000)
    const next = { total, answered, correct, scorePct: Math.round(correct / total * 100), durationSec }
    setResult(next)
    setPhase('results')
    window.scrollTo({ top: 0 })
    if (!user) return
    setSaveState('saving')
    const topicId = quiz.kind === 'topic' ? quizId.split(':')[1] : ''
    saveAttempt(user.uid, { courseId: course.id, quizId: quiz.id, kind: quiz.kind, title: quiz.title, mode, topicId, ...next })
      .then(() => setSaveState('saved')).catch(() => setSaveState('failed'))
  }, [answers, course, mode, quiz, quizId, startedAt, user])

  // Exam timer: measured against a deadline (accurate even if the tab is throttled); submits at zero.
  const finishRef = useRef(finish)
  useEffect(() => { finishRef.current = finish }, [finish])
  useEffect(() => {
    if (phase !== 'running' || mode !== 'exam') return undefined
    const deadline = startedAt + quiz.minutes * 60 * 1000
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) finishRef.current()
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, mode, startedAt, quiz])
  useEffect(() => {
    if (phase !== 'running') return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  if (!course || !quiz) return <main className="st-quiz-page"><QuizTop /><section className="st-empty-page"><h1>Quiz not found</h1><p>The link may be out of date.</p><a className="st-primary" href="/courses">Browse courses</a></section></main>

  const locked = status !== 'loading' && !canOpenQuiz(course, quiz.id, profile)
  const start = () => {
    finishing.current = false
    setAnswers({}); setFlags({}); setRevealed({}); setIndex(0); setResult(null); setSaveState('idle')
    setStartedAt(Date.now()); setRemaining(quiz.minutes * 60); setPhase('running')
  }
  const question = quiz.questions[index]
  const choose = (option) => {
    if (mode === 'study' && revealed[index]) return
    setAnswers({ ...answers, [index]: option })
    if (mode === 'study') setRevealed({ ...revealed, [index]: true })
  }
  const unanswered = quiz.questions.length - Object.keys(answers).length
  const submit = () => { if (unanswered && !window.confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`)) return; finish() }
  const exam = isExamKind(quiz.kind)

  if (phase === 'intro') return <main className="st-quiz-page"><QuizTop course={course} />
    <section className="st-quiz-intro">
      <a className="st-back-link" href={courseUrl(course, quiz.kind === 'topic' ? '#topic-quizzes' : '')}><ArrowLeft size={16} /> {course.title}</a>
      <span className={`st-type-icon st-type-lg ${exam ? 'st-type-mint' : quiz.kind === 'ladder' ? 'st-type-plum' : 'st-type-rose'}`}>{exam ? <ClipboardList size={30} /> : <PencilLine size={30} />}</span>
      <h1>{quiz.title}</h1>
      <p className="st-quiz-intro-course">{course.fullTitle}</p>
      <div className="st-quiz-meta st-quiz-meta-lg"><span><CircleHelp size={17} /> {quiz.questions.length} questions</span><span><Clock3 size={17} /> {quiz.minutes} mins</span>{exam && <span><ClipboardList size={17} /> Counts as an exam</span>}</div>
      <div className="st-mode-pick" role="radiogroup" aria-label="Mode">
        <button type="button" role="radio" aria-checked={mode === 'study'} className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}><Lightbulb size={20} /><strong>Study mode</strong><small>See the answer and worked explanation after each question.</small></button>
        <button type="button" role="radio" aria-checked={mode === 'exam'} className={mode === 'exam' ? 'active' : ''} onClick={() => setMode('exam')}><Timer size={20} /><strong>Exam mode</strong><small>Timed, no hints. Review everything when you submit.</small></button>
      </div>
      {locked ? <div className="st-locked-box"><Lock size={20} /><div><strong>{quiz.kind === 'prediction' ? 'Prediction exams are part of Gold.' : 'This quiz is part of Gold.'}</strong><p>{user ? 'Upgrade to unlock every quiz and exam in this course.' : 'Log in to check your access.'}</p></div>{user ? <button type="button" className="st-gold-button" onClick={() => setUpgrade(true)}><Crown size={15} /> Upgrade</button> : <a className="st-primary" href={loginUrl()}>Log in</a>}</div>
        : <>
          {status !== 'loading' && !user && <p className="st-alert st-alert-info">You’re practising as a guest — <a href={loginUrl()}>log in</a> to save your score and track progress.</p>}
          <button type="button" className="st-primary st-start" onClick={start} disabled={status === 'loading'}>Start {mode === 'exam' ? 'exam' : 'studying'} <ArrowRight size={17} /></button>
        </>}
    </section>
    {upgrade && <UpgradeDialog reason="Unlock this quiz with Gold." onClose={() => setUpgrade(false)} />}
  </main>

  if (phase === 'results') return <main className="st-quiz-page"><QuizTop course={course} />
    <section className="st-results">
      <div className="st-results-card">
        <ScoreRing value={result.scorePct} />
        <div className="st-results-copy">
          <p className="st-eyebrow">{mode === 'exam' ? 'Exam complete' : 'Study session complete'}</p>
          <h1>{result.scorePct >= 80 ? 'Excellent work!' : result.scorePct >= 50 ? 'Good effort — keep going!' : 'Keep practising — you’ve got this.'}</h1>
          <p>{quiz.title} · {course.title}</p>
          <div className="st-results-stats">
            <span className="good"><CheckCircle2 size={16} /> {result.correct} correct</span>
            <span className="bad"><XCircle size={16} /> {result.answered - result.correct} incorrect</span>
            <span><CircleHelp size={16} /> {result.total - result.answered} skipped</span>
            <span><Clock3 size={16} /> {clock(result.durationSec)}</span>
          </div>
          <p className="st-save-note" role="status">{!user ? <>Not saved — <a href={loginUrl()}>log in</a> to track your progress.</> : saveState === 'saving' ? 'Saving to your dashboard…' : saveState === 'saved' ? <><CheckCircle2 size={14} /> Saved to your dashboard</> : saveState === 'failed' ? 'Could not save this attempt. Check your connection.' : ''}</p>
          <div className="st-results-actions"><button type="button" className="st-primary" onClick={start}><RotateCcw size={16} /> Try again</button><a className="st-secondary" href={courseUrl(course)}>Back to course</a>{user && <a className="st-secondary" href="/dashboard"><LayoutDashboard size={16} /> Dashboard</a>}</div>
        </div>
      </div>
      <h2 className="st-review-title">Review answers</h2>
      <ol className="st-review">{quiz.questions.map((item, i) => {
        const given = answers[i]
        const state = given == null ? 'skipped' : given === item.answer ? 'correct' : 'wrong'
        return <li key={item.id} className={`st-review-item ${state}`}>
          <div className="st-review-head"><span>Question {i + 1}</span><span className={`st-review-badge ${state}`}>{state === 'correct' ? 'Correct' : state === 'wrong' ? 'Incorrect' : 'Skipped'}</span></div>
          <p className="st-review-q">{item.prompt}</p>
          <p><strong>Answer:</strong> {item.options[item.answer]}{state === 'wrong' && <span className="st-review-yours"> · You chose: {item.options[given]}</span>}</p>
          <p className="st-explain"><Lightbulb size={15} /> {item.explain}</p>
        </li>
      })}</ol>
    </section>
  </main>

  const isRevealed = mode === 'study' && revealed[index]
  return <main className="st-quiz-page"><QuizTop course={course} title={quiz.title} timer={mode === 'exam' ? remaining : null} />
    <section className="st-player">
      <div className="st-player-main">
        <div className="st-player-progress"><span>Question {index + 1} of {quiz.questions.length}</span><div className="st-bar"><span style={{ width: `${(index + 1) / quiz.questions.length * 100}%` }} /></div></div>
        <article className="st-question">
          <div className="st-question-top"><span className={`st-diff st-diff-${question.difficulty}`}>{['Foundation', 'Exam standard', 'Challenge'][question.difficulty - 1]}</span>
            {mode === 'exam' && <button type="button" className={flags[index] ? 'st-flag active' : 'st-flag'} onClick={() => setFlags({ ...flags, [index]: !flags[index] })} aria-pressed={Boolean(flags[index])}><Flag size={15} /> {flags[index] ? 'Flagged' : 'Flag for review'}</button>}</div>
          <h2>{question.prompt}</h2>
          <div className="st-options" role="radiogroup" aria-label="Answer options">{question.options.map((option, optionIndex) => {
            const chosen = answers[index] === optionIndex
            const cls = isRevealed ? (optionIndex === question.answer ? 'correct' : chosen ? 'wrong' : 'dim') : chosen ? 'chosen' : ''
            return <button type="button" role="radio" aria-checked={chosen} key={option} className={`st-option ${cls}`} onClick={() => choose(optionIndex)} disabled={isRevealed}>
              <span className="st-option-letter">{LETTERS[optionIndex]}</span><span>{option}</span>
              {isRevealed && optionIndex === question.answer && <CheckCircle2 size={18} className="st-option-mark" />}
              {isRevealed && chosen && optionIndex !== question.answer && <XCircle size={18} className="st-option-mark" />}
            </button>
          })}</div>
          {isRevealed && <div className={answers[index] === question.answer ? 'st-feedback good' : 'st-feedback bad'} role="status"><strong>{answers[index] === question.answer ? 'Correct!' : 'Not quite.'}</strong><p><Lightbulb size={15} /> {question.explain}</p></div>}
        </article>
        <div className="st-player-nav">
          <button type="button" className="st-secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}><ArrowLeft size={16} /> Previous</button>
          {index < quiz.questions.length - 1 ? <button type="button" className="st-primary" onClick={() => setIndex(index + 1)} disabled={mode === 'study' && !revealed[index]}>Next <ArrowRight size={16} /></button>
            : <button type="button" className="st-primary" onClick={mode === 'exam' ? submit : finish} disabled={mode === 'study' && !revealed[index]}>{mode === 'exam' ? 'Submit exam' : 'See results'} <CheckCircle2 size={16} /></button>}
        </div>
      </div>
      <aside className="st-navigator" aria-label="Question navigator">
        <h3>Questions</h3>
        <div className="st-nav-grid">{quiz.questions.map((item, i) => {
          const state = mode === 'study' && revealed[i] ? (answers[i] === item.answer ? 'correct' : 'wrong') : answers[i] != null ? 'answered' : ''
          return <button type="button" key={item.id} className={`${state} ${i === index ? 'current' : ''} ${flags[i] ? 'flagged' : ''}`} onClick={() => setIndex(i)} aria-label={`Question ${i + 1}${state ? `, ${state}` : ''}${flags[i] ? ', flagged' : ''}`} aria-current={i === index}>{i + 1}</button>
        })}</div>
        <p className="st-nav-legend"><span className="answered" /> Answered <span className="flagged" /> Flagged</p>
        <p className="st-nav-count">{quiz.questions.length - unanswered} of {quiz.questions.length} answered</p>
        {mode === 'exam' && <button type="button" className="st-primary st-block" onClick={submit}>Submit exam</button>}
        {mode === 'study' && <button type="button" className="st-secondary st-block" onClick={submit}>Finish early</button>}
      </aside>
    </section>
  </main>
}

function QuizTop({ course, title, timer = null }) {
  return <header className="st-quiz-top">
    <BrandLockup />
    {title && <span className="st-quiz-top-title">{title}<small>{course?.title}</small></span>}
    <div className="st-quiz-top-right">
      {timer != null && <span className={timer < 60 ? 'st-timer urgent' : 'st-timer'} role="timer" aria-label={`Time remaining ${clock(timer)}`}><Timer size={16} /> {clock(timer)}</span>}
      <AccountMenu />
    </div>
  </header>
}
