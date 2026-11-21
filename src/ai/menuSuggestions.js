import { supabase } from '@/lib/supabase.js'

// Calls the server-side /api/menu-suggestions function (the AI key never reaches the browser).
// The server returns dish ids from the live catalogue only; prices always come from the database.

/**
 * @param {{ event: object, contact: object, dishes: { dish_id: string }[] }} draft wizard state
 * @returns {Promise<{ summary: string, notes: string, dishes: { dish_id: string, reason: string }[], remaining: number|null }>}
 */
export async function getMenuSuggestions(draft, { signal } = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Your session has expired. Please sign in again.')

  const { event, contact } = draft
  let response
  try {
    response = await fetch('/api/menu-suggestions', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        event: {
          event_type: event.event_type,
          event_type_other: event.event_type_other,
          guest_count: Number(event.guest_count),
          service_type: event.service_type,
          cuisine_preferences: event.cuisine_preferences,
          dietary_requirements: event.dietary_requirements,
          special_instructions: event.special_instructions,
        },
        budget: {
          per_person_budget: contact.per_person_budget,
          total_budget: contact.total_budget,
          budget_flexibility: contact.budget_flexibility,
        },
        selected_dish_ids: draft.dishes.map((d) => d.dish_id),
      }),
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('Network error. Check your internet connection and try again.', { cause: err })
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? 'Menu suggestions are unavailable right now. Please try again shortly.')
  }
  return body
}
