import { authFile, expect, sessionOf, test } from './support/fixtures.js'
import { userDb } from './support/env.js'

test.describe('security headers', () => {
  for (const path of ['/', '/login', '/account/enquiries']) {
    test(`are sent on ${path}`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(200)
      const h = res.headers()
      expect(h['content-security-policy']).toContain("default-src 'self'")
      expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(h['content-security-policy']).not.toContain('unsafe-eval')
      expect(h['x-frame-options']).toBe('DENY')
      expect(h['x-content-type-options']).toBe('nosniff')
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(h['strict-transport-security']).toContain('max-age=')
      expect(h['permissions-policy']).toContain('camera=()')
    })
  }
})

test.describe('route protection (signed out)', () => {
  test('customer pages send visitors to the customer login', async ({ page }) => {
    await page.goto('/account/enquiries')
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fenquiries$/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('owner pages send visitors to the owner login', async ({ page }) => {
    await page.goto('/admin/enquiries')
    await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fenquiries$/)
    await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible()
  })
})

test.describe('as a customer', () => {
  test.use({ storageState: authFile('customer') })

  for (const redirect of ['https://evil.example/', '//evil.example/', '/\\evil.example/']) {
    test(`login ignores an off-site redirect (${redirect})`, async ({ page }) => {
      await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/account$/)
    })
  }

  test('login follows an in-app redirect', async ({ page }) => {
    await page.goto(`/login?redirect=${encodeURIComponent('/account/menu')}`)
    await expect(page).toHaveURL(/\/account\/menu$/)
  })

  test('the owner area is refused', async ({ page }) => {
    await page.goto('/admin/enquiries')
    await expect(page.getByRole('heading', { name: 'Owner access only' })).toBeVisible()
  })

  test('the database refuses owner-only data and self-promotion', async () => {
    const session = sessionOf('customer')
    const db = userDb(session)

    // Other customers' profiles are invisible.
    const { data: profiles } = await db.from('profiles').select('id')
    expect(profiles.map((p) => p.id)).toEqual([session.user.id])

    // Internal notes are owner-only.
    const { data: notes } = await db.from('admin_notes').select('id').limit(1)
    expect(notes ?? []).toEqual([])

    // A customer can't make themselves an admin.
    await db.from('profiles').update({ role: 'admin' }).eq('id', session.user.id)
    const { data: me } = await db.from('profiles').select('role').eq('id', session.user.id).single()
    expect(me.role).toBe('customer')
  })
})

test.describe('API endpoints', () => {
  const uuid = '00000000-0000-4000-8000-000000000000'

  test('the PDF endpoint needs a session', async ({ request }) => {
    const res = await request.get(`/api/quotation-pdf?quotation=${uuid}&version=${uuid}`)
    expect(res.status()).toBe(401)
    expect(res.headers()['cache-control']).toContain('no-store')
  })

  test('the PDF endpoint rejects a forged token', async ({ request }) => {
    const res = await request.get(`/api/quotation-pdf?quotation=${uuid}&version=${uuid}`, {
      headers: { authorization: 'Bearer not-a-real-token' },
    })
    expect([401, 404]).toContain(res.status())
  })

  test('the PDF endpoint hides quotations the caller cannot see', async ({ request }) => {
    const res = await request.get(`/api/quotation-pdf?quotation=${uuid}&version=${uuid}`, {
      headers: { authorization: `Bearer ${sessionOf('customer').access_token}` },
    })
    expect(res.status()).toBe(404)
  })

  test('the menu suggestion endpoint needs a session', async ({ request }) => {
    const res = await request.post('/api/menu-suggestions', { data: {} })
    expect(res.status()).toBe(401)
  })

  test('unknown API routes are a plain 404', async ({ request }) => {
    expect((await request.get('/api/does-not-exist')).status()).toBe(404)
    expect((await request.get('/api/..%2Fvite.config')).status()).toBe(404)
  })
})
