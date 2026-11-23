import { mkdirSync, writeFileSync } from 'node:fs'
import { BASE_URL } from '../../playwright.config.js'
import { ACCOUNTS, AUTH_STORAGE_KEY, adminDb, createSession, findUserId } from './env.js'
import { cleanupE2eData } from './cleanup.js'

export const AUTH_DIR = 'e2e/.auth'

/** Playwright storage state that puts a Supabase session in the app's localStorage. */
function storageState(session) {
  return {
    cookies: [],
    origins: [{ origin: BASE_URL, localStorage: [{ name: AUTH_STORAGE_KEY, value: JSON.stringify(session) }] }],
  }
}

async function ensureCustomer() {
  const { email, fullName, phone } = ACCOUNTS.customer
  if (await findUserId(email)) return
  const { error } = await adminDb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  })
  if (error) throw new Error(`Couldn't create the E2E customer: ${error.message}`)
}

export default async function globalSetup() {
  const admin = await findUserId(ACCOUNTS.admin.email)
  if (admin?.role !== 'admin') throw new Error(`${ACCOUNTS.admin.email} must exist and be an admin to run the E2E tests.`)

  await ensureCustomer()
  // Start from a clean slate in case an earlier run crashed before its teardown. Leftovers
  // don't affect the tests (each run works only with what it creates), so only warn here;
  // the teardown fails loudly if it can't clean up.
  await cleanupE2eData().catch((err) => console.warn(`Warning: ${err.message}`))

  mkdirSync(AUTH_DIR, { recursive: true })
  for (const role of ['admin', 'customer']) {
    const session = await createSession(ACCOUNTS[role].email)
    writeFileSync(`${AUTH_DIR}/${role}.json`, JSON.stringify(storageState(session)))
    writeFileSync(`${AUTH_DIR}/${role}.session.json`, JSON.stringify(session))
  }
}
