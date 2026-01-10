import { test, expect } from '@playwright/test'

test('mobile bottom sheet open/close and keyboard interaction', async ({ page }) => {
  await page.goto('/run-home/debug')
  // Start debug session
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for route results to load
  await page.waitForSelector('button[aria-label="Drag to expand or collapse routes"]', { timeout: 10000 })

  const handle = page.locator('button[aria-label="Drag to expand or collapse routes"]')

  // Keyboard: press Enter to toggle full/half
  await handle.focus()
  await page.keyboard.press('Enter')
  // Wait a bit for animation to settle
  await page.waitForTimeout(600)

  // Check that an announcement was made (aria live text appears)
  const live = page.locator('.sr-only')
  await expect(live).not.toHaveText('')

  // Now press Escape to close
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await expect(live).not.toHaveText('')

  // Simulate a drag: mousedown then mousemove then mouseup
  const box = await handle.boundingBox()
  if (box) {
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // drag up by 200px
    await page.mouse.move(startX, startY - 200, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(600)
    await expect(live).not.toHaveText('')
  }
})