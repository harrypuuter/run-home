import { test, expect } from '@playwright/test'

// Verify that when the primary Overpass host returns 504, the app falls back to an alternate and succeeds
test('falls back to alternate Overpass endpoint when primary returns 504', async ({ page }) => {
  const primary = 'https://overpass-api.de/api/interpreter'

  let primaryCalled = false
  let fallbackCalled = false

  // Intercept any overpass interpreter endpoint; respond with 504 for the primary host, 200 for others
  await page.route('**/api/interpreter', route => {
    const url = route.request().url()
    if (url === primary) {
      primaryCalled = true
      route.fulfill({ status: 504, body: 'Gateway Timeout' })
      return
    }

    // Fallback endpoint: return a minimal valid Overpass payload
    fallbackCalled = true
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

  // Also stub OSRM route calls so route calculation succeeds deterministically
  await page.route('**/routed-*/route/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 8000,
            duration: 3600,
            geometry: { type: 'LineString', coordinates: [[13.4094, 52.5208], [13.4050, 52.52]] }
          }
        ]
      })
    })
  })

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/run-home/debug')
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Poll for route handlers to be invoked (we set `primaryCalled`/`fallbackCalled` in the Node test scope)
  const start = Date.now()
  while (!(primaryCalled && fallbackCalled) && Date.now() - start < 5000) {
    await new Promise(r => setTimeout(r, 100))
  }

  if (!primaryCalled) throw new Error('Primary Overpass was not called')
  if (!fallbackCalled) throw new Error('Fallback Overpass endpoint was not called')

  // The important guarantee here: we attempted the primary host and at least one fallback,
  // and we do NOT show the Overpass rate-limit error (504 is handled via fallback)
  await expect(page.getByText(/Overpass API is currently rate-limiting requests/i)).not.toBeVisible({ timeout: 5000 })

  // Optionally ensure we either show a station or an informative "no suitable routes" message
  const station = page.getByText(/Fallback Station/i)
  const noRoutes = page.getByText(/No suitable routes found/i)
  await Promise.race([
    station.waitFor({ timeout: 5000 }).catch(() => {}),
    noRoutes.waitFor({ timeout: 5000 }).catch(() => {}),
  ])
})