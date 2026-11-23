import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

// Server-side helpers for the end-to-end tests (Node only, never bundled into the app).
// The secret key is read from .env.local and used only here: to create test sessions and
// to delete test data. It never reaches the browser under test.

const env = loadEnv('production', process.cwd(), '')

export const SUPABASE_URL = env.VITE_SUPABASE_URL
const PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY
const SECRET_KEY = env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  throw new Error('E2E tests need VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in .env.local.')
}

/** The accounts the tests sign in as. Both are on example.com and exist only for testing. */
export const ACCOUNTS = {
  admin: { email: 'surinder-test-admin@example.com' },
  customer: { email: 'e2e.customer@example.com', fullName: 'E2E Test Customer', phone: '+91 98765 43210' },
}

/** Every enquiry the tests submit carries this in the venue name, so leftovers are easy to spot. */
export const E2E_TAG = '[E2E]'

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

export const adminDb = createClient(SUPABASE_URL, SECRET_KEY, noSession)

/** localStorage key supabase-js uses for the session: sb-<project ref>-auth-token. */
export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

/**
 * Signs in without a password or an email: the secret key mints a magic-link token and
 * the public client redeems it, exactly as clicking the emailed link would.
 */
export async function createSession(email) {
  const { data, error } = await adminDb.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink(${email}): ${error.message}`)
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, noSession)
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError) throw new Error(`verifyOtp(${email}): ${verifyError.message}`)
  return verified.session
}

/** A Supabase client acting as a given signed-in user (RLS applies), for API-level checks. */
export function userDb(session) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
}

export async function findUserId(email) {
  const { data, error } = await adminDb.from('profiles').select('id, role').eq('email', email).maybeSingle()
  if (error) throw error
  return data
}
