import { useEffect, useState } from 'react'
import { loadPublishedPapers } from '../../firebase/content'
import { describePaper } from './paperInfo'

// Shared by the library and the Premium Sources page: every published paper, normalised for display.
// `loading` clears after the first page so students see papers straight away; `complete` flips once all pages are in.
export function usePublishedPapers() {
  const [state, setState] = useState({ loading: true, complete: false, papers: [] })
  useEffect(() => {
    let cancelled = false
    loadPublishedPapers((items, done) => { if (!cancelled) setState({ loading: false, complete: done, papers: items.map(describePaper) }) })
      .catch(() => { if (!cancelled) setState((current) => ({ ...current, loading: false, complete: true })) })
    return () => { cancelled = true }
  }, [])
  return state
}
