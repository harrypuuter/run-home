import { test, expect } from '@playwright/test'
import { setupApiMocks } from './fixtures/api-mocks.js'

test('DB API dashboard runs a smoke test and shows results', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/run-home/debug')

  // Open Advanced Options
  await page.getByText('Advanced Options').click()

  // Ensure the dashboard is visible
  await expect(page.getByText('DB API Dashboard')).toBeVisible()

  // Enable DB API toggle
  const enableToggle = page.locator('input[type="checkbox"]')
  await enableToggle.check()

  // Click Run Smoke Test
  await page.getByRole('button', { name: /Run Smoke Test/i }).click()

  // Wait for the smoke result area to appear
  await expect(page.getByText(/^Smoke:/)).toBeVisible({ timeout: 5000 })

  // At minimum, assert smoke result is visible and dashboard rendered
  await expect(page.getByText(/^Smoke:/)).toBeVisible()
})