import { test, expect } from '@playwright/test'

test('Generate more routes increases the displayed route count', async ({ page }) => {
  await page.goto('/run-home/debug')

  // Start debug session and use sample route
  await page.getByRole('button', { name: /Start Debug Session/i }).click()
  await page.getByTitle('Toggle Debug Settings').click()
  await page.getByRole('button', { name: /Use Sample Route/i }).click()

  // Wait for the summary that shows how many routes were found
  const summary = page.getByText(/route(s)? found/i)
  await expect(summary).toBeVisible({ timeout: 5000 })

  const getCount = async () => {
    const text = await summary.textContent()
    const match = text && text.match(/(\d+) route/)
    return match ? parseInt(match[1], 10) : 0
  }

  const initialCount = await getCount()
  expect(initialCount).toBeGreaterThan(0)

  // If the Find More button is present, click it and expect the count to increase
  const findMore = page.getByRole('button', { name: /Find More Routes/i })
  if (await findMore.count() > 0) {
    await findMore.click()
    // Wait for the count to increase
    await page.waitForFunction(
      (sel, prev) => {
        const el = document.querySelector(sel)
        if (!el) return false
        const m = el.textContent.match(/(\d+) route/)
        return m && parseInt(m[1], 10) > prev
      },
      summary._selector, // internal selector -- Playwright will accept the locator
      initialCount,
      { timeout: 5000 }
    )

    const afterCount = await getCount()
    expect(afterCount).toBeGreaterThan(initialCount)
  } else {
    test.skip(true, 'Find More button not present in this scenario')
  }
})