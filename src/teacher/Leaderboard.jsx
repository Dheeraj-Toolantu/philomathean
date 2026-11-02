import { ChevronLeft, ChevronRight, Crown, Flame, Medal, Trophy } from 'lucide-react'
import { formatWeek, weeklyLeaderboard } from './marks'
import { liveStreak } from '../student/progress'
import './teacher.css'

export function WeekPicker({ week, isCurrent, canPrev, canNext, prev, next }) {
  return <div className="lb-week" role="group" aria-label="Choose week">
    <button type="button" onClick={prev} disabled={!canPrev} aria-label="Previous week"><ChevronLeft size={16} /></button>
    <span><small>{isCurrent ? 'This week' : 'Week of'}</small><b>{formatWeek(week)}</b></span>
    <button type="button" onClick={next} disabled={!canNext} aria-label="Next week"><ChevronRight size={16} /></button>
  </div>
}

const MEDALS = ['gold', 'silver', 'bronze']
const initial = (name) => String(name || '?').trim()[0]?.toUpperCase() || '?'

// Pass `marks` (teachers: full ranking computed live) or `entries` (students: the published top 10).
export function LeaderboardView({ marks, entries, participants, week, meUid, mine, showFullNames = false, emptyText }) {
  const rows = entries || weeklyLeaderboard(marks || [], week.start)
  const total = participants ?? rows.length
  if (!rows.length) return <div className="lb-empty"><Trophy size={28} /><p>{emptyText || 'No test marks for this week yet. The leaderboard fills in as soon as marks are entered.'}</p></div>
  const podium = rows.filter((row) => row.rank <= 3).slice(0, 3)
  const rest = rows.slice(podium.length)
  const label = (row) => showFullNames && row.fullName ? row.fullName : row.name
  const inTop = meUid && rows.some((row) => row.studentUid === meUid)
  return <div className="lb">
    <ol className="lb-podium" aria-label="Top three">
      {podium.map((row) => <li key={row.studentUid} className={`lb-podium-${MEDALS[row.rank - 1] || 'bronze'}${row.studentUid === meUid ? ' is-me' : ''}`}>
        <span className="lb-medal">{row.rank === 1 ? <Crown size={18} /> : <Medal size={18} />}<b>{row.rank}</b></span>
        <span className="lb-avatar" aria-hidden="true">{initial(row.name)}</span>
        <strong>{label(row)}{row.studentUid === meUid && <em> (you)</em>}</strong>
        <span className="lb-score">{row.average}%</span>
        <small>{row.tests} test{row.tests === 1 ? '' : 's'} · best {row.best}%</small>
      </li>)}
    </ol>
    {rest.length > 0 && <ol className="lb-list" start={podium.length + 1}>
      {rest.map((row) => <li key={row.studentUid} className={row.studentUid === meUid ? 'is-me' : ''}>
        <span className="lb-rank">{row.rank}</span>
        <span className="lb-avatar lb-avatar-sm" aria-hidden="true">{initial(row.name)}</span>
        <span className="lb-name"><strong>{label(row)}{row.studentUid === meUid && <em> (you)</em>}</strong><small>{row.tests} test{row.tests === 1 ? '' : 's'}</small></span>
        <span className="lb-bar" aria-hidden="true"><i style={{ width: `${row.average}%` }} /></span>
        <b className="lb-pct">{row.average}%</b>
      </li>)}
    </ol>}
    <p className="lb-foot">{total} student{total === 1 ? '' : 's'} sat a test this week{entries && total > rows.length ? ` · top ${rows.length} shown` : ''}.</p>
    {meUid && !inTop && mine && <p className="lb-mine">Your average this week: <b>{mine.average}%</b> across {mine.tests} test{mine.tests === 1 ? '' : 's'}. Keep practising to break into the top {rows.length}!</p>}
  </div>
}

// Students practising every day, longest live streak first.
export function StreakWall({ streaks, meUid, max = 10 }) {
  if (streaks === null) return <p className="pc-empty">Loading streaks…</p>
  const live = streaks.map((item) => ({ ...item, live: liveStreak(item) })).filter((item) => item.live > 0).sort((a, b) => b.live - a.live || b.best - a.best || String(a.name).localeCompare(String(b.name)))
  const legends = [...streaks].sort((a, b) => b.best - a.best).filter((item) => item.best >= 3).slice(0, 3)
  if (!live.length && !legends.length) return <div className="lb-empty lb-empty-streak"><Flame size={28} /><p>No one is on a streak yet. Answer one quiz a day to be the first on the wall!</p></div>
  return <div className="sw">
    {live.length > 0 ? <ul className="sw-grid">{live.slice(0, max).map((item, index) => <li key={item.id} className={`${item.id === meUid ? 'is-me' : ''}${index === 0 ? ' is-top' : ''}`}>
      <span className="sw-flame" aria-hidden="true"><Flame size={20} /></span>
      <span className="sw-days"><b>{item.live}</b><small>day{item.live === 1 ? '' : 's'}</small></span>
      <strong>{item.name}{item.id === meUid && <em> (you)</em>}</strong>
      {item.best > item.live && <small className="sw-best">Best {item.best}</small>}
    </li>)}</ul> : <p className="pc-empty">No live streaks today. Practise to light the first flame!</p>}
    {legends.length > 0 && <p className="sw-legends"><Trophy size={14} /> Longest streaks ever: {legends.map((item) => `${item.name} (${item.best} days)`).join(', ')}</p>}
  </div>
}
