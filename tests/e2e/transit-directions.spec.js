import { test, expect } from '@playwright/test'

test('Transit directions link does not include departure_time when home is set and sample route is used', async ({ page }) => {
  await page.goto('/run-home/debug')

  // Start debug session, open debug overlay, then use the sample route
  await page.getByRole('button', { name: /Start Debug Session/i }).click()
  // Toggle the debug overlay (top-left bug icon)
  await page.getByTitle('Toggle Debug Settings').click()
  // Click "Use Sample Route"
  await page.getByRole('button', { name: /Use Sample Route/i }).click()

  // Wait for the detail panel to appear
  await expect(page.getByRole('heading', { name: /Route Details/i })).toBeVisible({ timeout: 5000 })

  // The transit directions link should be present in the detail panel
  const transitLink = page.getByRole('link', { name: /Open transit directions in Google Maps/i })
  await expect(transitLink).toBeVisible()

  const href = await transitLink.getAttribute('href')
  expect(href).toBeTruthy()
  expect(href).toContain('travelmode=transit')
  // Should NOT include a departure_time parameter anymore
  expect(href).not.toMatch(/departure_time=\d+/)

  // The old search link should not be present in the detail panel
  const openLink = page.getByRole('link', { name: /Open in Google Maps/i })
  await expect(openLink).toHaveCount(0)

  // Ensure we don't show the "No suitable routes found" error when at least one route exists
  const noRoutes = page.getByText(/No suitable routes found/i)
  await expect(noRoutes).toHaveCount(0)
})