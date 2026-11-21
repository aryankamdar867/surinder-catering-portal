import { Link } from 'react-router-dom'
import { CalendarDays, CalendarPlus, ChevronRight, ClipboardList, MapPin, TriangleAlert, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext.js'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Button from '@/components/ui/Button.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { eventTitle } from '@/constants/enquiry.js'
import { useAsync } from '@/hooks/useAsync.js'
import { listMyEnquiries } from '@/services/enquiryService.js'
import { formatEventDate } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency, formatDate } from '@/utils/format.js'
import EnquiryStatusBadge from './EnquiryStatusBadge.jsx'

export default function EnquiriesPage() {
  const { user } = useAuth()
  const { data: enquiries, error, loading, reload } = useAsync(() => listMyEnquiries(user.id), [user.id])

  if (loading && !enquiries) return <PageLoader label="Loading your enquiries…" />
  if (error) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="Couldn't load your enquiries"
        message={getErrorMessage(error)}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title="Enquiries"
        description="Track your event requests and their progress."
        actions={
          <Button to="/account/enquiries/new">
            <CalendarPlus className="size-4" aria-hidden="true" />
            Plan an event
          </Button>
        }
      />

      {enquiries.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No enquiries yet"
          message="Tell us about your event and we'll prepare a quotation for you."
          action={<Button to="/account/enquiries/new">Plan an event</Button>}
        />
      ) : (
        <ul className="space-y-4" aria-label="Your enquiries">
          {enquiries.map((enq) => (
            <li key={enq.id}>
              <Link
                to={`/account/enquiries/${enq.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-ivory-200 bg-white/80 p-5 shadow-card transition hover:border-forest-600"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-ink-900">{eventTitle(enq.event)}</span>
                    <EnquiryStatusBadge status={enq.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {enq.enquiry_number} · sent {formatDate(enq.submitted_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-ink-400" aria-hidden="true" />
                      {formatEventDate(enq.event?.event_date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4 text-ink-400" aria-hidden="true" />
                      {enq.event?.guest_count?.toLocaleString('en-IN')} guests
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <MapPin className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
                      <span className="truncate">{enq.event?.venue_name}</span>
                    </span>
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  {Number(enq.estimated_menu_total) > 0 && (
                    <>
                      <p className="text-xs text-ink-400">Menu estimate</p>
                      <p className="font-semibold text-forest-800">{formatCurrency(enq.estimated_menu_total)}</p>
                    </>
                  )}
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
