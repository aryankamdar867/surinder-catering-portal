import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button.jsx'
import Card, { CardHeader } from '@/components/ui/Card.jsx'
import { useNotifications } from '@/notifications/NotificationsContext.js'
import NotificationItem from './NotificationItem.jsx'

/** Latest few notifications for a dashboard, with a link to the full list. */
export default function RecentNotificationsCard({ allPath, limit = 4, className }) {
  const { recent, unread, loading, markRead } = useNotifications()
  const navigate = useNavigate()
  const items = recent.slice(0, limit)

  const open = (n, link) => {
    if (!n.read_at) markRead(n.id).catch(() => {})
    if (link) navigate(link)
  }

  return (
    <Card className={className}>
      <CardHeader
        title="Latest notifications"
        description={loading ? 'Loading…' : unread ? `${unread} unread` : 'All caught up'}
        action={
          <Button to={allPath} variant="ghost" size="sm">
            View all
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      {!loading && items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-500 sm:px-6">No notifications yet. Updates about enquiries and quotations will appear here.</p>
      ) : (
        <ul className="divide-y divide-ivory-200">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} onOpen={open} compact />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
