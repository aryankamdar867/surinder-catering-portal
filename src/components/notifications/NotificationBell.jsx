import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useNotifications } from '@/notifications/NotificationsContext.js'
import { cn } from '@/utils/cn.js'
import { getErrorMessage } from '@/utils/errors.js'
import NotificationItem from './NotificationItem.jsx'

const PANEL_LIMIT = 8

/**
 * Bell with an unread badge and a dropdown of the latest notifications.
 * `allPath` is the full notifications page for this area (/account/… or /admin/…).
 * `tone` "dark" is for the forest-green admin sidebar; `align` picks the panel side.
 */
export default function NotificationBell({ allPath, tone = 'light', align = 'right', className }) {
  const { recent, unread, loading, error, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const panelId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(n, link) {
    setOpen(false)
    if (!n.read_at) markRead(n.id).catch(() => {})
    if (link) navigate(link)
  }

  async function readAll() {
    try {
      await markAllRead()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const label = unread ? `Notifications, ${unread} unread` : 'Notifications'
  const items = recent.slice(0, PANEL_LIMIT)

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'relative grid size-10 place-items-center rounded-xl transition',
          tone === 'dark' ? 'text-ivory-50 hover:bg-white/10' : 'text-ink-700 hover:bg-ivory-100 hover:text-forest-800',
        )}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-burgundy-600 px-1 text-[0.65rem] font-bold text-ivory-50 ring-2',
              tone === 'dark' ? 'ring-forest-900' : 'ring-ivory-50',
            )}
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className={cn(
            'absolute z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ivory-200 bg-white text-left shadow-xl',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-ivory-200 px-4 py-3">
            <h2 className="font-sans text-sm font-semibold tracking-normal text-ink-900">
              Notifications{unread > 0 && <span className="ml-1.5 font-normal text-ink-400">{unread} unread</span>}
            </h2>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900">
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-ink-400">Loading…</p>
            ) : error && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-burgundy-700">{getErrorMessage(error)}</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellOff className="mx-auto size-6 text-ink-300" aria-hidden="true" />
                <p className="mt-2 text-sm text-ink-500">You're all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ivory-200">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotificationItem notification={n} onOpen={openItem} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to={allPath}
            onClick={() => setOpen(false)}
            className="block border-t border-ivory-200 px-4 py-3 text-center text-sm font-semibold text-forest-700 hover:bg-ivory-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
