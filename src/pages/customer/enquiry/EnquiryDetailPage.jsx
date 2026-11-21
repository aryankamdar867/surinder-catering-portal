import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Ban, FileQuestion, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import DietMark from '@/components/catalogue/DietMark.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { QUANTITY_UNITS } from '@/constants/catalogue.js'
import { BUDGET_FLEXIBILITY, CANCELLABLE_STATUSES, ENQUIRY_STATUS, SERVICE_TYPES, eventTitle } from '@/constants/enquiry.js'
import { useAsync } from '@/hooks/useAsync.js'
import { cancelEnquiry, getEnquiry } from '@/services/enquiryService.js'
import { cn } from '@/utils/cn.js'
import { formatEventDate, formatTime } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { priceLabel } from '@/utils/catalogue.js'
import { formatCurrency } from '@/utils/format.js'
import EnquiryStatusBadge from './EnquiryStatusBadge.jsx'
import { DetailList } from './ReviewStep.jsx'

const timestamp = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function EnquiryDetailPage() {
  const { id } = useParams()
  const { data: enquiry, error, loading, reload, setData } = useAsync(() => getEnquiry(id), [id])
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (loading) return <PageLoader label="Loading enquiry…" />
  if (error) {
    const missing = error.code === 'PGRST116'
    return (
      <StatusScreen
        icon={missing ? FileQuestion : TriangleAlert}
        tone={missing ? 'neutral' : 'error'}
        title={missing ? 'Enquiry not found' : "Couldn't load this enquiry"}
        message={missing ? "It doesn't exist or isn't linked to your account." : getErrorMessage(error)}
        actions={
          <>
            {!missing && <Button onClick={reload}>Try again</Button>}
            <Button to="/account/enquiries" variant="secondary">
              My enquiries
            </Button>
          </>
        }
      />
    )
  }

  const e = enquiry.event
  const status = ENQUIRY_STATUS[enquiry.status]
  const canCancel = CANCELLABLE_STATUSES.includes(enquiry.status)

  async function doCancel() {
    setCancelling(true)
    try {
      await cancelEnquiry(enquiry.id)
      toast.success(`Enquiry ${enquiry.enquiry_number} was cancelled.`)
      setConfirmCancel(false)
      setData(await getEnquiry(enquiry.id))
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConfirmCancel(false)
      reload()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <Button to="/account/enquiries" variant="ghost" size="sm" className="-ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden="true" />
        My enquiries
      </Button>
      <PageHeader
        eyebrow={enquiry.enquiry_number}
        title={eventTitle(e)}
        description={`${formatEventDate(e?.event_date)} · ${e?.guest_count?.toLocaleString('en-IN')} guests`}
        actions={
          canCancel && (
            <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel enquiry
            </Button>
          )
        }
      />

      <Alert tone={['cancelled', 'declined'].includes(enquiry.status) ? 'warning' : 'info'} className="mb-6">
        <span className="mr-2 inline-flex align-middle">
          <EnquiryStatusBadge status={enquiry.status} />
        </span>
        {status?.description}
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Event details" />
            <CardBody>
              <DetailList
                items={[
                  ['Date', `${formatEventDate(e?.event_date)}${e?.event_time ? ` · ${formatTime(e.event_time)}` : ''}`],
                  ['Guests', e?.guest_count?.toLocaleString('en-IN')],
                  ['Service', SERVICE_TYPES[e?.service_type]?.label],
                  ['Cuisines', e?.cuisine_preferences?.join(', ')],
                  ['Venue', [e?.venue_name, e?.venue_address].filter(Boolean).join('\n'), true],
                  ['Dietary requirements', e?.dietary_requirements, true],
                  ['Special instructions', e?.special_instructions, true],
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Menu"
              description={enquiry.menu.length ? 'Prices as at the time you sent this enquiry.' : undefined}
            />
            <CardBody>
              {enquiry.menu.length === 0 ? (
                <p className="text-sm text-ink-500">No dishes selected – our team will suggest a menu in your quotation.</p>
              ) : (
                <>
                  <ul className="divide-y divide-ivory-200">
                    {enquiry.menu.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
                        <DietMark labels={m.dietary_labels} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-ink-900">{m.dish_name}</span>
                          {m.tier === 'premium' && <Badge tone="gold" className="ml-2">Premium</Badge>}
                          <span className="block text-xs text-ink-400">
                            {m.category_name} · {m.cuisine_name}
                            {m.source === 'ai' && ' · Suggested'}
                          </span>
                        </span>
                        <span className="text-ink-500">
                          {Number(m.quantity).toLocaleString('en-IN')} {QUANTITY_UNITS[m.pricing_unit] ?? ''} ×{' '}
                          {priceLabel(m.unit_price, m.pricing_unit)}
                        </span>
                        <span className="w-28 text-right font-semibold text-ink-900">
                          {m.line_total === null ? 'On request' : formatCurrency(m.line_total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex justify-between border-t border-ivory-200 pt-4 text-sm">
                    <span className="font-medium text-ink-700">Estimated menu total</span>
                    <span className="text-lg font-semibold text-forest-800">{formatCurrency(enquiry.estimated_menu_total)}</span>
                  </p>
                  {enquiry.menu.some((m) => m.unit_price === null) && (
                    <p className="mt-1 text-xs text-ink-500">Dishes priced on request aren't included in this estimate.</p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">Final pricing, service charges and taxes will be in your quotation.</p>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact & budget" />
            <CardBody>
              <DetailList
                items={[
                  ['Contact', enquiry.contact_name],
                  ['Phone', enquiry.contact_phone],
                  ['Email', enquiry.contact_email],
                  ['Company', enquiry.company_name],
                  ['GST number', enquiry.gst_number],
                  ['Billing address', enquiry.address, true],
                  ['Total budget', enquiry.total_budget !== null ? formatCurrency(enquiry.total_budget) : null],
                  ['Per-person budget', enquiry.per_person_budget !== null ? formatCurrency(enquiry.per_person_budget) : null],
                  ['Budget flexibility', BUDGET_FLEXIBILITY[enquiry.budget_flexibility]?.label],
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-24 lg:self-start">
          <CardHeader title="Progress" />
          <CardBody>
            <ol className="relative space-y-5 border-l border-ivory-300 pl-5" aria-label="Status history">
              {enquiry.history.map((h, i) => {
                const latest = i === enquiry.history.length - 1
                return (
                  <li key={h.id} className="relative">
                    <span
                      className={cn(
                        'absolute -left-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-white',
                        latest ? 'bg-forest-600' : 'bg-ivory-300',
                      )}
                      aria-hidden="true"
                    />
                    <p className={cn('text-sm font-semibold', latest ? 'text-forest-800' : 'text-ink-700')}>
                      {ENQUIRY_STATUS[h.to_status]?.label ?? h.to_status}
                    </p>
                    <p className="text-xs text-ink-400">{timestamp.format(new Date(h.created_at))}</p>
                  </li>
                )
              })}
            </ol>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel ${enquiry.enquiry_number}?`}
        message="We'll stop working on this enquiry. You can always send a new one."
        confirmLabel="Cancel enquiry"
        cancelLabel="Keep enquiry"
        loading={cancelling}
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  )
}
