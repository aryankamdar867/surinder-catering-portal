import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, FilePen, FileQuestion, TriangleAlert, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import Alert from '@/components/feedback/Alert.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import QuotationDocument, { QuotationStatusBadge } from '@/components/quotation/QuotationDocument.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { BUDGET_FLEXIBILITY, SERVICE_TYPES, eventTitle } from '@/constants/enquiry.js'
import { useAsync } from '@/hooks/useAsync.js'
import EnquiryStatusBadge from '@/pages/customer/enquiry/EnquiryStatusBadge.jsx'
import { listDishes } from '@/services/catalogueService.js'
import { createRevision, discardDraft, getQuotation, withdrawQuotation } from '@/services/quotationService.js'
import { formatEventDate } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency, formatDate } from '@/utils/format.js'
import { currentVersion, displayStatus, draftVersion } from '@/utils/quotation.js'
import QuotationEditor from './QuotationEditor.jsx'

const OPEN_ENQUIRY = ['submitted', 'under_review', 'quoted']

async function load(id) {
  const quotation = await getQuotation(id)
  const dishes = draftVersion(quotation) ? await listDishes() : null
  return { quotation, dishes }
}

function EnquirySummary({ enquiry }) {
  const e = enquiry.event
  const budget = [
    enquiry.total_budget !== null && `${formatCurrency(enquiry.total_budget)} total`,
    enquiry.per_person_budget !== null && `${formatCurrency(enquiry.per_person_budget)} per person`,
  ].filter(Boolean)
  return (
    <Card className="mb-6">
      <CardBody className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p>
          <span className="block text-ink-400">Customer</span>
          <span className="font-medium text-ink-900">{enquiry.contact_name}</span>
          {enquiry.company_name && <span className="block text-ink-500">{enquiry.company_name}</span>}
        </p>
        <p>
          <span className="block text-ink-400">Event</span>
          <span className="font-medium text-ink-900">
            {eventTitle(e)} · {SERVICE_TYPES[e?.service_type]?.label}
          </span>
          <span className="block text-ink-500">
            {formatEventDate(e?.event_date)} · {e?.guest_count?.toLocaleString('en-IN')} guests
          </span>
        </p>
        <p>
          <span className="block text-ink-400">Venue</span>
          <span className="font-medium text-ink-900">{e?.venue_name}</span>
        </p>
        <p>
          <span className="block text-ink-400">Budget</span>
          <span className="font-medium text-ink-900">{budget.length ? budget.join(' · ') : 'Not given'}</span>
          <span className="block text-ink-500">{BUDGET_FLEXIBILITY[enquiry.budget_flexibility]?.label}</span>
        </p>
        {e?.dietary_requirements && (
          <p className="sm:col-span-2 lg:col-span-4">
            <span className="block text-ink-400">Dietary requirements</span>
            <span className="whitespace-pre-line font-medium text-ink-900">{e.dietary_requirements}</span>
          </p>
        )}
      </CardBody>
    </Card>
  )
}

function VersionHistory({ quotation, exclude }) {
  const sent = quotation.versions.filter((v) => v.status !== 'draft' && v.id !== exclude)
  if (sent.length === 0) return null
  return (
    <Card className="mt-6">
      <CardHeader title="Sent versions" description="Locked once sent. The customer sees the latest one." />
      <ul className="divide-y divide-ivory-200">
        {sent.map((v) => (
          <li key={v.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-ink-900">Version {v.version_number}</span>
                <span className="text-ink-500">
                  sent {formatDate(v.sent_at)} · {formatCurrency(v.total_amount)}
                </span>
                {v.id === quotation.current_version_id ? (
                  <span className="text-xs font-semibold text-forest-700">Current</span>
                ) : (
                  <span className="text-xs text-ink-400">Superseded</span>
                )}
                <ChevronDown className="ml-auto size-4 text-ink-400 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-ivory-200 px-5 py-5 sm:px-6">
                <QuotationDocument quotation={quotation} version={v} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function QuotationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(() => load(id), [id])
  const [confirm, setConfirm] = useState(null) // 'withdraw'
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading && !data) return <PageLoader label="Loading quotation…" />
  if (error && !data) {
    const missing = error.code === 'PGRST116'
    return (
      <StatusScreen
        icon={missing ? FileQuestion : TriangleAlert}
        tone={missing ? 'neutral' : 'error'}
        title={missing ? 'Quotation not found' : "Couldn't load this quotation"}
        message={missing ? 'It may have been deleted, or the link is wrong.' : getErrorMessage(error)}
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

  const { quotation, dishes } = data
  const draft = draftVersion(quotation)
  const current = currentVersion(quotation)
  const status = displayStatus(quotation)
  const enquiryOpen = OPEN_ENQUIRY.includes(quotation.enquiry.status)
  const canRevise = !draft && quotation.status !== 'accepted' && enquiryOpen
  const enquiryPath = `/admin/enquiries/${quotation.enquiry_id}`

  async function revise() {
    setBusy(true)
    try {
      await createRevision(quotation.id)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function discardClosedDraft() {
    setBusy(true)
    try {
      const deleted = await discardDraft(quotation.id)
      toast.success(deleted ? 'Quotation deleted.' : 'Draft revision discarded.')
      if (deleted) navigate(enquiryPath)
      else reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    setBusy(true)
    try {
      await withdrawQuotation(quotation.id, message)
      toast.success(`${quotation.quotation_number} was withdrawn.`)
      setConfirm(null)
      setMessage('')
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button to={enquiryPath} variant="ghost" size="sm" className="-ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {quotation.enquiry.enquiry_number}
      </Button>
      <PageHeader
        eyebrow="Quotation"
        title={quotation.quotation_number}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <QuotationStatusBadge status={status} />
            <span>Enquiry</span>
            <EnquiryStatusBadge status={quotation.enquiry.status} />
          </span>
        }
        actions={
          !draft && (
            <>
              {quotation.status === 'sent' && (
                <Button variant="danger" size="sm" onClick={() => setConfirm('withdraw')}>
                  <Undo2 className="size-4" aria-hidden="true" />
                  Withdraw
                </Button>
              )}
              {canRevise && (
                <Button size="sm" onClick={revise} loading={busy && !confirm}>
                  <FilePen className="size-4" aria-hidden="true" />
                  Create revision
                </Button>
              )}
            </>
          )
        }
      />

      <EnquirySummary enquiry={quotation.enquiry} />

      {['accepted', 'rejected'].includes(quotation.status) && quotation.responded_at && (
        <Alert tone={quotation.status === 'accepted' ? 'success' : 'warning'} className="mb-6" title={`Customer ${quotation.status === 'accepted' ? 'accepted' : 'declined'} on ${formatDate(quotation.responded_at)}`}>
          {quotation.customer_response_note ? <span className="italic">“{quotation.customer_response_note}”</span> : 'No note was left.'}
          {quotation.status === 'rejected' && draft && <span className="mt-1 block">You are preparing a revision.</span>}
        </Alert>
      )}
      {draft && current && quotation.status === 'sent' && (
        <Alert className="mb-6">
          The customer still sees version {current.version_number} until you send this revision.
        </Alert>
      )}
      {!enquiryOpen && quotation.status !== 'accepted' && (
        <Alert tone="warning" className="mb-6">
          This enquiry is closed, so the quotation can no longer be changed or sent.
          {draft && (
            <Button variant="secondary" size="sm" className="mt-3 flex" onClick={discardClosedDraft} loading={busy}>
              {quotation.status === 'draft' ? 'Delete unsent quotation' : 'Discard unsent revision'}
            </Button>
          )}
        </Alert>
      )}

      {draft && enquiryOpen ? (
        <QuotationEditor
          key={`${draft.id}-${draft.updated_at}`}
          quotation={quotation}
          version={draft}
          dishes={dishes ?? []}
          onSaved={reload}
          onSent={reload}
          onDiscarded={(deleted) => (deleted ? navigate(enquiryPath) : reload())}
        />
      ) : current ? (
        <Card>
          <CardHeader
            title={`Version ${current.version_number}`}
            description="As the customer sees it."
          />
          <CardBody>
            <QuotationDocument quotation={quotation} version={current} />
          </CardBody>
        </Card>
      ) : (
        <p className="text-sm text-ink-500">This quotation has no sent version.</p>
      )}

      <VersionHistory quotation={quotation} exclude={draft && enquiryOpen ? null : current?.id} />

      <ConfirmDialog
        open={confirm === 'withdraw'}
        title={`Withdraw ${quotation.quotation_number}?`}
        message={
          <>
            <p>The customer will no longer be able to accept it. The enquiry goes back to review, and you can send a revision later.</p>
            <Field
              className="mt-4"
              label="Message to the customer"
              optional
              as="textarea"
              rows={3}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </>
        }
        confirmLabel="Withdraw quotation"
        cancelLabel="Back"
        loading={busy && confirm === 'withdraw'}
        onConfirm={withdraw}
        onCancel={() => {
          setConfirm(null)
          setMessage('')
        }}
      />
    </>
  )
}
