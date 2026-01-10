import { test, expect } from '@playwright/test'

// Visual regression test for elevation profile
test('elevation profile visual regression', async ({ page }) => {
  // Force mobile size for consistent rendering (choose a desktop width for more stable canvas width)
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/run-home/debug')

  // Use the sample route button to ensure a deterministic route is selected and the elevation panel opens
  await page.getByRole('button', { name: /Use Sample Route/i }).click()

  // Wait for the Route Details panel to appear (debug seed selects the first route)
  await page.getByLabel('Close route details').waitFor({ timeout: 15000 })

  // Wait for the elevation canvas to be attached (may be present but initially 0-width on CI)
  const canvasSelector = 'canvas[data-testid="elevation-canvas"]'
  await page.waitForSelector(canvasSelector, { timeout: 60000, state: 'attached' })

  // Wait until the canvas has non-empty image data (toDataURL length check)
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
  }, canvasSelector, { timeout: 60000 })
  const canvas = page.locator(canvasSelector).first()

  // Wait a moment to allow final paints/gradients
  await page.waitForTimeout(1000)

  // Match screenshot (Playwright will store snapshot under test-results by default)
  // Increase timeout for CI runners where rendering may be slower
  await expect(canvas).toHaveScreenshot('elevation-profile.png', { timeout: 30000 })
})
