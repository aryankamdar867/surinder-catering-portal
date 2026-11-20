import { supabase } from '@/lib/supabase.js'

const PROFILE_COLUMNS = 'id, email, full_name, phone, address, company_name, gst_number, role, created_at, updated_at'

// Columns a user may edit. `role` and `email` are protected by the database.
const EDITABLE = ['full_name', 'phone', 'address', 'company_name', 'gst_number']

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, changes) {
  const payload = Object.fromEntries(Object.entries(changes).filter(([key]) => EDITABLE.includes(key)))
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw error
  return data
}
