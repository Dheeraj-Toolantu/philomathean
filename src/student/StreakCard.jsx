import { ArrowRight, Flame, Trophy } from 'lucide-react'
import { streakMessage } from './progress'

// The daily streak: today's flame, this week's practice days and the next milestone, with a nudge to practise.
export function StreakCard({ info, practiseHref = '/courses', compact = false }) {
  const lit = info.practisedToday
  const progress = info.next ? Math.round(((info.current - info.previous) / (info.next - info.previous)) * 100) : 100
  return <section className={`st-streak${lit ? ' is-lit' : ''}${compact ? ' is-compact' : ''}`} aria-label="Daily practice streak">
    <div className="st-streak-top">
      <span className="st-streak-flame" aria-hidden="true"><Flame size={30} /></span>
      <div className="st-streak-count"><strong>{info.current}</strong><span>day streak</span></div>
      <div className="st-streak-best"><Trophy size={14} /> Best {info.best}</div>
    </div>
    <ol className="st-streak-week" aria-label="This week">
      {info.week.map((day) => <li key={day.key} className={`${day.done ? 'done' : ''}${day.today ? ' today' : ''}${day.future ? ' future' : ''}`} title={day.key}>
        <span>{day.done ? <Flame size={14} /> : null}</span><small>{day.label}</small>
      </li>)}
    </ol>
    <p className="st-streak-msg">{streakMessage(info)}</p>
    {info.next && <div className="st-streak-goal"><span style={{ width: `${progress}%` }} /><small>{info.current}/{info.next} days to the next badge</small></div>}
    {!lit && <a className="st-streak-cta" href={practiseHref}>Practise now <ArrowRight size={15} /></a>}
  </section>
}
