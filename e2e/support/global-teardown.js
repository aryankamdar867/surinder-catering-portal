import { rmSync } from 'node:fs'
import { cleanupE2eData } from './cleanup.js'
import { AUTH_DIR } from './global-setup.js'

export default async function globalTeardown() {
  // Keep the data for debugging with E2E_KEEP_DATA=1; remove it otherwise.
  if (!process.env.E2E_KEEP_DATA) await cleanupE2eData()
  // Session tokens are short-lived, but don't leave them lying around.
  rmSync(AUTH_DIR, { recursive: true, force: true })
}
