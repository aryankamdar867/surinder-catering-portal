// Labels for quotation values. Keys MUST match the CHECK constraints in
// supabase/migrations/20261120090000_core_schema.sql (quotations, quotation_versions).

export const QUOTATION_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Awaiting reply', tone: 'gold' },
  accepted: { label: 'Accepted', tone: 'forest' },
  rejected: { label: 'Declined', tone: 'burgundy' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
}

export const PRICING_MODES = {
  itemised: { label: 'Itemised', hint: 'Each item priced by quantity' },
  per_person: { label: 'Per person', hint: 'One rate × guests; item prices optional' },
}

export const DISCOUNT_TYPES = {
  none: 'No discount',
  amount: 'Fixed amount (₹)',
  percent: 'Percentage (%)',
}

/** Common GST rates for catering in India. The owner always chooses; nothing is assumed. */
export const GST_PRESETS = [0, 5, 18]

/**
 * Status changes an owner can make by hand (mirrors set_enquiry_status() in
 * supabase/migrations/20261126090000_quotation_workflow.sql). "Quoted" and
 * "confirmed" only happen through the quotation itself.
 */
export const ENQUIRY_ACTIONS = {
  submitted: ['under_review', 'declined', 'cancelled'],
  under_review: ['declined', 'cancelled'],
  quoted: ['declined', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
}

export const ENQUIRY_ACTION_COPY = {
  under_review: {
    label: 'Start review',
    title: 'Mark as under review?',
    message: 'The customer will see that you are working on their enquiry.',
    confirm: 'Mark under review',
    tone: 'primary',
  },
  declined: {
    label: 'Decline',
    title: 'Decline this enquiry?',
    message: 'The customer will be told you are unable to cater this event. Any quotation awaiting a reply is withdrawn.',
    confirm: 'Decline enquiry',
    tone: 'danger',
    askMessage: true,
  },
  cancelled: {
    label: 'Cancel',
    title: 'Cancel this enquiry?',
    message: 'Use this when the customer has asked to cancel. Any quotation awaiting a reply is withdrawn.',
    confirm: 'Cancel enquiry',
    tone: 'danger',
    askMessage: true,
  },
  completed: {
    label: 'Mark completed',
    title: 'Mark this event as completed?',
    message: 'Do this once the event has taken place.',
    confirm: 'Mark completed',
    tone: 'primary',
  },
}

/** Enquiry statuses grouped for the owner's list filters. */
export const ENQUIRY_FILTERS = [
  ['open', 'Needs action', ['submitted', 'under_review']],
  ['quoted', 'Awaiting customer', ['quoted']],
  ['confirmed', 'Confirmed', ['confirmed']],
  ['closed', 'Closed', ['completed', 'cancelled', 'declined']],
]
