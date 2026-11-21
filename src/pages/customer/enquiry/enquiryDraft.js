import { hasPrice } from '@/utils/catalogue.js'
import { addToIsoDate, todayInIndia } from '@/utils/dates.js'
import { formatCurrency } from '@/utils/format.js'
import { validateEmail, validateGst, validatePhone } from '@/utils/validation.js'

// Wizard state, validation and persistence. Rules mirror submit_enquiry() in
// supabase/migrations/20261122090000_enquiry_rpcs.sql (the server re-checks everything).

export const DRAFT_VERSION = 1
export const draftKey = (userId) => `sc:enquiry-draft:v${DRAFT_VERSION}:${userId}`

export const STEPS = [
  { key: 'event', title: 'Event' },
  { key: 'menu', title: 'Menu' },
  { key: 'contact', title: 'Contact & budget' },
  { key: 'review', title: 'Review' },
]

export function emptyDraft(profile) {
  return {
    version: DRAFT_VERSION,
    step: 0,
    event: {
      event_type: '',
      event_type_other: '',
      event_date: '',
      event_time: '',
      venue_name: '',
      venue_address: '',
      guest_count: '',
      service_type: '',
      cuisine_preferences: [],
      dietary_requirements: '',
      special_instructions: '',
    },
    dishes: [], // [{ dish_id, quantity }]
    contact: {
      contact_name: profile?.full_name ?? '',
      contact_phone: profile?.phone ?? '',
      contact_email: profile?.email ?? '',
      address: profile?.address ?? '',
      company_name: profile?.company_name ?? '',
      gst_number: profile?.gst_number ?? '',
      total_budget: '',
      per_person_budget: '',
      budget_flexibility: 'flexible',
    },
  }
}

/** Restores a saved draft, falling back to defaults for anything missing or malformed. */
export function restoreDraft(saved, profile) {
  const base = emptyDraft(profile)
  if (!saved || saved.version !== DRAFT_VERSION) return base
  return {
    ...base,
    step: Number.isInteger(saved.step) ? Math.min(Math.max(saved.step, 0), STEPS.length - 1) : 0,
    event: { ...base.event, ...saved.event },
    contact: { ...base.contact, ...saved.contact },
    dishes: Array.isArray(saved.dishes) ? saved.dishes.filter((d) => d && typeof d.dish_id === 'string') : [],
  }
}

const tooLong = (value, max, label) => (value.trim().length > max ? `${label} must be ${max} characters or fewer.` : undefined)
const WHOLE = /^\d+$/
const MONEY = /^\d+(\.\d{1,2})?$/

export function eventLimits() {
  const today = todayInIndia()
  return { min: addToIsoDate(today, { days: 1 }), max: addToIsoDate(today, { years: 2 }) }
}

export function validateEvent(e) {
  const { min, max } = eventLimits()
  const guests = e.guest_count.trim()
  return {
    event_type: e.event_type ? undefined : 'Choose the type of event.',
    event_type_other:
      e.event_type === 'other' && !e.event_type_other.trim()
        ? 'Describe the type of event.'
        : tooLong(e.event_type_other, 80, 'Description'),
    event_date: !e.event_date
      ? 'Choose the event date.'
      : e.event_date < min
        ? 'The event date must be from tomorrow onwards.'
        : e.event_date > max
          ? 'We take bookings up to two years ahead.'
          : undefined,
    venue_name: !e.venue_name.trim() ? 'Enter the venue name.' : tooLong(e.venue_name, 200, 'Venue name'),
    venue_address: tooLong(e.venue_address, 500, 'Venue address'),
    guest_count: !guests
      ? 'Enter the number of guests.'
      : !WHOLE.test(guests) || Number(guests) < 1 || Number(guests) > 100000
        ? 'Enter a whole number between 1 and 100,000.'
        : undefined,
    service_type: e.service_type ? undefined : 'Choose a service style.',
    dietary_requirements: tooLong(e.dietary_requirements, 1000, 'Dietary requirements'),
    special_instructions: tooLong(e.special_instructions, 2000, 'Special instructions'),
  }
}

export function validateDishes(dishes) {
  const errors = {}
  if (dishes.length > 100) errors.dishes = 'Choose at most 100 dishes.'
  for (const d of dishes) {
    const q = String(d.quantity).trim()
    if (!MONEY.test(q) || Number(q) <= 0 || Number(q) > 100000) {
      errors[`qty-${d.dish_id}`] = 'Enter a quantity above 0 (up to 2 decimals).'
    }
  }
  return errors
}

export function validateContact(c) {
  const name = c.contact_name.trim()
  return {
    contact_name: !name ? 'Enter a contact name.' : name.length < 2 || name.length > 120 ? 'Use 2–120 characters.' : undefined,
    contact_phone: validatePhone(c.contact_phone, { required: true }),
    contact_email: validateEmail(c.contact_email),
    address: tooLong(c.address, 500, 'Address'),
    company_name: tooLong(c.company_name, 150, 'Company name'),
    gst_number: validateGst(c.gst_number),
    total_budget:
      c.total_budget.trim() && (!MONEY.test(c.total_budget.trim()) || Number(c.total_budget) >= 1e10)
        ? 'Enter an amount in rupees, e.g. 250000.'
        : undefined,
    per_person_budget:
      c.per_person_budget.trim() && (!MONEY.test(c.per_person_budget.trim()) || Number(c.per_person_budget) >= 1e8)
        ? 'Enter an amount in rupees, e.g. 1200.'
        : undefined,
  }
}

export const onlyErrors = (errors) => Object.fromEntries(Object.entries(errors).filter(([, v]) => v))

/** Validation for a step index (review re-validates everything). */
export function validateStep(step, draft) {
  if (step === 0) return onlyErrors(validateEvent(draft.event))
  if (step === 1) return onlyErrors(validateDishes(draft.dishes))
  if (step === 2) return onlyErrors(validateContact(draft.contact))
  return {}
}

/** First step with errors, or -1 when the whole draft is valid. */
export function firstInvalidStep(draft) {
  for (let i = 0; i < STEPS.length - 1; i += 1) {
    if (Object.keys(validateStep(i, draft)).length) return i
  }
  return -1
}

/**
 * Estimated total for a selection, using live menu prices (the server snapshots its own).
 * Dishes without a price ("price on request") are left out and counted in `unpriced`.
 */
export function estimateTotal(selection, dishById) {
  return selection.reduce(
    (acc, s) => {
      const dish = dishById.get(s.dish_id)
      const qty = Number(s.quantity)
      if (!dish) return acc
      if (!hasPrice(dish.price)) return { ...acc, unpriced: acc.unpriced + 1 }
      return Number.isFinite(qty) ? { ...acc, total: acc.total + Number(dish.price) * qty, priced: acc.priced + 1 } : acc
    },
    { total: 0, priced: 0, unpriced: 0 },
  )
}

/** The estimate's amount: "On request" when nothing selected has a price yet. */
export const estimateAmount = ({ total, priced, unpriced }) => (unpriced > 0 && priced === 0 ? 'On request' : formatCurrency(total))

/** Explains dishes left out of the estimate, or null. */
export function estimateNote({ unpriced }) {
  if (!unpriced) return null
  return `${unpriced} ${unpriced === 1 ? 'dish is' : 'dishes are'} priced on request and not included. We'll confirm prices in your quotation.`
}

/** Shape sent to submit_enquiry (strings trimmed; GST upper-cased; numbers as strings are fine). */
export function toPayload(draft) {
  const trimAll = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
  return {
    event: { ...trimAll(draft.event), guest_count: Number(draft.event.guest_count) },
    contact: { ...trimAll(draft.contact), gst_number: draft.contact.gst_number.trim().toUpperCase() },
    dishes: draft.dishes,
  }
}
