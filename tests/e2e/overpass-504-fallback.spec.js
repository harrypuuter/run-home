import { test, expect } from '@playwright/test'

// Verify that when the primary Overpass host returns 504, the app falls back to an alternate and succeeds
test('falls back to alternate Overpass endpoint when primary returns 504', async ({ page }) => {
  // Simulate primary returning 504
  await page.route('https://overpass-api.de/api/interpreter', route => {
    route.fulfill({ status: 504, body: 'Gateway Timeout' })
  })

  // Simulate alternate returning a valid Overpass JSON response
  await page.route('https://lz4.overpass-api.de/api/interpreter', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        elements: [
          { id: 1, lat: 52.5208, lon: 13.4094, tags: { name: 'Fallback Station', railway: 'station' } }
        ]
      })
    })
  })

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/run-home/debug')
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for the station from the fallback to appear in the UI
  const station = page.getByText(/Fallback Station/i)
  await expect(station).toBeVisible({ timeout: 10000 })
})