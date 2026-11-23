import { supabase } from '@/lib/supabase.js'

// Quotation tables are read-only through the API (even for admins). Every change goes
// through the validated functions in supabase/migrations/20261126090000_quotation_workflow.sql,
// and all totals are computed by the database.

const VERSION_COLUMNS =
  'id, version_number, status, pricing_mode, guest_count, per_person_rate, items_total, subtotal, ' +
  'additional_charges, additional_charges_total, discount_type, discount_value, discount_amount, ' +
  'taxable_amount, gst_rate, gst_amount, total_amount, advance_amount, balance_amount, terms, ' +
  'notes_to_customer, valid_until, sent_at, created_at, updated_at, ' +
  'items:quotation_items(id, dish_id, dish_name, description, category_name, cuisine_name, unit_price, ' +
  'pricing_unit, quantity, line_total, sort_order)'

// quotations ↔ quotation_versions has two foreign keys, so the embed names the one to use.
const QUOTATION_COLUMNS =
  'id, quotation_number, enquiry_id, status, current_version_id, customer_response_note, responded_at, created_at, ' +
  'enquiry:enquiries(id, enquiry_number, status, contact_name, contact_phone, contact_email, company_name, ' +
  'gst_number, address, total_budget, per_person_budget, budget_flexibility, ' +
  'event:event_details(event_type, event_type_other, event_date, event_time, venue_name, venue_address, ' +
  'guest_count, service_type, dietary_requirements)), ' +
  `versions:quotation_versions!quotation_versions_quotation_id_fkey(${VERSION_COLUMNS})`

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Admins get every version (including the draft); customers only see sent versions
 * of their own quotations (RLS). Versions are newest first, items in saved order.
 */
export async function getQuotation(id) {
  const notFound = Object.assign(new Error('Quotation not found.'), { code: 'PGRST116' })
  if (!UUID_RE.test(id)) throw notFound
  const data = await run(supabase.from('quotations').select(QUOTATION_COLUMNS).eq('id', id).maybeSingle())
  if (!data) throw notFound
  data.versions.sort((a, b) => b.version_number - a.version_number)
  for (const v of data.versions) v.items.sort((a, b) => a.sort_order - b.sort_order)
  return data
}

/** Returns the quotation id (an existing one if the enquiry already has a quotation). */
export function createQuotation(enquiryId) {
  return run(supabase.rpc('create_quotation', { p_enquiry_id: enquiryId }))
}

/** `draft` is the builder's form state; values are validated again by the database. */
export function saveQuotationDraft(quotationId, draft) {
  return run(
    supabase.rpc('save_quotation_draft', {
      p_quotation_id: quotationId,
      p_draft: {
        pricing_mode: draft.pricing_mode,
        guest_count: draft.guest_count,
        per_person_rate: draft.per_person_rate,
        additional_charges: draft.additional_charges.map(({ label, amount }) => ({ label, amount })),
        discount_type: draft.discount_type,
        discount_value: draft.discount_value,
        gst_rate: draft.gst_rate,
        advance_amount: draft.advance_amount,
        valid_until: draft.valid_until,
        terms: draft.terms,
        notes_to_customer: draft.notes_to_customer,
        items: draft.items.map((i) => ({
          dish_id: i.dish_id,
          dish_name: i.dish_name,
          description: i.description,
          category_name: i.category_name,
          cuisine_name: i.cuisine_name,
          unit_price: i.unit_price,
          pricing_unit: i.pricing_unit,
          quantity: i.quantity,
        })),
      },
    }),
  )
}

export function sendQuotation(quotationId) {
  return run(supabase.rpc('send_quotation', { p_quotation_id: quotationId }))
}

export function createRevision(quotationId) {
  return run(supabase.rpc('create_quotation_revision', { p_quotation_id: quotationId }))
}

export function withdrawQuotation(quotationId, message) {
  return run(supabase.rpc('withdraw_quotation', { p_quotation_id: quotationId, p_message: message || null }))
}

/** Resolves to true when the whole quotation was deleted (it had never been sent). */
export function discardDraft(quotationId) {
  return run(supabase.rpc('discard_quotation_draft', { p_quotation_id: quotationId }))
}

/**
 * Downloads one version as a PDF from /api/quotation-pdf (built on the server with the
 * caller's own session, so RLS decides access). Saves it with the server's filename.
 */
export async function downloadQuotationPdf(quotationId, versionId) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Your session has expired. Please sign in again.')

  const params = new URLSearchParams({ quotation: quotationId, version: versionId })
  let response
  try {
    response = await fetch(`/api/quotation-pdf?${params}`, { headers: { authorization: `Bearer ${token}` } })
  } catch (err) {
    throw new Error('Network error. Check your internet connection and try again.', { cause: err })
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? "We couldn't create the PDF. Please try again.")
  }

  const blob = await response.blob()
  const filename =
    /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'quotation.pdf'
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Customer: `decision` is 'accept' or 'reject'; `versionId` is the version they reviewed. */
export function respondToQuotation(quotationId, versionId, decision, note) {
  return run(
    supabase.rpc('respond_to_quotation', {
      p_quotation_id: quotationId,
      p_version_id: versionId,
      p_decision: decision,
      p_note: note || null,
    }),
  )
}
