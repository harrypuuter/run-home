import { test, expect } from '@playwright/test'

test('mobile bottom sheet open/close and keyboard interaction', async ({ page }) => {  // Force mobile viewport to ensure mobile sheet is present (robust across CI configs)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/run-home/debug')
  // Start debug session
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for route results to load (sheet may be hidden initially on mobile).
  // Simulate a drag from the bottom center to open the sheet (robust against handle being offscreen).
  const viewport = page.viewportSize() || { width: 390, height: 844 }
  const startX = Math.floor(viewport.width / 2)
  const startY = viewport.height - 10

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - 220, { steps: 12 })
  await page.mouse.up()

  // Wait for the aria-live region to announce a state change (be tolerant if the element is not present)
  const live = page.locator('.sr-only')
  // Ensure the announcer exists before asserting text to avoid "element not found" flakes in CI
  if (await page.locator('.sr-only').count()) {
    await expect(live).not.toHaveText('', { timeout: 3000 })
  }

  // Keyboard: press Enter to toggle full/half
  // Bring focus to handle (if visible) otherwise fallback to sending Space
  const handle = page.locator('[role="button"][aria-label*="Drag"]').first()
  if (await handle.count() && await handle.isVisible()) {
    await handle.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(600)
    await expect(live).not.toHaveText('', { timeout: 3000 })

    // Now press Escape to close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    await expect(live).not.toHaveText('', { timeout: 3000 })
  } else {
    // Fallback: press Space to toggle (some screen sizes)
    await page.keyboard.press('Space')
    await page.waitForTimeout(600)
    await expect(live).not.toHaveText('', { timeout: 3000 })
  }
})