import { test, expect } from '@playwright/test'
import { setupApiMocks } from './fixtures/api-mocks.js'

// Smoke test: open route details and toggle the route editor
test('route editor UI smoke test', async ({ page }) => {
  await setupApiMocks(page)
  await page.goto('/run-home/debug', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Start Debug Session/i }).click()

  // Wait for route cards to load and click the first one
  const firstRoute = page.locator('button', { hasText: /[0-9].*km/i }).first()
  await firstRoute.waitFor({ state: 'visible', timeout: 15000 })
  await firstRoute.click()

  // Wait for route details panel to appear
  await page.getByRole('heading', { name: /Route Details/i }).waitFor({ timeout: 5000 })

  // Verify the Route Editor is present and has an Edit button
  const editBtn = page.getByRole('button', { name: /Enter edit mode|Edit/i })
  await expect(editBtn).toBeVisible({ timeout: 3000 })

  // Toggle edit mode
  await editBtn.click()
  await expect(page.getByRole('button', { name: /Exit edit mode|Exit/i })).toBeVisible({ timeout: 2000 })

  // Check for 'No waypoints yet' message when there are no waypoints
  await expect(page.getByText(/No waypoints yet/i)).toBeVisible({ timeout: 2000 })

  // Exit edit mode
  await page.getByRole('button', { name: /Exit edit mode|Exit/i }).click()
  await expect(page.getByRole('button', { name: /Enter edit mode|Edit/i })).toBeVisible({ timeout: 2000 })
})