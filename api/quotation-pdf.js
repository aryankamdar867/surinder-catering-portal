import { createClient } from '@supabase/supabase-js'
import { pdfFilename, renderQuotationPdf } from './_lib/quotationPdf.js'

// GET /api/quotation-pdf?quotation=<uuid>&version=<uuid> – one quotation version as a PDF.
//
// Guarantees:
//  * Only signed-in users can call it (Supabase session token in the Authorization header).
//  * Every row is read WITH THE CALLER'S TOKEN, so RLS decides access: customers get only
//    sent (or superseded) versions of their own quotations; the owner can also preview drafts.
//    No secret key is used here.
//  * Anything the caller can't see is a plain 404, so the endpoint never reveals whether a
//    quotation exists.
//  * Amounts are the totals saved by the database; the PDF never recalculates them.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (status, error) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const VERSION_COLUMNS =
  'id, quotation_id, version_number, status, pricing_mode, guest_count, per_person_rate, items_total, subtotal, ' +
  'additional_charges, additional_charges_total, discount_type, discount_value, discount_amount, taxable_amount, ' +
  'gst_rate, gst_amount, total_amount, advance_amount, balance_amount, terms, notes_to_customer, valid_until, sent_at, ' +
  'items:quotation_items(dish_name, description, category_name, unit_price, pricing_unit, quantity, line_total, sort_order)'

const QUOTATION_COLUMNS =
  'id, quotation_number, status, current_version_id, responded_at, ' +
  'enquiry:enquiries(enquiry_number, contact_name, contact_phone, contact_email, company_name, gst_number, address, ' +
  'event:event_details(event_type, event_type_other, event_date, event_time, venue_name, venue_address, service_type))'

export async function GET(request) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('quotation-pdf: Supabase settings are missing')
    return fail(503, "PDF downloads aren't available right now. Please try again later.")
  }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'Please sign in to download the quotation.')

  const params = new URL(request.url).searchParams
  const quotationId = params.get('quotation') ?? ''
  const versionId = params.get('version') ?? ''
  if (!UUID_RE.test(quotationId) || !UUID_RE.test(versionId)) return fail(400, 'Invalid quotation link.')

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError || !auth?.user) return fail(401, 'Your session has expired. Please sign in again.')

  const [quotationResult, versionResult] = await Promise.all([
    supabase.from('quotations').select(QUOTATION_COLUMNS).eq('id', quotationId).maybeSingle(),
    supabase.from('quotation_versions').select(VERSION_COLUMNS).eq('id', versionId).eq('quotation_id', quotationId).maybeSingle(),
  ])
  for (const { error } of [quotationResult, versionResult]) {
    if (error) {
      console.error('quotation-pdf: query failed', error.code, error.message)
      return fail(502, "We couldn't load the quotation. Please try again.")
    }
  }
  const quotation = quotationResult.data
  const version = versionResult.data
  if (!quotation || !version) return fail(404, 'Quotation not found.')

  const enquiry = quotation.enquiry
  const event = Array.isArray(enquiry?.event) ? enquiry.event[0] : enquiry?.event

  let pdf
  try {
    pdf = await renderQuotationPdf({ quotation, version, enquiry, event })
  } catch (err) {
    console.error('quotation-pdf: render failed', err?.stack ?? err)
    return fail(500, "We couldn't create the PDF. Please try again.")
  }

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFilename(quotation, version)}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
