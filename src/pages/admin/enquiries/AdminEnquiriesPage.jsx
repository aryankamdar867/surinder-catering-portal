import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, ClipboardList, FileText, Phone, Search, TriangleAlert, Users } from 'lucide-react'
import EmptyState from '@/components/feedback/EmptyState.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import { QuotationStatusBadge } from '@/components/quotation/QuotationDocument.jsx'
import Button from '@/components/ui/Button.jsx'
import Field from '@/components/ui/Field.jsx'
import { FilterChip } from '@/components/ui/FilterChips.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { eventTitle } from '@/constants/enquiry.js'
import { ENQUIRY_FILTERS } from '@/constants/quotation.js'
import { useAsync } from '@/hooks/useAsync.js'
import EnquiryStatusBadge from '@/pages/customer/enquiry/EnquiryStatusBadge.jsx'
import { listAllEnquiries } from '@/services/adminEnquiryService.js'
import { formatEventDate, todayInIndia } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatDate } from '@/utils/format.js'

function matches(enq, term) {
  if (!term) return true
  return [enq.enquiry_number, enq.contact_name, enq.contact_phone, enq.company_name, enq.event?.venue_name, enq.quotations[0]?.quotation_number]
    .some((v) => v?.toLowerCase().includes(term))
}

export default function AdminEnquiriesPage() {
  const { data: enquiries, error, loading, reload } = useAsync(listAllEnquiries)
  const [filter, setFilter] = useState('open')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const result = {}
    for (const [key, , statuses] of ENQUIRY_FILTERS) {
      result[key] = enquiries?.filter((e) => statuses.includes(e.status)).length ?? 0
    }
    return result
  }, [enquiries])

  const visible = useMemo(() => {
    if (!enquiries) return []
    const statuses = ENQUIRY_FILTERS.find(([key]) => key === filter)?.[2]
    const term = query.trim().toLowerCase()
    const list = enquiries.filter((e) => (!statuses || statuses.includes(e.status)) && matches(e, term))
    // Open work: soonest event first. Everything else: newest enquiry first (server order).
    if (filter === 'open' || filter === 'confirmed') {
      return [...list].sort((a, b) => (a.event?.event_date ?? '').localeCompare(b.event?.event_date ?? ''))
    }
    return list
  }, [enquiries, filter, query])

  if (loading && !enquiries) return <PageLoader label="Loading enquiries…" />
  if (error) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="Couldn't load enquiries"
        message={getErrorMessage(error)}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    )
  }

  const today = todayInIndia()

  return (
    <>
      <PageHeader
        eyebrow="Bookings"
        title="Enquiries"
        description={`${enquiries.length} ${enquiries.length === 1 ? 'enquiry' : 'enquiries'} · ${counts.open} need action`}
      />

      {enquiries.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No enquiries yet"
          message="When customers send an enquiry from their account, it will appear here."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
              {ENQUIRY_FILTERS.map(([key, label]) => (
                <FilterChip key={key} active={filter === key} onClick={() => setFilter(key)}>
                  {label} <span className="opacity-70">({counts[key]})</span>
                </FilterChip>
              ))}
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                All <span className="opacity-70">({enquiries.length})</span>
              </FilterChip>
            </div>
            <Field
              label="Search"
              type="search"
              className="lg:w-80"
              placeholder="Name, phone, venue or number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              trailing={<Search className="mr-2.5 size-4 text-ink-400" aria-hidden="true" />}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nothing here"
              message={query ? 'No enquiries match your search.' : 'No enquiries have this status.'}
              action={
                (query || filter !== 'all') && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setFilter('all')
                    }}
                  >
                    Show all enquiries
                  </Button>
                )
              }
            />
          ) : (
            <ul className="space-y-3" aria-label="Enquiries">
              {visible.map((enq) => {
                const quote = enq.quotations[0]
                const past = enq.event?.event_date && enq.event.event_date < today
                return (
                  <li key={enq.id}>
                    <Link
                      to={`/admin/enquiries/${enq.id}`}
                      className="group flex items-center gap-4 rounded-2xl border border-ivory-200 bg-white/80 p-4 shadow-card transition hover:border-forest-600 sm:p-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">{enq.contact_name}</span>
                          <span className="text-ink-400">·</span>
                          <span className="text-ink-700">{eventTitle(enq.event)}</span>
                          <EnquiryStatusBadge status={enq.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-ink-400">
                          {enq.enquiry_number} · received {formatDate(enq.submitted_at)}
                          {enq.company_name && ` · ${enq.company_name}`}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-500">
                          <span className={past ? 'inline-flex items-center gap-1.5 text-ink-400' : 'inline-flex items-center gap-1.5'}>
                            <CalendarDays className="size-4 text-ink-400" aria-hidden="true" />
                            {formatEventDate(enq.event?.event_date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="size-4 text-ink-400" aria-hidden="true" />
                            {enq.event?.guest_count?.toLocaleString('en-IN')} guests
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="size-4 text-ink-400" aria-hidden="true" />
                            {enq.contact_phone}
                          </span>
                          {quote && (
                            <span className="inline-flex items-center gap-1.5">
                              <FileText className="size-4 text-ink-400" aria-hidden="true" />
                              {quote.quotation_number}
                              <QuotationStatusBadge status={quote.status} />
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className="size-5 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </>
  )
}
