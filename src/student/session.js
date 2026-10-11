import { useSyncExternalStore } from 'react'
import { getSession, subscribeSession } from '../firebase/student'

// { status: 'loading' | 'signed-out' | 'ready', user, profile }
export const useSession = () => useSyncExternalStore(subscribeSession, getSession)

// Sends signed-out visitors to the login page, then back here afterwards.
export const loginUrl = (next = window.location.pathname + window.location.search) => `/login?next=${encodeURIComponent(next)}`
export const safeNext = (value) => value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
