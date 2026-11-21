import { useCallback, useEffect, useState } from 'react'

/**
 * Runs `load` on mount and whenever `deps` change (or `reload()` is called).
 * Returns { data, error, loading, reload, setData }. `setData` allows local updates after a save.
 *
 * The result is stored with the request key it belongs to, so `loading` is derived
 * rather than set inside the effect (same pattern as AuthProvider's profile state).
 * While reloading, the previous `data` stays available so lists don't flash empty.
 */
export function useAsync(load, deps = []) {
  const [reloadCount, setReloadCount] = useState(0)
  const requestKey = JSON.stringify([...deps, reloadCount])
  const [result, setResult] = useState({ key: null, data: undefined, error: null })

  useEffect(() => {
    let active = true
    load().then(
      (data) => active && setResult({ key: requestKey, data, error: null }),
      (error) => active && setResult((prev) => ({ key: requestKey, data: prev.data, error })),
    )
    return () => {
      active = false
    }
    // `load` is intentionally excluded: callers pass inline functions and list their inputs in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])
  const setData = useCallback((update) => {
    setResult((prev) => ({ ...prev, data: typeof update === 'function' ? update(prev.data) : update }))
  }, [])

  const current = result.key === requestKey
  return {
    data: result.data,
    error: current ? result.error : null,
    loading: !current,
    reload,
    setData,
  }
}
