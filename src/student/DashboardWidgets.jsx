import { useState } from 'react'
import { ArrowRight, Award, ClipboardList, Lock, PencilLine, TrendingUp } from 'lucide-react'
import { courseUrl, getCourse, getSubject, isExamKind } from './catalog'
import { CatalogIcon } from './StudentChrome'
import { formatDate, kindLabel } from './format'

export function StatTile({ icon: Icon, label, value, hint, tone = 'blue' }) {
  return <div className={`st-stat st-stat-${tone}`}>
    <span className="st-stat-icon"><Icon size={19} /></span>
    <span className="st-stat-label">{label}</span>
    <strong>{value}</strong>
    {hint && <small>{hint}</small>}
  </div>
}

// Questions answered per day for the last 14 days. Single series: one colour, no legend, hover tooltip.
export function ActivityChart({ daily }) {
  const [hover, setHover] = useState(null)
  const width = 640, height = 200, pad = { top: 16, right: 8, bottom: 28, left: 32 }
  const max = Math.max(5, ...daily.map((day) => day.questions))
  const step = Math.ceil(max / 4)
  const top = step * 4
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const slot = innerW / daily.length
  const barW = Math.min(26, slot - 6)
  const y = (value) => pad.top + innerH - value / top * innerH
  const bar = (x, h) => h <= 0 ? '' : `M${x},${y(0)} V${y(0) - h + 4} Q${x},${y(0) - h} ${x + 4},${y(0) - h} H${x + barW - 4} Q${x + barW},${y(0) - h} ${x + barW},${y(0) - h + 4} V${y(0)} Z`
  const total = daily.reduce((sum, day) => sum + day.questions, 0)
  return <figure className="st-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Questions answered per day over the last 14 days, ${total} in total`} onMouseLeave={() => setHover(null)}>
      {[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(tick * step)} y2={y(tick * step)} className={tick ? 'st-grid' : 'st-axis'} /><text x={pad.left - 8} y={y(tick * step) + 4} textAnchor="end" className="st-tick">{tick * step}</text></g>)}
      {daily.map((day, i) => {
        const x = pad.left + i * slot + (slot - barW) / 2
        const h = day.questions / top * innerH
        return <g key={day.key} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${day.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}: ${day.questions} questions`}>
          <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
          {h > 0 ? <path d={bar(x, Math.max(h, 4))} className={hover === i ? 'st-bar-mark active' : 'st-bar-mark'} /> : <rect x={x} y={y(0) - 2} width={barW} height={2} rx={1} className="st-bar-zero" />}
          {(i % 2 === daily.length % 2 || i === daily.length - 1) && <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="st-tick">{i === daily.length - 1 ? 'Today' : day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>}
        </g>
      })}
    </svg>
    {hover != null && <div className="st-tooltip" style={{ left: `${(pad.left + hover * slot + slot / 2) / width * 100}%`, top: `${y(daily[hover].questions) / height * 100}%` }}>
      <small>{daily[hover].date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</small><strong>{daily[hover].questions} questions</strong>
    </div>}
    <table className="sr-only"><caption>Questions answered per day</caption><tbody>{daily.map((day) => <tr key={day.key}><th scope="row">{day.key}</th><td>{day.questions}</td></tr>)}</tbody></table>
  </figure>
}

export function ProgressBar({ value, label, tone = '' }) {
  return <div className={`st-bar ${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}><span style={{ width: `${value}%` }} /></div>
}

export function CourseProgressCard({ item, actions }) {
  const course = getCourse(item.courseId)
  const subject = getSubject(course.subject)
  return <article className="st-progress-card">
    <div className="st-progress-card-head">
      <span className="st-square st-square-lg"><CatalogIcon name={subject.icon} size={20} /></span>
      <div><h4><a href={courseUrl(course)}>{course.title}</a></h4><small>{item.completed}/{item.total} topic quizzes · {item.accuracy}% accuracy</small></div>
      <strong className="st-progress-pct">{item.progress}%</strong>
    </div>
    <ProgressBar value={item.progress} label={`${course.title} progress`} />
    <div className="st-progress-card-foot">
      <span>{item.lastActivity ? `Last practised ${formatDate(item.lastActivity)}` : 'Not started yet'}</span>
      {actions || <a className="st-card-link" href={courseUrl(course, '#topic-quizzes')}>{item.attempts ? 'Continue' : 'Start'} <ArrowRight size={14} /></a>}
    </div>
  </article>
}

export function TopicMastery({ item }) {
  const course = getCourse(item.courseId)
  return <div className="st-mastery">
    <h4>{course.title}</h4>
    {item.topics.map((topic) => <div className="st-mastery-row" key={topic.id}>
      <span className="st-mastery-name">Topic {topic.number} · {topic.title}</span>
      <ProgressBar value={topic.mastery} label={`${topic.title} mastery`} tone={topic.mastery >= 80 ? 'good' : topic.mastery >= 50 ? 'mid' : topic.completed ? 'low' : ''} />
      <span className="st-mastery-value">{topic.completed ? `${topic.mastery}%` : '—'}</span>
    </div>)}
  </div>
}

export function AttemptList({ attempts, empty }) {
  if (!attempts.length) return <p className="st-muted-box">{empty}</p>
  return <ul className="st-attempts">{attempts.map((attempt) => {
    const course = getCourse(attempt.courseId)
    const exam = isExamKind(attempt.kind)
    return <li key={attempt.id}>
      <span className={exam ? 'st-type-icon st-type-mint' : attempt.kind === 'ladder' ? 'st-type-icon st-type-plum' : 'st-type-icon st-type-rose'}>{exam ? <ClipboardList size={17} /> : attempt.kind === 'ladder' ? <TrendingUp size={17} /> : <PencilLine size={17} />}</span>
      <div><strong>{attempt.title}</strong><small>{course?.title || attempt.courseId} · {kindLabel(attempt.kind)} · {formatDate(attempt.createdAt)}</small></div>
      <span className={attempt.scorePct >= 80 ? 'st-score st-score-good' : attempt.scorePct >= 50 ? 'st-score st-score-mid' : 'st-score st-score-low'}>{attempt.scorePct}%</span>
    </li>
  })}</ul>
}

export function Achievements({ items }) {
  return <ul className="st-badges">{items.map((item) => <li key={item.id} className={item.earned ? 'earned' : ''} title={item.text}>
    <span className="st-badge-icon">{item.earned ? <Award size={20} /> : <Lock size={16} />}</span>
    <strong>{item.title}</strong><small>{item.text}</small>
  </li>)}</ul>
}
