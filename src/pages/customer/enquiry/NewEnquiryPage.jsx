import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, RotateCcw, Send, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext.js'
import Alert from '@/components/feedback/Alert.jsx'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Button from '@/components/ui/Button.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import { useAsync } from '@/hooks/useAsync.js'
import { cuisines, listMenu } from '@/services/catalogueService.js'
import { submitEnquiry } from '@/services/enquiryService.js'
import { getErrorMessage } from '@/utils/errors.js'
import { readJson, removeKey, writeJson } from '@/utils/storage.js'
import ContactStep from './ContactStep.jsx'
import EventStep from './EventStep.jsx'
import MenuStep from './MenuStep.jsx'
import ReviewStep from './ReviewStep.jsx'
import StepIndicator from './StepIndicator.jsx'
import { STEPS, draftKey, emptyDraft, firstInvalidStep, restoreDraft, toPayload, validateStep } from './enquiryDraft.js'

async function loadOptions() {
  const [menu, cuisineList] = await Promise.all([listMenu(), cuisines.list()])
  return { menu, cuisines: cuisineList.filter((c) => c.is_active) }
}

export default function NewEnquiryPage() {
  const { data, error, loading, reload } = useAsync(loadOptions)
  if (loading && !data) return <PageLoader label="Getting things ready…" />
  if (error) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="Couldn't load the enquiry form"
        message={getErrorMessage(error)}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    )
  }
  return <Wizard menu={data.menu} cuisineOptions={data.cuisines} />
}

function Wizard({ menu, cuisineOptions }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const storageKey = draftKey(user.id)
  const [draft, setDraft] = useState(() => restoreDraft(readJson(storageKey), profile))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [suggestions, setSuggestions] = useState({ status: 'idle' })
  const headingRef = useRef(null)
  const submitted = useRef(false)

  // Autosave (skipped after a successful submit so the cleared draft isn't re-written).
  useEffect(() => {
    if (!submitted.current) writeJson(storageKey, draft)
  }, [storageKey, draft])

  // Dishes picked earlier that have since been removed or made unavailable.
  const dishById = useMemo(() => new Map(menu.dishes.map((d) => [d.id, d])), [menu])
  const validDishes = draft.dishes.filter((s) => dishById.get(s.dish_id)?.is_available)
  const droppedCount = draft.dishes.length - validDishes.length

  const step = draft.step
  const goTo = (next) => {
    setDraft((d) => ({ ...d, step: next }))
    setErrors({})
    setFailure(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }))
  }

  const fieldHandler = (section) => (event) => {
    const { name, value } = event.target
    setDraft((d) => ({ ...d, [section]: { ...d[section], [name]: value } }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }
  const setEventValue = (name, value) => setDraft((d) => ({ ...d, event: { ...d.event, [name]: value } }))
  const setDishes = (dishes) => {
    setDraft((d) => ({ ...d, dishes }))
    setErrors({})
  }

  function showErrors(found) {
    setErrors(found)
    requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus())
  }

  function next() {
    const current = { ...draft, dishes: validDishes }
    const found = validateStep(step, current)
    if (Object.keys(found).length) return showErrors(found)
    if (droppedCount) setDraft((d) => ({ ...d, dishes: validDishes }))
    goTo(step + 1)
  }

  async function submit() {
    const current = { ...draft, dishes: validDishes }
    const bad = firstInvalidStep(current)
    if (bad !== -1) {
      goTo(bad)
      requestAnimationFrame(() => showErrors(validateStep(bad, current)))
      return
    }
    setSubmitting(true)
    setFailure(null)
    try {
      const result = await submitEnquiry(toPayload(current))
      submitted.current = true
      removeKey(storageKey)
      toast.success(`Enquiry ${result.enquiry_number} sent. We'll be in touch soon.`)
      navigate(`/account/enquiries/${result.id}`, { replace: true })
    } catch (err) {
      setFailure(getErrorMessage(err))
      setSubmitting(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function resetDraft() {
    removeKey(storageKey)
    setDraft(emptyDraft(profile))
    setErrors({})
    setFailure(null)
    setConfirmReset(false)
    setSuggestions({ status: 'idle' })
    window.scrollTo({ top: 0 })
  }

  const hasErrors = Object.values(errors).some(Boolean)

  return (
    <>
      <Button to="/account/enquiries" variant="ghost" size="sm" className="-ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden="true" />
        My enquiries
      </Button>
      <PageHeader
        eyebrow="Plan an event"
        title={STEPS[step].key === 'review' ? 'Review your enquiry' : 'Tell us about your event'}
        description="Your progress is saved on this device as you go."
        actions={
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Start over
          </Button>
        }
      />

      <StepIndicator steps={STEPS} current={step} onSelect={goTo} />

      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Step {step + 1} of {STEPS.length}: {STEPS[step].title}
      </h2>

      <div className="space-y-4">
        {failure && (
          <Alert tone="error" title="We couldn't send your enquiry">
            {failure}
          </Alert>
        )}
        {hasErrors && step !== 1 && <Alert tone="error">Please fix the highlighted fields.</Alert>}
        {droppedCount > 0 && step <= 1 && (
          <Alert tone="warning">
            {droppedCount === 1 ? 'A dish you picked earlier is' : `${droppedCount} dishes you picked earlier are`} no longer
            available and will be left out.
          </Alert>
        )}

        {step === 0 && (
          <EventStep
            values={draft.event}
            errors={errors}
            onChange={fieldHandler('event')}
            setValue={setEventValue}
            cuisines={cuisineOptions}
          />
        )}
        {step === 1 && (
          <MenuStep
            menu={menu}
            selection={validDishes}
            draft={draft}
            errors={errors}
            onChange={setDishes}
            suggestions={suggestions}
            setSuggestions={setSuggestions}
          />
        )}
        {step === 2 && <ContactStep values={draft.contact} errors={errors} onChange={fieldHandler('contact')} />}
        {step === 3 && <ReviewStep draft={{ ...draft, dishes: validDishes }} menu={menu} onEdit={goTo} />}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-ivory-200 bg-ivory-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={submitting}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            {step === 1 && validDishes.length === 0 ? 'Skip – suggest a menu for me' : 'Continue'}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="accent" onClick={submit} loading={submitting}>
            {!submitting && <Send className="size-4" aria-hidden="true" />}
            Send enquiry
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Start over?"
        message="This clears everything you've entered for this enquiry."
        confirmLabel="Clear and start over"
        onConfirm={resetDraft}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  )
}
