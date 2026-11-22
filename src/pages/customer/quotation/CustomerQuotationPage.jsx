import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, FileQuestion, TriangleAlert, X } from 'lucide-react'
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
import { eventTitle } from '@/constants/enquiry.js'
import { useAsync } from '@/hooks/useAsync.js'
import { getQuotation, respondToQuotation } from '@/services/quotationService.js'
import { formatEventDate } from '@/utils/dates.js'
import { getErrorMessage } from '@/utils/errors.js'
import { formatCurrency, formatDate } from '@/utils/format.js'
import { currentVersion, displayStatus } from '@/utils/quotation.js'

function StatusMessage({ quotation, status, version }) {
  switch (status) {
    case 'sent':
      return (
        <Alert className="mb-6" title="Your quotation is ready">
          Please review it and accept or decline by {formatEventDate(version.valid_until)}. Questions? Just call us; we're happy to adjust it.
        </Alert>
      )
    case 'expired':
      return (
        <Alert tone="warning" className="mb-6" title="This quotation has expired">
          It was valid until {formatEventDate(version.valid_until)}. Please contact us and we'll send you an updated quotation.
        </Alert>
      )
    case 'accepted':
      return (
        <Alert tone="success" className="mb-6" title="You accepted this quotation">
          Accepted on {formatDate(quotation.responded_at)}. Your event is confirmed and our team will be in touch about the next steps.
        </Alert>
      )
    case 'rejected':
      return (
        <Alert tone="warning" className="mb-6" title="You declined this quotation">
          Declined on {formatDate(quotation.responded_at)}. We'll review your feedback and may send you a revised quotation.
          {quotation.customer_response_note && <span className="mt-1 block italic">“{quotation.customer_response_note}”</span>}
        </Alert>
      )
    case 'withdrawn':
      return (
        <Alert tone="warning" className="mb-6" title="This quotation was withdrawn">
          It's no longer open for acceptance. We'll be in touch, or you can contact us for details.
        </Alert>
      )
    default:
      return null
  }
}

export default function CustomerQuotationPage() {
  const { id } = useParams()
  const { data: quotation, error, loading, reload, setData } = useAsync(() => getQuotation(id), [id])
  const [decision, setDecision] = useState(null) // 'accept' | 'reject'
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading && !quotation) return <PageLoader label="Loading quotation…" />
  if (error && !quotation) {
    const missing = error.code === 'PGRST116'
    return (
      <StatusScreen
        icon={missing ? FileQuestion : TriangleAlert}
        tone={missing ? 'neutral' : 'error'}
        title={missing ? 'Quotation not found' : "Couldn't load this quotation"}
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

  const version = currentVersion(quotation)
  const status = displayStatus(quotation)
  const earlier = quotation.versions.filter((v) => v.id !== version?.id)
  const canRespond = status === 'sent' && quotation.enquiry.status === 'quoted'

  async function respond() {
    setBusy(true)
    try {
      await respondToQuotation(quotation.id, version.id, decision, decision === 'reject' ? note : null)
      toast.success(decision === 'accept' ? 'Thank you! Your event is confirmed.' : "Thanks for letting us know. We'll be in touch.")
      setDecision(null)
      setNote('')
      setData(await getQuotation(quotation.id))
    } catch (err) {
      toast.error(getErrorMessage(err))
      setDecision(null)
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button to={`/account/enquiries/${quotation.enquiry_id}`} variant="ghost" size="sm" className="-ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to enquiry
      </Button>
      <PageHeader
        eyebrow={quotation.quotation_number}
        title={`Quotation · ${eventTitle(quotation.enquiry.event)}`}
        description={`${formatEventDate(quotation.enquiry.event?.event_date)} · ${quotation.enquiry.event?.venue_name}`}
        actions={<QuotationStatusBadge status={status} />}
      />

      {version ? (
        <>
          <StatusMessage quotation={quotation} status={status} version={version} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card>
              <CardBody>
                <QuotationDocument quotation={quotation} version={version} />
              </CardBody>
            </Card>

            <Card className="lg:sticky lg:top-24 lg:self-start">
              <CardHeader title="Total" />
              <CardBody className="space-y-4">
                <p className="font-display text-4xl font-semibold text-forest-900">{formatCurrency(version.total_amount)}</p>
                {Number(version.advance_amount) > 0 && (
                  <p className="text-sm text-ink-500">
                    Advance {formatCurrency(version.advance_amount)} · balance {formatCurrency(version.balance_amount)}
                  </p>
                )}
                {canRespond && (
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => setDecision('accept')}>
                      <Check className="size-4" aria-hidden="true" />
                      Accept quotation
                    </Button>
                    <Button variant="secondary" onClick={() => setDecision('reject')}>
                      <X className="size-4" aria-hidden="true" />
                      Decline
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {earlier.length > 0 && (
            <details className="group mt-6">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-forest-700 [&::-webkit-details-marker]:hidden">
                Earlier versions ({earlier.length})
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-4 space-y-4">
                {earlier.map((v) => (
                  <Card key={v.id} className="opacity-80">
                    <CardHeader title={`Version ${v.version_number}`} description="Replaced by a newer version." />
                    <CardBody>
                      <QuotationDocument quotation={quotation} version={v} />
                    </CardBody>
                  </Card>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <StatusMessage quotation={quotation} status={status} version={{}} />
      )}

      <ConfirmDialog
        open={decision === 'accept'}
        tone="primary"
        title="Accept this quotation?"
        message={
          <>
            <p>This confirms your booking with Surinder Caterers for {formatEventDate(quotation.enquiry.event?.event_date)}.</p>
            <p className="mt-3 text-base font-semibold text-ink-900">Total {formatCurrency(version?.total_amount)}</p>
          </>
        }
        confirmLabel="Accept and confirm"
        cancelLabel="Not yet"
        loading={busy}
        onConfirm={respond}
        onCancel={() => setDecision(null)}
      />
      <ConfirmDialog
        open={decision === 'reject'}
        title="Decline this quotation?"
        message={
          <>
            <p>Let us know what didn't work and we can prepare a revised quotation.</p>
            <Field
              className="mt-4"
              label="What should we change?"
              optional
              as="textarea"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Over budget, would like more vegetarian starters"
            />
          </>
        }
        confirmLabel="Decline quotation"
        cancelLabel="Back"
        loading={busy}
        onConfirm={respond}
        onCancel={() => {
          setDecision(null)
          setNote('')
        }}
      />
    </>
  )
}
