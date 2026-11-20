import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  )
}

// Guard against accidentally shipping a privileged key to the browser.
if (supabaseKey.startsWith('sb_secret_') || supabaseKey.includes('service_role')) {
  throw new Error('A Supabase secret/service-role key must never be used in the frontend. Use the publishable key.')
}

/** Browser Supabase client. All data access is enforced by Row Level Security. */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
