import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOff, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import Alert from '@/components/feedback/Alert.jsx'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import NotificationItem from '@/components/notifications/NotificationItem.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import { FilterChip } from '@/components/ui/FilterChips.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { useNotifications } from '@/notifications/NotificationsContext.js'
import { listNotifications } from '@/services/notificationService.js'
import { getErrorMessage } from '@/utils/errors.js'

const PAGE_SIZE = 20

/**
 * Full notification list for the signed-in user (customer and owner areas share it).
 * The first page comes from the live provider; older pages are fetched on demand.
 */
export default function NotificationsPage() {
  const { recent, unread, loading, error, markRead, markAllRead, remove, refresh } = useNotifications()
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const [older, setOlder] = useState({ key: '', items: [], done: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const navigate = useNavigate()

  // "Load more" results belong to the filter they were loaded for.
  const olderItems = older.key === filter ? older.items : []
  const firstPage = filter === 'unread' ? recent.filter((n) => !n.read_at) : recent
  const seen = new Set(firstPage.map((n) => n.id))
  const items = [...firstPage, ...olderItems.filter((n) => !seen.has(n.id))]
  const mayHaveMore = !(older.key === filter && older.done) && (filter === 'unread' ? unread > items.length : recent.length >= PAGE_SIZE)

  async function loadMore() {
    const last = items.at(-1)
    if (!last) return
    setLoadingMore(true)
    try {
      const page = await listNotifications({ unreadOnly: filter === 'unread', limit: PAGE_SIZE, before: last.created_at })
      setOlder((prev) => ({
        key: filter,
        items: [...(prev.key === filter ? prev.items : []), ...page],
        done: page.length < PAGE_SIZE,
      }))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }

  const patchOlder = (fn) => setOlder((prev) => ({ ...prev, items: fn(prev.items) }))

  async function handle(action) {
    try {
      await action()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const onMarkRead = (n) =>
    handle(async () => {
      patchOlder((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      await markRead(n.id)
    })
  const onDelete = (n) =>
    handle(async () => {
      patchOlder((list) => list.filter((x) => x.id !== n.id))
      await remove(n.id)
    })
  const onOpen = (n, link) => {
    if (!n.read_at) onMarkRead(n)
    if (link) navigate(link)
  }
  const onMarkAll = () =>
    handle(async () => {
      patchOlder((list) => list.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })))
      await markAllRead()
    })

  if (loading) return <PageLoader label="Loading notifications…" />

  return (
    <>
      <PageHeader
        eyebrow="Updates"
        title="Notifications"
        description="Enquiry updates, quotations and replies, newest first."
        actions={
          unread > 0 && (
            <Button variant="secondary" size="sm" onClick={onMarkAll}>
              <CheckCheck className="size-4" aria-hidden="true" />
              Mark all as read
            </Button>
          )
        }
      />

      <div role="group" aria-label="Show" className="mb-5 flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        <FilterChip active={filter === 'unread'} onClick={() => setFilter('unread')}>
          Unread{unread > 0 ? ` (${unread})` : ''}
        </FilterChip>
      </div>

      {error && (
        <Alert tone="error" className="mb-5" title="Couldn't load notifications">
          {getErrorMessage(error)}{' '}
          <button type="button" className="font-semibold underline" onClick={refresh}>
            Try again
          </button>
        </Alert>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
          message={
            filter === 'unread'
              ? 'There are no unread notifications.'
              : "We'll let you know here when there's news about your enquiries and quotations."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ivory-200">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} onOpen={onOpen} onMarkRead={onMarkRead} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length > 0 && mayHaveMore && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
            Load older notifications
          </Button>
        </div>
      )}
    </>
  )
}
