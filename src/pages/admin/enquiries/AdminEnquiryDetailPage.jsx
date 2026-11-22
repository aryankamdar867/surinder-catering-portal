import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileQuestion, FilePlus2, FileText, Mail, Phone, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import DietMark from '@/components/catalogue/DietMark.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import { QuotationStatusBadge } from '@/components/quotation/QuotationDocument.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { QUANTITY_UNITS } from '@/constants/catalogue.js'
import { BUDGET_FLEXIBILITY, ENQUIRY_STATUS, SERVICE_TYPES, eventTitle } from '@/constants/enquiry.js'
import { ENQUIRY_ACTIONS, ENQUIRY_ACTION_COPY } from '@/constants/quotation.js'
import { useAsync } from '@/hooks/useAsync.js'
import EnquiryStatusBadge from '@/pages/customer/enquiry/EnquiryStatusBadge.jsx'
import { DetailList } from '@/pages/customer/enquiry/ReviewStep.jsx'
import { getAdminEnquiry, setEnquiryStatus } from '@/services/adminEnquiryService.js'
import { createQuotation } from '@/services/quotationService.js'
import { priceLabel } from '@/utils/catalogue.js'
import { cn } from '@/utils/cn.js'
import { formatEventDate, formatTime, todayInIndia } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency, formatDate } from '@/utils/format.js'
import { isExpired } from '@/utils/quotation.js'
import AdminNotes from './AdminNotes.jsx'

const timestamp = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const QUOTABLE = ['submitted', 'under_review']

function QuotationCard({ enquiry, onCreate, creating }) {
  const quote = enquiry.quotations[0]

  if (!quote) {
    return (
      <Card>
        <CardHeader title="Quotation" />
        <CardBody>
          {QUOTABLE.includes(enquiry.status) ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-500">
                Start a quotation from this enquiry. {enquiry.menu.length > 0 ? 'The requested dishes are added for you.' : 'The customer did not choose dishes, so you will build the menu.'}
              </p>
              <Button onClick={onCreate} loading={creating}>
                <FilePlus2 className="size-4" aria-hidden="true" />
                Create quotation
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-500">No quotation was prepared for this enquiry.</p>
          )}
        </CardBody>
      </Card>
    )
  }

  const current = quote.versions.find((v) => v.id === quote.current_version_id)
  const draft = quote.versions.find((v) => v.status === 'draft')
  const status = quote.status === 'sent' && isExpired(current) ? 'expired' : quote.status

  return (
    <Card>
      <CardHeader
        title="Quotation"
        action={
          <Button to={`/admin/quotations/${quote.id}`} size="sm">
            <FileText className="size-4" aria-hidden="true" />
            {draft ? 'Continue editing' : 'Open quotation'}
          </Button>
        }
      />
      <CardBody className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink-900">{quote.quotation_number}</span>
          <QuotationStatusBadge status={status} />
          {draft && quote.status !== 'draft' && <Badge>Revision {draft.version_number} in draft</Badge>}
        </div>
        {current ? (
          <p className="text-ink-500">
            Version {current.version_number} sent {formatDate(current.sent_at)} ·{' '}
            <span className="font-semibold text-ink-900">{formatCurrency(current.total_amount)}</span> · valid until{' '}
            {formatEventDate(current.valid_until)}
          </p>
        ) : (
          <p className="text-ink-500">Not sent to the customer yet.</p>
        )}
        {quote.responded_at && ['accepted', 'rejected'].includes(quote.status) && (
          <Alert tone={quote.status === 'accepted' ? 'success' : 'warning'}>
            Customer {quote.status === 'accepted' ? 'accepted' : 'declined'} on {formatDate(quote.responded_at)}.
            {quote.customer_response_note && <span className="mt-1 block italic">“{quote.customer_response_note}”</span>}
          </Alert>
        )}
      </CardBody>
    </Card>
  )
}

export default function AdminEnquiryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: enquiry, error, loading, reload, setData } = useAsync(() => getAdminEnquiry(id), [id])
  const [action, setAction] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)

  if (loading && !enquiry) return <PageLoader label="Loading enquiry…" />
  if (error && !enquiry) {
    const missing = error.code === 'PGRST116'
    return (
      <StatusScreen
        icon={missing ? FileQuestion : TriangleAlert}
        tone={missing ? 'neutral' : 'error'}
        title={missing ? 'Enquiry not found' : "Couldn't load this enquiry"}
        message={missing ? 'It may have been removed, or the link is wrong.' : getErrorMessage(error)}
        actions={
          <>
            {!missing && <Button onClick={reload}>Try again</Button>}
            <Button to="/admin/enquiries" variant="secondary">
              All enquiries
            </Button>
          </>
        }
      />
    )
  }

  const e = enquiry.event
  const actions = ENQUIRY_ACTIONS[enquiry.status] ?? []
  const copy = action ? ENQUIRY_ACTION_COPY[action] : null
  const eventPassed = e?.event_date && e.event_date <= todayInIndia()

  async function applyStatus() {
    setBusy(true)
    try {
      await setEnquiryStatus(enquiry.id, action, copy.askMessage ? message : null)
      toast.success(`${enquiry.enquiry_number} is now ${ENQUIRY_STATUS[action].label.toLowerCase()}.`)
      setAction(null)
      setMessage('')
      setData(await getAdminEnquiry(enquiry.id))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function startQuotation() {
    setCreating(true)
    try {
      const quotationId = await createQuotation(enquiry.id)
      navigate(`/admin/quotations/${quotationId}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
      setCreating(false)
    }
  }

  return (
    <>
      <Button to="/admin/enquiries" variant="ghost" size="sm" className="-ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All enquiries
      </Button>
      <PageHeader
        eyebrow={enquiry.enquiry_number}
        title={`${enquiry.contact_name} · ${eventTitle(e)}`}
        description={`${formatEventDate(e?.event_date)} · ${e?.guest_count?.toLocaleString('en-IN')} guests · received ${formatDate(enquiry.submitted_at)}`}
        actions={actions.map((a) => {
          const c = ENQUIRY_ACTION_COPY[a]
          const disabled = a === 'completed' && !eventPassed
          return (
            <Button
              key={a}
              size="sm"
              variant={c.tone === 'danger' ? 'danger' : 'secondary'}
              onClick={() => setAction(a)}
              disabled={disabled}
              title={disabled ? 'Available on or after the event date' : undefined}
            >
              {c.label}
            </Button>
          )
        })}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <EnquiryStatusBadge status={enquiry.status} />
        <a href={`tel:${enquiry.contact_phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
          <Phone className="size-4" aria-hidden="true" />
          {enquiry.contact_phone}
        </a>
        <a href={`mailto:${enquiry.contact_email}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
          <Mail className="size-4" aria-hidden="true" />
          {enquiry.contact_email}
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <QuotationCard enquiry={enquiry} onCreate={startQuotation} creating={creating} />

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
              title="Requested menu"
              description={enquiry.menu.length ? `${enquiry.menu.length} dishes · prices as at submission` : undefined}
            />
            <CardBody>
              {enquiry.menu.length === 0 ? (
                <p className="text-sm text-ink-500">The customer didn't choose any dishes.</p>
              ) : (
                <>
                  <ul className="divide-y divide-ivory-200">
                    {enquiry.menu.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                        <DietMark labels={m.dietary_labels} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-ink-900">{m.dish_name}</span>
                          {m.source === 'ai' && <Badge className="ml-2">AI suggestion</Badge>}
                          <span className="block text-xs text-ink-400">
                            {m.category_name} · {m.cuisine_name}
                          </span>
                        </span>
                        <span className="text-ink-500">
                          {Number(m.quantity).toLocaleString('en-IN')} {QUANTITY_UNITS[m.pricing_unit] ?? ''} × {priceLabel(m.unit_price, m.pricing_unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex justify-between border-t border-ivory-200 pt-3 text-sm">
                    <span className="font-medium text-ink-700">Customer's estimate</span>
                    <span className="font-semibold text-forest-800">{formatCurrency(enquiry.estimated_menu_total)}</span>
                  </p>
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

        <div className="space-y-6">
          <AdminNotes
            enquiryId={enquiry.id}
            notes={enquiry.notes}
            onChange={(notes) => setData((prev) => ({ ...prev, notes }))}
          />

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-ivory-300 pl-5" aria-label="Status history">
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
                      <p className="text-xs text-ink-400">
                        {timestamp.format(new Date(h.created_at))}
                        {h.by && ` · ${h.by.role === 'admin' ? h.by.full_name || 'Owner' : 'Customer'}`}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(action)}
        title={copy?.title}
        tone={copy?.tone}
        message={
          <>
            <p>{copy?.message}</p>
            {copy?.askMessage && (
              <Field
                className="mt-4"
                label="Message to the customer"
                optional
                as="textarea"
                rows={3}
                maxLength={1000}
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                hint="Shown in their notifications. Leave blank for a standard message."
              />
            )}
          </>
        }
        confirmLabel={copy?.confirm}
        cancelLabel="Back"
        loading={busy}
        onConfirm={applyStatus}
        onCancel={() => {
          setAction(null)
          setMessage('')
        }}
      />
    </>
  )
}
