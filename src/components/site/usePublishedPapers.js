import { useEffect, useState } from 'react'
import { subscribeToPublishedPapers } from '../../firebase/content'
import { describePaper } from './paperInfo'

// Shared by the library and the Premium Sources page: live list of published papers, normalised for display.
export function usePublishedPapers() {
  const [state, setState] = useState({ loading: true, papers: [] })
  useEffect(() => subscribeToPublishedPapers((items) => setState({ loading: false, papers: items.map(describePaper) }), () => setState({ loading: false, papers: [] })), [])
  return state
}

