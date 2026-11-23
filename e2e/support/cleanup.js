import { pathToFileURL } from 'node:url'
import { ACCOUNTS, adminDb, findUserId } from './env.js'

/**
 * Deletes everything the E2E customer owns: quotations (and their versions, items and
 * notifications), then enquiries (and their menus, history, notes and notifications), then
 * the customer's own notifications. Requires migration 20261128090000_server_cleanup_deletes.sql,
 * which lets the server role delete sent quotation versions.
 *
 * With `removeAccount`, the E2E customer's login is deleted too (the profile cascades).
 * The test admin is never deleted here; see the pre-launch checklist in the README.
 */
export async function cleanupE2eData({ removeAccount = false, log = console.log } = {}) {
  const customer = await findUserId(ACCOUNTS.customer.email)
  if (!customer) {
    log('E2E cleanup: no E2E customer account, nothing to remove.')
    return
  }
  if (customer.role !== 'customer') throw new Error(`Refusing to clean up ${ACCOUNTS.customer.email}: it is not a customer account.`)

  const { data: enquiries, error } = await adminDb.from('enquiries').select('id, enquiry_number').eq('customer_id', customer.id)
  if (error) throw error

  if (enquiries.length) {
    const ids = enquiries.map((e) => e.id)
    const q = await adminDb.from('quotations').delete().in('enquiry_id', ids).select('id')
    if (q.error) {
      throw new Error(
        `Couldn't delete E2E quotations: ${q.error.message}. Has supabase/migrations/20261128090000_server_cleanup_deletes.sql been applied?`,
      )
    }
    const en = await adminDb.from('enquiries').delete().in('id', ids)
    if (en.error) throw new Error(`Couldn't delete E2E enquiries: ${en.error.message}`)
    log(`E2E cleanup: removed ${enquiries.length} enquiries (${enquiries.map((e) => e.enquiry_number).join(', ')}) and ${q.data.length} quotations.`)
  } else {
    log('E2E cleanup: no E2E enquiries to remove.')
  }

  const n = await adminDb.from('notifications').delete().eq('recipient_id', customer.id)
  if (n.error) throw new Error(`Couldn't delete E2E notifications: ${n.error.message}`)

  if (removeAccount) {
    const { error: delError } = await adminDb.auth.admin.deleteUser(customer.id)
    if (delError) throw new Error(`Couldn't delete the E2E customer account: ${delError.message}`)
    log(`E2E cleanup: deleted the account ${ACCOUNTS.customer.email}.`)
  }
}

// `node e2e/support/cleanup.js [--remove-account]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cleanupE2eData({ removeAccount: process.argv.includes('--remove-account') }).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
