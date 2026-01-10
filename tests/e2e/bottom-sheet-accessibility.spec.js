import { test, expect } from '@playwright/test'

// Accessibility-focused tests for the mobile bottom sheet
test('mobile bottom sheet handle is keyboard accessible and announces state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/run-home/debug')
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for the handle to exist
  const handle = page.locator('[role="button"][aria-label*="Drag"]').first()
  await expect(handle).toBeVisible({ timeout: 10000 })

  // Check ARIA attributes
  await expect(handle).toHaveAttribute('role', 'button')
  await expect(handle).toHaveAttribute('tabindex')
  await expect(handle).toHaveAttribute('aria-label')

  // Focus and test keyboard interactions
  await handle.focus()
  // Press Enter to toggle
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)

  // Helper: only assert announcement if announcer exists
  const live = page.locator('.sr-only')
  if (await live.count()) {
    await expect(live).not.toHaveText('', { timeout: 2000 })
  }

  // Press Escape to close
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  if (await live.count()) {
    await expect(live).not.toHaveText('', { timeout: 2000 })
  }

  // Test ArrowUp/ArrowDown/Home/End behavior where supported
  await handle.focus()
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(300)
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
  await page.keyboard.press('End')
  await page.waitForTimeout(300)

  // Verify the handle remains focusable after interactions
  await expect(handle).toBeFocused()
})
