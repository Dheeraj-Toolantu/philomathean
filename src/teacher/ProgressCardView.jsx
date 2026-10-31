import { ArrowDownRight, ArrowRight, ArrowUpRight, School } from 'lucide-react'
import { formatDay, progressCard } from './marks'
import './teacher.css'

const tone = (value) => value >= 75 ? 'good' : value >= 50 ? 'mid' : 'low'

export function Change({ value }) {
  if (value === null || value === undefined) return <span className="pc-change">—</span>
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight
  return <span className={`pc-change ${value > 0 ? 'up' : value < 0 ? 'down' : ''}`}><Icon size={14} aria-hidden="true" />{value > 0 ? '+' : ''}{value} pts</span>
}

// Two bars per subject: Philomathean test average vs the school's score for the same period.
function VsSchoolChart({ rows }) {
  return <div className="pc-vs">
    <div className="pc-legend" aria-hidden="true"><span><i className="pc-key-test" /> Philomathean tests</span><span><i className="pc-key-school" /> School score</span></div>
    {rows.map((row) => <div className="pc-vs-row" key={row.subject}>
      <strong>{row.subject}</strong>
      <div className="pc-bars">
        <div className="pc-bar-line"><span className="pc-bar pc-bar-test" style={{ width: `${row.test}%` }} /><b>{row.test}%</b></div>
        <div className="pc-bar-line"><span className="pc-bar pc-bar-school" style={{ width: `${row.school}%` }} /><b>{row.school}%</b></div>
      </div>
      <Change value={row.gap} />
    </div>)}
  </div>
}

// The progress card shown to the student on their dashboard and to teachers for each student.
export function ProgressCardView({ marks, emptyText = 'No test marks have been recorded yet.' }) {
  if (!marks.length) return <p className="pc-empty">{emptyText}</p>
  const card = progressCard(marks)
  const { overall } = card
  return <div className="pc">
    <div className="pc-summary">
      <div className="pc-tile"><small>Before</small><strong className={`pc-${tone(overall.before)}`}>{overall.before}%</strong><span>{overall.first.testTitle} · {formatDay(overall.first.testDate)}</span></div>
      <div className="pc-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
      <div className="pc-tile"><small>After (latest)</small><strong className={`pc-${tone(overall.after)}`}>{overall.after}%</strong><span>{overall.latest.testTitle} · {formatDay(overall.latest.testDate)}</span></div>
      <div className="pc-tile pc-tile-soft"><small>Change</small><strong><Change value={overall.change} /></strong><span>{card.count} test{card.count === 1 ? '' : 's'} · {card.average}% average</span></div>
    </div>

    <h3 className="pc-heading">Before and after, by subject</h3>
    <div className="pc-table-wrap"><table className="pc-table">
      <thead><tr><th>Subject</th><th>Tests</th><th>Before</th><th>After</th><th>Change</th><th>Average</th></tr></thead>
      <tbody>{card.subjects.map((row) => <tr key={row.subject}><td>{row.subject}</td><td>{row.count}</td><td>{row.before}%</td><td>{row.after}%</td><td><Change value={row.change} /></td><td>{row.average}%</td></tr>)}</tbody>
    </table></div>

    <h3 className="pc-heading"><School size={16} aria-hidden="true" /> Test score vs school score</h3>
    {card.vsSchool.length ? <VsSchoolChart rows={card.vsSchool} /> : <p className="pc-empty">School scores haven’t been added yet. Teachers can add the school’s percentage alongside any test.</p>}

    <h3 className="pc-heading">All tests</h3>
    <div className="pc-table-wrap"><table className="pc-table">
      <thead><tr><th>Date</th><th>Test</th><th>Subject</th><th>Marks</th><th>%</th><th>School</th></tr></thead>
      <tbody>{[...card.timeline].reverse().map((mark) => <tr key={mark.id}><td>{formatDay(mark.testDate)}</td><td>{mark.testTitle}{mark.note ? <small>{mark.note}</small> : null}</td><td>{mark.subject}</td><td>{mark.score} / {mark.maxScore}</td><td><span className={`pc-pill pc-${tone(mark.pct)}`}>{mark.pct}%</span></td><td>{mark.schoolScore ?? '—'}{mark.schoolScore !== null && mark.schoolScore !== undefined ? '%' : ''}</td></tr>)}</tbody>
    </table></div>
  </div>
}
