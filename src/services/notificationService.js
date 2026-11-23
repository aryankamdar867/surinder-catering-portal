import { supabase } from '@/lib/supabase.js'

// In-app notifications. Rows are created only by database functions; RLS limits every
// query to the signed-in user's own notifications. Users can mark them read (the
// database stamps the time and never un-reads) and delete them.

const COLUMNS = 'id, type, title, body, link, enquiry_id, quotation_id, read_at, created_at'

async function run(query) {
  const { data, error, count } = await query
  if (error) throw error
  return count ?? data
}

/** Newest first. `before` is an ISO timestamp for "load more". */
export function listNotifications({ unreadOnly = false, limit = 20, before } = {}) {
  let query = supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (unreadOnly) query = query.is('read_at', null)
  if (before) query = query.lt('created_at', before)
  return run(query)
}

export async function countUnread() {
  return (await run(supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null))) ?? 0
}

export function markRead(id) {
  return run(supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null))
}

export function markAllRead() {
  return run(supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null))
}

export function deleteNotification(id) {
  return run(supabase.from('notifications').delete().eq('id', id))
}

/**
 * Live updates for one user (Realtime applies RLS). `onReady` fires once the feed is
 * actually delivering changes (about half a second after joining), so callers can
 * reload anything created in between. Returns an unsubscribe function.
 */
export function subscribeToNotifications(userId, { onInsert, onUpdate, onReady }) {
  const filter = `recipient_id=eq.${userId}`
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter }, (p) => onInsert?.(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter }, (p) => onUpdate?.(p.new))
    .on('system', {}, (message) => {
      if (message?.status === 'ok') onReady?.()
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

/** Only follow links inside this app ("/account/…", "/admin/…"), never external URLs. */
export const safeInternalLink = (link) =>
  typeof link === 'string' && /^\/(?![/\\])[^\s]*$/.test(link) ? link : null
