import { useEffect, useMemo, useState } from 'react'
import { subscribeStreakWall } from '../firebase/student'
import { subscribeLeaderboards, subscribeStudentMarks } from '../firebase/teaching'
import { weeklyLeaderboard } from '../teacher/marks'
import { LeaderboardView, StreakWall, WeekPicker } from '../teacher/Leaderboard'
import { useWeekPicker } from '../teacher/useWeekPicker'
import { StreakCard } from './StreakCard'

// Dashboard tab: the weekly test leaderboard (top 10 published by teachers) and the daily practice streak wall.
export function LeaderboardPanel({ user, summary, practiseHref }) {
  const [boards, setBoards] = useState(null)
  const [marks, setMarks] = useState([])
  const [streaks, setStreaks] = useState(null)
  useEffect(() => subscribeLeaderboards(setBoards), [])
  useEffect(() => subscribeStudentMarks(user.uid, setMarks), [user.uid])
  useEffect(() => subscribeStreakWall(setStreaks), [])
  const dates = useMemo(() => (boards || []).map((board) => board.weekStart), [boards])
  const picker = useWeekPicker(dates)
  const board = (boards || []).find((item) => item.weekStart === picker.week.start)
  const mine = weeklyLeaderboard(marks, picker.week.start)[0] || null
  return <>
    <div className="st-panel-head"><div><h1>Leaderboard</h1><p>This week’s top test performers, and the students who practise every day.</p></div></div>
    <div className="st-card">
      <div className="st-card-head"><h2>Weekly test leaderboard</h2><WeekPicker {...picker} /></div>
      {boards === null ? <p className="st-muted-box">Loading the leaderboard…</p>
        : <LeaderboardView entries={board?.entries || []} participants={board?.participants || 0} week={picker.week} meUid={user.uid} mine={mine}
          emptyText={mine ? 'The leaderboard for this week is being prepared.' : 'No test results for this week yet. Results appear as soon as your teachers enter marks.'} />}
    </div>
    <div className="st-grid-2 st-grid-streak">
      <StreakCard info={summary.streakInfo} practiseHref={practiseHref} />
      <div className="st-card"><div className="st-card-head"><h2>Streak wall</h2><small>Practising every day</small></div><StreakWall streaks={streaks} meUid={user.uid} /></div>
    </div>
  </>
}
