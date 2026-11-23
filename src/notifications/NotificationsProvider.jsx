import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext.js'
import {
  countUnread,
  deleteNotification,
  listNotifications,
  markAllRead as markAllReadRequest,
  markRead as markReadRequest,
  safeInternalLink,
  subscribeToNotifications,
} from '@/services/notificationService.js'
import { NotificationsContext } from './NotificationsContext.js'

const RECENT_LIMIT = 20
const FOCUS_REFRESH_MS = 30_000

/**
 * Loads the user's latest notifications and unread count, and keeps them current:
 * Supabase Realtime pushes new and updated rows, and the list is refreshed when the
 * tab regains focus (in case the live connection dropped). Mounted once per layout.
 */
export default function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const [state, setState] = useState({ userId: null, recent: [], unread: 0, error: null })
  const lastLoad = useRef(0)

  const refresh = useCallback(async () => {
    if (!userId) return
    lastLoad.current = Date.now()
    try {
      const [recent, unread] = await Promise.all([listNotifications({ limit: RECENT_LIMIT }), countUnread()])
      setState({ userId, recent, unread, error: null })
    } catch (error) {
      setState((prev) => ({ ...prev, userId, error }))
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    refresh()

    const unsubscribe = subscribeToNotifications(userId, {
      // Anything created between the first load and the feed going live.
      onReady: refresh,
      onInsert: (row) => {
        setState((prev) =>
          prev.recent.some((n) => n.id === row.id)
            ? prev
            : { ...prev, recent: [row, ...prev.recent].slice(0, RECENT_LIMIT), unread: prev.unread + (row.read_at ? 0 : 1) },
        )
        const link = safeInternalLink(row.link)
        toast(row.title, {
          description: row.body ?? undefined,
          action: link ? { label: 'View', onClick: () => navigate(link) } : undefined,
        })
      },
      onUpdate: (row) => {
        setState((prev) => {
          const old = prev.recent.find((n) => n.id === row.id)
          const becameRead = old ? !old.read_at && row.read_at : false
          return {
            ...prev,
            recent: prev.recent.map((n) => (n.id === row.id ? { ...n, ...row } : n)),
            unread: Math.max(0, prev.unread - (becameRead ? 1 : 0)),
          }
        })
      },
    })

    const onFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > FOCUS_REFRESH_MS) refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [userId, refresh, navigate])

  const markRead = useCallback(async (id) => {
    setState((prev) => {
      const target = prev.recent.find((n) => n.id === id)
      const wasUnread = Boolean(target && !target.read_at)
      return {
        ...prev,
        recent: prev.recent.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
        unread: Math.max(0, prev.unread - (wasUnread ? 1 : 0)),
      }
    })
    try {
      await markReadRequest(id)
    } finally {
      refresh() // also corrects the count for rows outside the recent list
    }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setState((prev) => ({ ...prev, recent: prev.recent.map((n) => (n.read_at ? n : { ...n, read_at: now })), unread: 0 }))
    try {
      await markAllReadRequest()
    } finally {
      refresh()
    }
  }, [refresh])

  const remove = useCallback(async (id) => {
    setState((prev) => {
      const target = prev.recent.find((n) => n.id === id)
      return {
        ...prev,
        recent: prev.recent.filter((n) => n.id !== id),
        unread: Math.max(0, prev.unread - (target && !target.read_at ? 1 : 0)),
      }
    })
    try {
      await deleteNotification(id)
    } finally {
      refresh()
    }
  }, [refresh])

  const current = state.userId === userId
  const value = useMemo(
    () => ({
      recent: current ? state.recent : [],
      unread: current ? state.unread : 0,
      loading: !current,
      error: current ? state.error : null,
      markRead,
      markAllRead,
      remove,
      refresh,
    }),
    [current, state, markRead, markAllRead, remove, refresh],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
