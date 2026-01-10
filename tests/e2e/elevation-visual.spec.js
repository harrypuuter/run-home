import { test, expect } from '@playwright/test'

// Fast visual regression test for elevation profile (desktop + mobile)
// Uses Debug's Sample Route for determinism and stubs Open-Meteo dynamically

test('elevation profile visual regression (desktop + mobile)', async ({ page }) => {
  // Keep the test fast: short timeouts and deterministic stubs
  test.setTimeout(30000)

  // Stub Open-Meteo to reply quickly and return the correct batch size
  await page.route('https://api.open-meteo.com/v1/elevation*', route => {
    try {
      const url = new URL(route.request().url())
      const latParam = url.searchParams.get('latitude') || ''
      const count = latParam ? latParam.split(',').length : 1
      const body = { elevation: Array(count).fill(120) }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    } catch (e) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elevation: [120] }) })
    }
  })

  // Ensure OSRM calls (if any) are fast and deterministic
  await page.route('**/routed-*/route/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'Ok', routes: [ { distance: 5200, duration: 1800, geometry: { type: 'LineString', coordinates: [] } } ] })
    })
  })

  await page.goto('/run-home/debug', { waitUntil: 'networkidle' })

  // Require the sample button to be present quickly — this keeps the test fast
  const sampleBtn = page.getByRole('button', { name: /Use Sample Route/i })
  await sampleBtn.waitFor({ state: 'visible', timeout: 3000 })

  const viewports = [ { width: 1024, height: 768 }, { width: 390, height: 844 } ]

  for (const vp of viewports) {
    await page.setViewportSize(vp)

    // Click the sample route which seeds a deterministic route and opens the details panel
    await sampleBtn.click()

    // Short, optimistic waits so the test stays fast
    const canvasSelector = 'canvas[data-testid="elevation-canvas"]'

    // Wait for either the details panel or the canvas to appear, but keep timeout small
    await Promise.race([
      page.getByLabel('Close route details').waitFor({ timeout: 3000 }).catch(() => {}),
      page.waitForSelector(canvasSelector, { timeout: 3000, state: 'attached' }).catch(() => {}),
    ])

    // Require a painted canvas quickly
    await page.waitForFunction((sel) => {
      const c = document.querySelector(sel)
      if (!c) return false
      if (c.width === 0 || c.height === 0) return false
      try {
        const data = c.toDataURL()
        return data && data.length > 1000
      } catch (e) {
        return false
      }
    }, canvasSelector, { timeout: 3000 })

    const canvas = page.locator(canvasSelector).first()

    // Small stabilization pause
    await page.waitForTimeout(100)

    // Compare screenshot (size-specific filename)
    await expect(canvas).toHaveScreenshot(`elevation-profile-${vp.width}x${vp.height}.png`, { timeout: 5000 })
  }
})
