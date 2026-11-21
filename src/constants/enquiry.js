// Labels for enquiry values. Keys MUST match the CHECK constraints in
// supabase/migrations/20261120090000_core_schema.sql (enquiries, event_details).

export const EVENT_TYPES = {
  wedding: 'Wedding',
  reception: 'Reception',
  engagement: 'Engagement',
  sangeet: 'Sangeet',
  mehendi: 'Mehendi',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  corporate: 'Corporate event',
  religious: 'Religious ceremony',
  housewarming: 'Housewarming',
  festival: 'Festival',
  other: 'Other',
}

export const SERVICE_TYPES = {
  buffet: { label: 'Buffet', hint: 'Guests serve themselves from counters' },
  plated: { label: 'Plated', hint: 'Served individually at the table' },
  live_counters: { label: 'Live counters', hint: 'Chefs cook to order in front of guests' },
  family_style: { label: 'Family style', hint: 'Shared platters at each table' },
  packed_meals: { label: 'Packed meals', hint: 'Individually boxed meals' },
  mixed: { label: 'Mixed', hint: 'A combination of styles' },
}

export const BUDGET_FLEXIBILITY = {
  strict: { label: 'Strict', hint: 'Please stay within my budget' },
  flexible: { label: 'Flexible', hint: 'Some room either way' },
  premium: { label: 'Premium', hint: 'Quality first, budget is secondary' },
}

/** Status label, badge tone and what it means for the customer. */
export const ENQUIRY_STATUS = {
  submitted: { label: 'Submitted', tone: 'neutral', description: 'We have received your enquiry and will review it shortly.' },
  under_review: { label: 'Under review', tone: 'gold', description: 'Our team is reviewing your request and preparing options.' },
  quoted: { label: 'Quoted', tone: 'forest', description: 'Your quotation is ready to review.' },
  confirmed: { label: 'Confirmed', tone: 'forest', description: 'Your event is confirmed. We look forward to serving you.' },
  completed: { label: 'Completed', tone: 'neutral', description: 'This event has taken place. Thank you for choosing us.' },
  cancelled: { label: 'Cancelled', tone: 'burgundy', description: 'This enquiry was cancelled.' },
  declined: { label: 'Declined', tone: 'burgundy', description: 'We are unable to cater this event. Please contact us for details.' },
}

/** "Wedding", or the customer's own description for "other". */
export const eventTitle = (event) =>
  event ? (event.event_type === 'other' ? event.event_type_other : EVENT_TYPES[event.event_type]) : 'Event'

export const CANCELLABLE_STATUSES = ['submitted', 'under_review']

/** Default quantity for a dish given the guest count. */
export function defaultQuantity(pricingUnit, guests) {
  const g = Number(guests)
  return ['per_person', 'per_plate'].includes(pricingUnit) && g > 0 ? g : 1
}
