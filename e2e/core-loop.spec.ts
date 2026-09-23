import { test, expect } from '@playwright/test'
import { startChallenge, completeToday, failOnConsoleErrors } from './helpers'

// The daily loop is the product. Every assertion here corresponds to a way a
// user could lose a day of work or a streak.

test.describe('core loop', () => {
  test('sign in, set up a challenge, and complete day one', async ({ page }) => {
    const errors = failOnConsoleErrors(page)
    await startChallenge(page, 'core@75create.test')

    // No day is complete yet.
    await expect(page.locator('.daycard .stamp')).toHaveCount(0)

    // Ticking the plain rules is not enough: the log and artifact rules are
    // met by the work itself.
    const checks = page.locator('button.check')
    const count = await checks.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) await checks.nth(i).click()
    await expect(page.locator('.daycard .stamp')).toHaveCount(0)
    await expect(page.getByText(/of 5 done/)).toHaveText(/3 of 5 done/)

    await page.locator('textarea.log-input').fill('ink studies of the harbour')
    await page.getByPlaceholder('paste a link').fill('example.com/study.png')
    await page.getByRole('button', { name: 'Add link' }).click()

    // Every rule met marks the day done and stamps the grid.
    await expect(page.locator('.daycard .stamp')).toBeVisible()
    await expect(page.locator('.grid-panel .cell-complete').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('unchecking a rule takes the day back off the grid', async ({ page }) => {
    await startChallenge(page, 'uncheck@75create.test')

    await completeToday(page)
    await expect(page.locator('.daycard .stamp')).toBeVisible()

    await page.locator('button.check').first().click()
    await expect(page.locator('.daycard .stamp')).toHaveCount(0)
  })

  test('keyboard shortcuts tick rules and jump to the log', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcuts are a desktop accelerator')
    await startChallenge(page, 'keys@75create.test')

    // Outside the card the keys do nothing: a stray digit can't change data.
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('1')
    await expect(page.locator('button.check').first()).toHaveAttribute('aria-pressed', 'false')

    await page.locator('#check-in').focus()
    await page.keyboard.press('1')
    await expect(page.locator('button.check').first()).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('n')
    await expect(page.locator('textarea.log-input')).toBeFocused()
  })

  test('a log that completes the day lets the writer finish first', async ({ page }) => {
    await startChallenge(page, 'held@75create.test')
    const checks = page.locator('button.check')
    const count = await checks.count()
    for (let i = 0; i < count; i++) await checks.nth(i).click()
    await page.getByPlaceholder('paste a link').fill('example.com/study.png')
    await page.getByRole('button', { name: 'Add link' }).click()

    // The log is the last rule: the day is made as soon as it saves, but the
    // full-screen moment waits until the writer leaves the field.
    const log = page.locator('textarea.log-input')
    await log.fill('ink studies')
    await expect(page.locator('.daycard .stamp')).toBeVisible()
    await expect(page.locator('.cel')).toHaveCount(0)
    await log.blur()
    await expect(page.locator('.cel')).toBeAttached()
  })

  test('the daily log survives a reload', async ({ page }) => {
    await startChallenge(page, 'log-reload@75create.test')

    await page.locator('textarea').first().fill('made a study of the harbour light')
    await expect(page.locator('.count').first()).toHaveText(/Saved/)

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
    const add = page.getByRole('button', { name: 'Add link' })

    await input.fill('javascript:alert(1)')
    await add.click()
    await expect(page.getByText(/isn’t a web address/)).toBeVisible()
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
  // A buffer change can be refused in the small hours (it must never decide a
  // day), so the clock is pinned where each test needs it.
  test.use({ timezoneId: 'UTC' })

  test('the late-night buffer persists', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'))
    await startChallenge(page, 'buffer@75create.test')

    await page.goto('/settings')
    await page.getByRole('button', { name: '6am' }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: '6am' })).toHaveClass(/sel/)
  })

  test('a buffer change that would close an unmade day is refused, with the reason', async ({
    page,
  }) => {
    // 01:30 with the default 3am buffer: still Day 1, and it isn't made yet.
    await page.clock.setFixedTime(new Date('2026-09-23T01:30:00Z'))
    await startChallenge(page, 'refuse@75create.test')

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Midnight' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Day 1 isn’t made yet' })).toBeVisible()
    await expect(page.getByRole('button', { name: '3am' })).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1, name: 'Day 1 of 75' })).toBeAttached()
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
    await page.getByLabel('Type DELETE to confirm').fill('DELETE')
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
    await expect(page.locator('.count').first()).toHaveText(/Saved/)

    await page.goto('/dashboard/share')
    const link = (await page.locator('#share-link').inputValue()).trim()
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
