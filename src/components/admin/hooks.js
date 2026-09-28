import { useCallback, useEffect, useRef, useState } from 'react'

// Cursor-based pagination: reads only one page of documents per request, gets the total from a
// server-side count (no documents downloaded) and caches visited pages so going back is free.
export function usePagedList(fetchPage, fetchCount, filters, pageSize) {
  const key = JSON.stringify([filters, pageSize])
  const cache = useRef({ key: null, pages: [], total: null })
  const [pageState, setPageState] = useState({ key, page: 0 })
  const [reloadToken, setReloadToken] = useState(0)
  const [view, setView] = useState({ key: null, page: -1, token: -1, items: [], total: null, error: false })
  const page = pageState.key === key ? pageState.page : 0

  useEffect(() => {
    let active = true
    const [activeFilters, size] = JSON.parse(key)
    if (cache.current.key !== key) cache.current = { key, pages: [], total: null }
    const store = cache.current
    const load = async () => {
      // Pages are visited in order, so any missing earlier page (after a reload) is refetched to rebuild its cursor.
      for (let index = 0; index <= page; index += 1) {
        if (!store.pages[index]) store.pages[index] = await fetchPage({ filters: activeFilters, pageSize: size, cursor: index ? store.pages[index - 1].cursor : undefined })
      }
      // The total is a nice-to-have: if the count request fails, the page still shows and paging falls back to page fullness.
      if (store.total == null) store.total = await fetchCount(activeFilters).catch(() => null)
      return store.pages[page]
    }
    load().then((result) => {
      if (!active) return
      if (!result.items.length && page > 0) { setPageState({ key, page: page - 1 }); return }
      setView({ key, page, token: reloadToken, items: result.items, total: store.total, error: false })
    }).catch(() => { if (active) setView({ key, page, token: reloadToken, items: [], total: null, error: true }) })
    return () => { active = false }
  }, [key, page, reloadToken, fetchPage, fetchCount])

  const loading = view.key !== key || view.page !== page || view.token !== reloadToken
  const totalPages = view.total == null ? null : Math.max(1, Math.ceil(view.total / pageSize))
  return {
    items: view.items,
    total: view.total,
    error: view.error,
    loading,
    page,
    pageSize,
    totalPages,
    hasNext: totalPages != null ? page < totalPages - 1 : view.items.length === pageSize,
    goTo: (next) => setPageState({ key, page: Math.max(0, next) }),
    reload: () => { cache.current = { key: null, pages: [], total: null }; setReloadToken((token) => token + 1) },
  }
}

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const notify = useCallback((tone, message) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, tone, message }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200)
  }, [])
  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  return { toasts, notify, dismiss }
}
