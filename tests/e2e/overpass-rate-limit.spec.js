import { test, expect } from '@playwright/test'

// Simulate Overpass rate limit and ensure user sees helpful error
test('shows user-friendly message when Overpass API rate limits', async ({ page }) => {
  // Intercept Overpass requests and return 429
  await page.route('https://overpass-api.de/api/interpreter', route => {
    route.fulfill({ status: 429, body: 'Too Many Requests' })
  })

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/run-home/debug')
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for the error message to be shown in the UI
  const err = page.getByText(/Overpass API is currently rate-limiting requests/i)
  await expect(err).toBeVisible({ timeout: 10000 })
})