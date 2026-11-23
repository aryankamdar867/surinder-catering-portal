import { readFileSync } from 'node:fs'
import { authFile, expect, horizontalOverflow, sessionOf, test } from './support/fixtures.js'
import { E2E_TAG, userDb } from './support/env.js'

// The whole story, through the real UI: a customer sends an enquiry, the owner reviews it
// and sends a per-person quotation, the customer gets notified, downloads the PDF and
// accepts, and the owner sees the confirmed event. Everything is removed afterwards
// (global teardown), because the E2E customer owns all of it.

const isoInIndia = (days) => {
  const d = new Date(Date.now() + days * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d) // YYYY-MM-DD
}

const GUESTS = 120
const RATE = 850
const VENUE = `${E2E_TAG} Playwright Hall`

test.describe.configure({ mode: 'serial' })

const shared = {}

/** The page also fits a phone screen (412px wide, like the mobile project). */
async function fitsOnPhone(page, what) {
  const desktop = page.viewportSize()
  await page.setViewportSize({ width: 412, height: 915 })
  await page.waitForTimeout(300)
  expect(await horizontalOverflow(page), `${what} scrolls sideways on a phone`).toBeNull()
  await page.setViewportSize(desktop)
}

test.describe('enquiry to confirmed event', () => {
  test('customer sends an enquiry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile('customer') })
    const page = await context.newPage()

    await page.goto('/account/enquiries/new')
    await expect(page.getByRole('heading', { name: 'Tell us about your event' })).toBeVisible()

    // Step 1: event
    await page.getByLabel('Type of event', { exact: true }).selectOption('wedding')
    await page.getByLabel('Date', { exact: true }).fill(isoInIndia(45))
    await page.getByLabel('Number of guests', { exact: true }).fill(String(GUESTS))
    await page.getByLabel('Venue name', { exact: true }).fill(VENUE)
    await page.getByRole('radio', { name: /Buffet/ }).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: menu – pick two dishes from the live catalogue
    const addButtons = page.getByRole('button', { name: /^Add / })
    await expect(addButtons.first()).toBeVisible()
    await addButtons.nth(0).click()
    await addButtons.nth(0).click() // the first one became "Remove", so this is the next dish
    await expect(page.getByRole('list', { name: 'Selected dishes' }).getByRole('listitem')).toHaveCount(2)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: contact (name and phone come from the profile)
    await expect(page.getByLabel('Contact name', { exact: true })).not.toHaveValue('')
    await page.getByLabel('Phone', { exact: true }).fill('+91 98765 43210')
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 4: review and send
    await expect(page.getByRole('heading', { name: 'Review your enquiry' })).toBeVisible()
    await expect(page.getByText(VENUE)).toBeVisible()
    await page.getByRole('button', { name: 'Send enquiry' }).click()

    await expect(page).toHaveURL(/\/account\/enquiries\/[0-9a-f-]{36}$/)
    shared.enquiryId = page.url().split('/').pop()
    await expect(page.getByText('Submitted').first()).toBeVisible()
    await fitsOnPhone(page, 'customer enquiry detail')
    await context.close()
  })

  test('owner reviews it and sends a quotation', async ({ browser }) => {
    test.skip(!shared.enquiryId, 'needs the enquiry from the previous step')
    const context = await browser.newContext({ storageState: authFile('admin') })
    const page = await context.newPage()

    await page.goto('/admin/enquiries')
    await expect(page.getByText(VENUE).or(page.getByText('E2E Test Customer')).first()).toBeVisible()

    await page.goto(`/admin/enquiries/${shared.enquiryId}`)
    await page.getByRole('button', { name: 'Start review' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Mark under review' }).click()
    await expect(page.getByText('Under review').first()).toBeVisible()
    await fitsOnPhone(page, 'owner enquiry detail')

    await page.getByRole('button', { name: 'Create quotation' }).click()
    await expect(page).toHaveURL(/\/admin\/quotations\/[0-9a-f-]{36}$/)
    shared.quotationId = page.url().split('/').pop()
    await expect(page.getByRole('heading', { name: 'Pricing' })).toBeVisible()
    await fitsOnPhone(page, 'quotation editor')

    await page.getByRole('radio', { name: /Per person/ }).check()
    await page.getByLabel('Guests', { exact: true }).fill(String(GUESTS))
    await page.getByLabel('Rate per person (₹)', { exact: true }).fill(String(RATE))
    await page.getByLabel('Valid until', { exact: true }).fill(isoInIndia(14))
    await page.getByLabel(/^Note to the customer/).fill(`${E2E_TAG} automated test quotation`)

    await page.getByRole('button', { name: 'Send to customer' }).click()
    const dialog = page.getByRole('dialog')
    shared.totalText = (await dialog.getByText(/^Total ₹/).textContent()).replace(/^Total /, '').trim()
    await dialog.getByRole('button', { name: /^(Save and send|Send)$/ }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Withdraw' }).or(page.getByRole('button', { name: /Revise/ })).first()).toBeVisible()
    await context.close()
  })

  test('customer is notified, downloads the PDF and accepts', async ({ browser }) => {
    test.skip(!shared.quotationId, 'needs the quotation from the previous step')
    const context = await browser.newContext({ storageState: authFile('customer') })
    const page = await context.newPage()

    await page.goto('/account/notifications')
    await expect(page.getByRole('main').getByText(/quotation/i).first()).toBeVisible()

    await page.goto(`/account/enquiries/${shared.enquiryId}`)
    await page.locator(`a[href="/account/quotations/${shared.quotationId}"]`).click()
    await expect(page).toHaveURL(new RegExp(`/account/quotations/${shared.quotationId}$`))
    await expect(page.getByText(shared.totalText).first()).toBeVisible()
    await fitsOnPhone(page, 'customer quotation')

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).first().click()])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    const pdf = readFileSync(await download.path())
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(5_000)

    await page.getByRole('button', { name: 'Accept quotation' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Accept and confirm' }).click()
    await expect(page.getByText('Confirmed').first()).toBeVisible()
    await context.close()
  })

  test('owner sees the confirmed event', async ({ browser }) => {
    test.skip(!shared.quotationId, 'needs the accepted quotation')
    const context = await browser.newContext({ storageState: authFile('admin') })
    const page = await context.newPage()
    await page.goto(`/admin/enquiries/${shared.enquiryId}`)
    await expect(page.getByText('Confirmed').first()).toBeVisible()
    await page.goto('/admin/notifications')
    await expect(page.getByRole('main').getByText(/accepted/i).first()).toBeVisible()
    await context.close()
  })

  test('the accepted quotation is locked against customer edits', async () => {
    test.skip(!shared.quotationId, 'needs the accepted quotation')
    const db = userDb(sessionOf('customer'))
    const { data: versions } = await db.from('quotation_versions').select('id, total_amount').eq('quotation_id', shared.quotationId)
    expect(versions.length).toBeGreaterThan(0)
    const { error } = await db.from('quotation_versions').update({ total_amount: 1 }).eq('id', versions[0].id)
    const { data: after } = await db.from('quotation_versions').select('total_amount').eq('id', versions[0].id).single()
    expect(Number(after.total_amount)).toBe(Number(versions[0].total_amount))
    expect(error ?? 'blocked silently by RLS').toBeTruthy()
  })
})
