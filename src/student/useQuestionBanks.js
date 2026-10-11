import { useEffect, useState } from 'react'
import { loadManagedBanks } from '../firebase/questionBanks'
import { BANKS } from './questionBank'
import { mergeBanks } from './questionTools'

// Loaded once per page view and shared by every component. If Firestore can't be read (offline, rules not
// deployed) students still get the built-in questions rather than an empty site.
let cache = null
const load = () => {
  cache ??= loadManagedBanks().then((managed) => mergeBanks(managed)).catch((error) => { console.error('Question banks could not be loaded; using built-in questions.', error); return BANKS })
  return cache
}

export function useQuestionBanks() {
  const [banks, setBanks] = useState(null)
  useEffect(() => {
    let active = true
    load().then((result) => { if (active) setBanks(result) })
    return () => { active = false }
  }, [])
  return { banks: banks || BANKS, loading: banks === null }
}
