import { test, expect } from '@playwright/test'
import { setupApiMocks } from './fixtures/api-mocks.js'

// Smoke test: verify debug session starts and routes are calculated
test('route editor smoke test', async ({ page }) => {
  // Setup API mocks to avoid rate limiting and ensure consistent results
  await setupApiMocks(page)

  await page.goto('/run-home/debug', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for routes to load (a route card button with distance)
  await page.waitForFunction(() => {
    const spinnerGone = !document.querySelector('.animate-spin')
    const hasRouteCard = Array.from(document.querySelectorAll('button')).some(b => /\d.*km/i.test(b.textContent || ''))
    return spinnerGone && hasRouteCard
  }, {}, { timeout: 20000 })

  // Verify at least one route card button exists
  const routeCards = page.locator('button', { hasText: /\d.*km/i })
  await expect(routeCards.first()).toBeAttached({ timeout: 5000 })
})
