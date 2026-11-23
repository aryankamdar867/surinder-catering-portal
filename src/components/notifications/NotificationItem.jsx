import { Check, Trash2 } from 'lucide-react'
import { notificationMeta } from '@/constants/notifications.js'
import { safeInternalLink } from '@/services/notificationService.js'
import { cn } from '@/utils/cn.js'
import { formatDate, formatRelativeTime } from '@/utils/format.js'

const iconTones = {
  forest: 'bg-forest-50 text-forest-700',
  gold: 'bg-gold-300/30 text-gold-600',
  burgundy: 'bg-burgundy-50 text-burgundy-700',
  neutral: 'bg-ivory-100 text-ink-500',
}

/**
 * One notification row. Clicking it calls `onOpen(notification, link)`; `link` is null
 * unless the stored link is a path inside this app.
 */
export default function NotificationItem({ notification: n, onOpen, onMarkRead, onDelete, compact = false }) {
  const { icon: Icon, tone } = notificationMeta(n.type)
  const unread = !n.read_at
  const link = safeInternalLink(n.link)

  return (
    <div className={cn('group relative flex gap-3 px-4 py-3.5 transition', unread ? 'bg-gold-300/10' : 'bg-transparent', 'hover:bg-ivory-100/70')}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', iconTones[tone])}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <button
        type="button"
        onClick={() => onOpen(n, link)}
        className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-forest-600"
      >
        <span className={cn('block text-sm text-ink-900', unread ? 'font-semibold' : 'font-medium')}>
          {unread && <span className="sr-only">Unread: </span>}
          {n.title}
        </span>
        {n.body && <span className={cn('mt-0.5 block text-sm text-ink-500', compact && 'line-clamp-2')}>{n.body}</span>}
        <time dateTime={n.created_at} title={formatDate(n.created_at)} className="mt-1 block text-xs text-ink-400">
          {formatRelativeTime(n.created_at)}
        </time>
      </button>
      <span className="relative z-10 flex shrink-0 items-start gap-1">
        {unread && onMarkRead && (
          <button
            type="button"
            onClick={() => onMarkRead(n)}
            className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-forest-700"
            aria-label={`Mark "${n.title}" as read`}
            title="Mark as read"
          >
            <Check className="size-4" aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(n)}
            className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-burgundy-600"
            aria-label={`Delete "${n.title}"`}
            title="Delete"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
        {unread && !onMarkRead && <span className="mt-1.5 size-2 rounded-full bg-burgundy-600" aria-hidden="true" />}
      </span>
    </div>
  )
}
