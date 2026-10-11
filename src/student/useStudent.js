import { useEffect, useMemo, useState } from 'react'
import { subscribeAttempts, subscribeEnrollments } from '../firebase/student'
import { summarise } from './progress'

// Live enrolments and attempts for the signed-in student, plus the derived dashboard summary.
export function useStudentData(uid) {
  const [enrollments, setEnrollments] = useState(null)
  const [attempts, setAttempts] = useState(null)
  useEffect(() => {
    if (!uid) return undefined
    const stopEnrollments = subscribeEnrollments(uid, setEnrollments)
    const stopAttempts = subscribeAttempts(uid, setAttempts)
    return () => { stopEnrollments(); stopAttempts() }
  }, [uid])
  const ready = Boolean(uid) && enrollments !== null && attempts !== null
  const summary = useMemo(() => ready ? summarise(attempts, enrollments) : null, [ready, attempts, enrollments])
  return { ready, enrollments: enrollments || [], attempts: attempts || [], summary }
}
