import { readFileSync } from 'node:fs'
import { test as base, expect } from '@playwright/test'

export const authFile = (role) => `e2e/.auth/${role}.json`
export const sessionOf = (role) => JSON.parse(readFileSync(`e2e/.auth/${role}.session.json`, 'utf8'))

/**
 * Fails any test whose page reports a Content-Security-Policy violation or an uncaught
 * error, so a header that blocks something the app needs is caught here, not in production.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Content[- ]Security[- ]Policy|Refused to/i.test(msg.text())) problems.push(`CSP: ${msg.text()}`)
    })
    page.on('pageerror', (err) => problems.push(`Uncaught: ${err.message}`))
    await use(page)
    expect(problems, 'CSP violations or uncaught errors on the page').toEqual([])
  },
})

export { expect }

/** True when the page is wider than the viewport (sideways scrolling on a phone). */
export async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement
    if (root.scrollWidth <= root.clientWidth + 1) return null
    // Name the widest offenders to make failures actionable.
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1)
      .filter((el) => !el.closest('[data-allow-overflow]'))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''}`)
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, offenders }
  })
}
