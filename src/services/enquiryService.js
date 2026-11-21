import { supabase } from '@/lib/supabase.js'

// Customers can only READ enquiry tables (RLS). Creating and cancelling go through
// the SECURITY DEFINER functions in supabase/migrations/20261122090000_enquiry_rpcs.sql.

const LIST_COLUMNS =
  'id, enquiry_number, status, estimated_menu_total, submitted_at, ' +
  'event:event_details(event_type, event_type_other, event_date, guest_count, venue_name)'

const DETAIL_COLUMNS =
  'id, enquiry_number, status, contact_name, contact_phone, contact_email, address, company_name, gst_number, ' +
  'total_budget, per_person_budget, budget_flexibility, estimated_menu_total, submitted_at, updated_at, ' +
  'event:event_details(*), ' +
  'menu:menu_selections(id, dish_id, dish_name, category_name, cuisine_name, unit_price, pricing_unit, ' +
  'dietary_labels, tier, quantity, line_total, source), ' +
  'history:enquiry_status_history(id, from_status, to_status, created_at)'

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * `draft` is the wizard state: { event, dishes: [{ dish_id, quantity }], contact }.
 * Only ids, quantities and source ('ai' for accepted suggestions) are sent for dishes –
 * names and prices come from the database.
 */
export function submitEnquiry(draft) {
  return run(
    supabase.rpc('submit_enquiry', {
      payload: {
        event: draft.event,
        contact: draft.contact,
        dishes: draft.dishes.map(({ dish_id, quantity, source }) => ({
          dish_id,
          quantity: Number(quantity),
          source: source === 'ai' ? 'ai' : 'customer',
        })),
      },
    }),
  )
}

export function cancelEnquiry(id) {
  return run(supabase.rpc('cancel_enquiry', { p_enquiry_id: id }))
}

/** RLS limits customers to their own rows; the explicit filter keeps an admin's own list personal too. */
export function listMyEnquiries(userId, { limit } = {}) {
  let query = supabase
    .from('enquiries')
    .select(LIST_COLUMNS)
    .eq('customer_id', userId)
    .order('submitted_at', { ascending: false })
  if (limit) query = query.limit(limit)
  return run(query)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getEnquiry(id) {
  const notFound = Object.assign(new Error('Enquiry not found.'), { code: 'PGRST116' })
  if (!UUID_RE.test(id)) throw notFound
  const data = await run(
    supabase
      .from('enquiries')
      .select(DETAIL_COLUMNS)
      .eq('id', id)
      .order('created_at', { referencedTable: 'menu_selections' })
      .order('created_at', { referencedTable: 'enquiry_status_history' })
      .maybeSingle(),
  )
  if (!data) throw notFound
  return data
}
