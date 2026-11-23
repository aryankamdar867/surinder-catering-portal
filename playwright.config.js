import { defineConfig, devices } from '@playwright/test'

// End-to-end tests. They run against the PRODUCTION BUILD (`vite preview`), which serves
// /api like Vercel and sends the same security headers as vercel.json, and they talk to the
// live Supabase project as the test accounts. Everything they create is removed by
// `npm run test:e2e:cleanup` (also run automatically at the end of every run).
const PORT = 4173
export const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.js',
  globalTeardown: './e2e/support/global-teardown.js',
  // The flow test is one long story against shared live data; keep runs serial and predictable.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Phone layout checks only (the flow test runs once, on desktop).
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.js/ },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
