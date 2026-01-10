import { test, expect } from '@playwright/test'

// Visual regression test for elevation profile
test('elevation profile visual regression', async ({ page }) => {
  // Force mobile size for consistent rendering (choose a desktop width for more stable canvas width)
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/run-home/debug')

  // Start debug session
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for at least one route card to appear and select the first route (ensures elevation panel can be opened)
  const firstRouteButton = page.locator('button', { hasText: 'km' }).first()
  // Fallback: wait for canvas directly if route buttons are not present
  await page.waitForSelector('canvas', { timeout: 10000 })

  // Click the first route card if available to show details/elevation
  if (await firstRouteButton.count()) {
    await firstRouteButton.click()
  }

  // Wait for the elevation canvas to be present and painted
  const canvasSelector = 'canvas[data-testid="elevation-canvas"]'
  await page.waitForSelector(canvasSelector, { timeout: 30000 })

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
  }, canvasSelector, { timeout: 30000 })

  const canvas = page.locator(canvasSelector).first()

  // Wait a moment to allow final paints/gradients
  await page.waitForTimeout(1000)

  // Match screenshot (Playwright will store snapshot under test-results by default)
  // Increase timeout for CI runners where rendering may be slower
  await expect(canvas).toHaveScreenshot('elevation-profile.png', { timeout: 30000 })
})
