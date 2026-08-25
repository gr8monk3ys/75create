import { test, expect } from '@playwright/test'
import { startChallenge, failOnConsoleErrors } from './helpers'

// The daily loop is the product. Every assertion here corresponds to a way a
// user could lose a day of work or a streak.

test.describe('core loop', () => {
  test('sign in, set up a challenge, and complete day one', async ({ page }) => {
    const errors = failOnConsoleErrors(page)
    await startChallenge(page, 'core@75create.test')

    // No day is complete yet.
    await expect(page.locator('.stamp')).toHaveCount(0)

    const checks = page.locator('button.check')
    const count = await checks.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await checks.nth(i).click()
    }

    // All required rules checked marks the day done and stamps the grid.
    await expect(page.locator('.stamp')).toBeVisible()
    await expect(page.locator('.cell-complete').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('unchecking a rule takes the day back off the grid', async ({ page }) => {
    await startChallenge(page, 'uncheck@75create.test')

    const checks = page.locator('button.check')
    const count = await checks.count()
    for (let i = 0; i < count; i++) await checks.nth(i).click()
    await expect(page.locator('.stamp')).toBeVisible()

    await checks.first().click()
    await expect(page.locator('.stamp')).toHaveCount(0)
  })

  test('the daily log survives a reload', async ({ page }) => {
    await startChallenge(page, 'log-reload@75create.test')

    await page.locator('textarea').first().fill('made a study of the harbour light')
    await expect(page.locator('.count')).toHaveText('saved')

    await page.reload()
    await expect(page.locator('textarea').first()).toHaveValue(
      'made a study of the harbour light',
    )
  })

  test('the daily log survives navigating away mid-autosave', async ({ page }) => {
    // Regression: the autosave debounce is 600ms and nothing used to flush it
    // on unmount, so leaving the page immediately after typing dropped the log.
    await startChallenge(page, 'log-nav@75create.test')

    await page.locator('textarea').first().fill('typed and left at once')
    await page.locator('a[href="/settings"]').first().click()
    await page.waitForURL(/\/settings/)

    await page.goto('/dashboard')
    await expect(page.locator('textarea').first()).toHaveValue('typed and left at once')
  })

  test('the log is capped at 500 characters', async ({ page }) => {
    await startChallenge(page, 'log-cap@75create.test')

    await page.locator('textarea').first().fill('x'.repeat(600))
    await expect(page.locator('textarea').first()).toHaveValue('x'.repeat(500))
  })
})

test.describe('artifact links', () => {
  test('accepts a web link and rejects a javascript: URL', async ({ page }) => {
    await startChallenge(page, 'artifact@75create.test')

    const input = page.getByPlaceholder('paste a link')
    const add = page.getByRole('button', { name: 'Add', exact: true })

    await input.fill('javascript:alert(1)')
    await add.click()
    await expect(page.getByText(/doesn’t look like a web link/)).toBeVisible()
    await expect(page.locator('.thumb')).toHaveCount(0)

    await input.fill('example.com/study.png')
    await add.click()
    await expect(page.locator('.thumb a')).toHaveAttribute(
      'href',
      'https://example.com/study.png',
    )
  })
})

test.describe('settings', () => {
  test('the late-night buffer persists', async ({ page }) => {
    await startChallenge(page, 'buffer@75create.test')

    await page.goto('/settings')
    await page.getByRole('button', { name: '6am' }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: '6am' })).toHaveClass(/sel/)
  })

  test('the time zone is shown and matches the device', async ({ page }) => {
    await startChallenge(page, 'tz@75create.test')

    await page.goto('/settings')
    const deviceTz = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    await expect(page.locator('.tz-current')).toHaveText(deviceTz)
    // Already on the device zone, so no switch offer.
    await expect(page.getByRole('button', { name: /^Use / })).toHaveCount(0)
  })

  test('deleting the account wipes local data', async ({ page }) => {
    await startChallenge(page, 'delete@75create.test')

    await page.goto('/settings')
    await page.getByPlaceholder('Type DELETE to confirm').fill('DELETE')
    await page.getByRole('button', { name: /delete everything/i }).click()

    await page.waitForURL('/')
    const remaining = await page.evaluate(() => localStorage.getItem('75create.v1'))
    expect(remaining).toBeNull()
  })
})

test.describe('sharing', () => {
  test('a share link renders read-only progress and excludes logs by default', async ({
    page,
  }) => {
    await startChallenge(page, 'share@75create.test')

    await page.locator('textarea').first().fill('a private note')
    await expect(page.locator('.count')).toHaveText('saved')

    await page.goto('/dashboard/share')
    const link = (await page.locator('code.link').innerText()).trim()
    expect(link).toContain('#')

    await page.goto(link.slice(link.indexOf('/share')))
    await expect(page.getByText(/Shared progress/)).toBeVisible()
    await expect(page.getByText('a private note')).toHaveCount(0)
  })

  test('a broken share link fails gracefully', async ({ page }) => {
    await page.goto('/share#not-a-real-snapshot')
    await expect(page.getByText(/empty or broken/)).toBeVisible()
  })
})

test.describe('resilience', () => {
  test('an unknown route renders the 404 page', async ({ page }) => {
    const response = await page.goto('/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByText(/doesn’t exist/)).toBeVisible()
  })

  test('security headers are served', async ({ page }) => {
    const response = await page.goto('/dashboard')
    const headers = response!.headers()
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['x-powered-by']).toBeUndefined()
  })
})
