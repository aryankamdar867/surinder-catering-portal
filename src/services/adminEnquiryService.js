import { supabase } from '@/lib/supabase.js'

// Owner-side enquiry reads and actions. RLS lets admins read every enquiry; status
// changes go through set_enquiry_status() (direct status updates are blocked by a trigger).

const LIST_COLUMNS =
  'id, enquiry_number, status, contact_name, contact_phone, company_name, estimated_menu_total, submitted_at, ' +
  'event:event_details(event_type, event_type_other, event_date, guest_count, venue_name), ' +
  'quotations(id, quotation_number, status)'

const DETAIL_COLUMNS =
  'id, enquiry_number, customer_id, status, contact_name, contact_phone, contact_email, address, company_name, ' +
  'gst_number, total_budget, per_person_budget, budget_flexibility, estimated_menu_total, submitted_at, updated_at, ' +
  'event:event_details(*), ' +
  'menu:menu_selections(id, dish_id, dish_name, category_name, cuisine_name, unit_price, pricing_unit, ' +
  'dietary_labels, tier, quantity, line_total, source, created_at), ' +
  'history:enquiry_status_history(id, from_status, to_status, created_at, by:profiles(full_name, role)), ' +
  'notes:admin_notes(id, body, author_id, created_at, updated_at, author:profiles(full_name, email)), ' +
  'quotations(id, quotation_number, status, current_version_id, responded_at, customer_response_note, created_at, ' +
  'versions:quotation_versions!quotation_versions_quotation_id_fkey(id, version_number, status, total_amount, valid_until, sent_at))'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

const byDate = (key, dir = 1) => (a, b) => dir * (new Date(a[key]) - new Date(b[key]))

export function listAllEnquiries() {
  return run(supabase.from('enquiries').select(LIST_COLUMNS).order('submitted_at', { ascending: false }))
}

export async function getAdminEnquiry(id) {
  const notFound = Object.assign(new Error('Enquiry not found.'), { code: 'PGRST116' })
  if (!UUID_RE.test(id)) throw notFound
  const data = await run(supabase.from('enquiries').select(DETAIL_COLUMNS).eq('id', id).maybeSingle())
  if (!data) throw notFound
  data.menu.sort(byDate('created_at'))
  data.history.sort(byDate('created_at'))
  data.notes.sort(byDate('created_at', -1))
  for (const q of data.quotations) q.versions.sort((a, b) => b.version_number - a.version_number)
  return data
}

export function setEnquiryStatus(id, status, message) {
  return run(
    supabase.rpc('set_enquiry_status', { p_enquiry_id: id, p_status: status, p_message: message?.trim() || null }),
  )
}

// --- Internal notes (admins only; authors edit/delete their own) ------------

const NOTE_COLUMNS = 'id, body, author_id, created_at, updated_at, author:profiles(full_name, email)'

export function addNote(enquiryId, body, authorId) {
  return run(
    supabase
      .from('admin_notes')
      .insert({ enquiry_id: enquiryId, body: body.trim(), author_id: authorId })
      .select(NOTE_COLUMNS)
      .single(),
  )
}

export function updateNote(id, body) {
  return run(supabase.from('admin_notes').update({ body: body.trim() }).eq('id', id).select(NOTE_COLUMNS).single())
}

export function deleteNote(id) {
  return run(supabase.from('admin_notes').delete().eq('id', id))
}
