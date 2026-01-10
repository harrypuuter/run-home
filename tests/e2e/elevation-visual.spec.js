import { test, expect } from '@playwright/test'
import { setupApiMocks } from './fixtures/api-mocks.js'

// Smoke test: verify debug session starts and routes are calculated
// This is a fast, reliable check that the core algorithm runs.

test('elevation profile smoke test (desktop + mobile)', async ({ page }) => {
  // Setup API mocks to avoid rate limiting and ensure consistent results
  await setupApiMocks(page)

  const viewports = [{ width: 1024, height: 768 }, { width: 390, height: 844 }]

  for (const vp of viewports) {
    await page.setViewportSize(vp)
    await page.goto('/run-home/debug', { waitUntil: 'networkidle' })

    // Click Start Debug Session
    await page.getByRole('button', { name: /Start Debug Session/i }).click()

    // Wait for the loading spinner to disappear or for route cards to appear
    await page.waitForFunction(() => {
      const spinnerGone = !document.querySelector('.animate-spin')
      const hasRouteCard = Array.from(document.querySelectorAll('button')).some(b => /[0-9].*km/i.test(b.textContent || ''))
      return spinnerGone && hasRouteCard
    }, {}, { timeout: 15000 })

    // Assert at least one route card button exists (contains distance like "5.0 km")
    const routeCards = page.locator('button', { hasText: /[0-9].*km/i })
    await expect(routeCards.first()).toBeAttached({ timeout: 5000 })
  }
})
