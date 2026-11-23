import { authFile, expect, horizontalOverflow, test } from './support/fixtures.js'

// Every main page must fit the screen: no sideways scrolling, a visible page heading.
// Runs on desktop and on a phone (Pixel 7, 412px wide) — see playwright.config.js.

const PAGES = {
  guest: ['/', '/login', '/register', '/forgot-password', '/admin/login', '/no-such-page'],
  customer: ['/account', '/account/menu', '/account/enquiries', '/account/enquiries/new', '/account/notifications', '/account/profile'],
  admin: ['/admin', '/admin/enquiries', '/admin/dishes', '/admin/dishes/new', '/admin/catalogue', '/admin/notifications'],
}

async function checkFits(page, path) {
  await page.goto(path)
  await expect(page.locator('h1').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(await horizontalOverflow(page), `${path} scrolls sideways`).toBeNull()
}

for (const [role, paths] of Object.entries(PAGES)) {
  test.describe(`${role} pages fit the screen`, () => {
    if (role !== 'guest') test.use({ storageState: authFile(role) })
    for (const path of paths) test(path, ({ page }) => checkFits(page, path))
  })
}

test.describe('phone navigation', () => {
  test.use({ storageState: authFile('customer') })

  test('every customer section is reachable from the navigation', async ({ page, isMobile }) => {
    await page.goto('/account')
    await expect(page.locator('h1').first()).toBeVisible()
    for (const name of ['Dashboard', 'Enquiries', 'Menu', 'Profile']) {
      const link = page.getByRole('link', { name, exact: true }).locator('visible=true').first()
      await expect(link, `"${name}" link visible${isMobile ? ' on a phone' : ''}`).toBeVisible()
    }
    // Customers reach notifications through the bell.
    await page.getByRole('button', { name: /^Notifications/ }).locator('visible=true').first().click()
    const panel = page.getByRole('region', { name: 'Notifications', exact: true })
    await expect(panel).toBeVisible()
    const box = await panel.boundingBox()
    const width = page.viewportSize().width
    expect(box.x, 'panel starts on screen').toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, 'panel ends on screen').toBeLessThanOrEqual(width)
  })
})
