import { useEffect, useMemo, useRef, useState } from 'react'
import { auth } from '../firebase/config'
import { publishStreak, subscribeAttempts, subscribeEnrollments } from '../firebase/student'
import { shortName } from '../teacher/marks'
import { summarise } from './progress'

// Live enrolments and attempts for the signed-in student, plus the derived dashboard summary.
// Also keeps the student's entry on the streak wall up to date whenever their practice history changes.
export function useStudentData(uid) {
  const [enrollments, setEnrollments] = useState(null)
  const [attempts, setAttempts] = useState(null)
  const published = useRef('')
  useEffect(() => {
    if (!uid) return undefined
    const stopEnrollments = subscribeEnrollments(uid, setEnrollments)
    const stopAttempts = subscribeAttempts(uid, setAttempts)
    return () => { stopEnrollments(); stopAttempts() }
  }, [uid])
  const ready = Boolean(uid) && enrollments !== null && attempts !== null
  const summary = useMemo(() => ready ? summarise(attempts, enrollments) : null, [ready, attempts, enrollments])

  const streak = summary?.streakInfo
  useEffect(() => {
    if (!uid || !streak || !streak.lastDay) return
    const key = `${uid}|${streak.current}|${streak.best}|${streak.lastDay}`
    if (published.current === key) return
    published.current = key
    publishStreak(uid, shortName(auth.currentUser?.displayName || 'Student'), streak).catch(() => { published.current = '' })
  }, [uid, streak])

  return { ready, enrollments: enrollments || [], attempts: attempts || [], summary }
}
