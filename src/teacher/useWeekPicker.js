import { useMemo, useState } from 'react'
import { shiftWeek, todayISO, weekOf } from './marks'

// Week navigation for the leaderboard. Opens on the current week when it has tests, otherwise the latest week that does.
export function useWeekPicker(dates) {
  const current = weekOf(todayISO()).start
  const weeks = useMemo(() => [...new Set(dates.filter(Boolean).map((date) => weekOf(date).start))].sort().reverse(), [dates])
  const initial = weeks.includes(current) || !weeks.length ? current : weeks.find((week) => week <= current) || weeks[0]
  const [start, setStart] = useState(null)
  const active = start || initial
  const earliest = weeks[weeks.length - 1] || current
  const latest = weeks[0] > current ? weeks[0] : current
  return {
    week: weekOf(active),
    isCurrent: active === current,
    canPrev: active > earliest, canNext: active < latest,
    prev: () => setStart(shiftWeek(active, -1)), next: () => setStart(shiftWeek(active, 1)),
  }
}

