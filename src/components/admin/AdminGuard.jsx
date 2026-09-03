import { useEffect, useState } from 'react'
import { subscribeToAdmin } from '../../firebase/auth'

export default function AdminGuard({ children, onUnauthenticated }) {
  const [state, setState] = useState({ loading: true, user: null })
  useEffect(() => subscribeToAdmin((user) => setState({ loading: false, user })), [])
  if (state.loading) return <main className="admin-loading"><p>Checking administrator access...</p></main>
  if (!state.user) return <RedirectToLogin onUnauthenticated={onUnauthenticated} />
  return children(state.user)
}

function RedirectToLogin({ onUnauthenticated }) {
  useEffect(() => { onUnauthenticated?.() }, [onUnauthenticated])
  return null
}
