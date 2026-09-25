import { expect, type Page } from '@playwright/test'

/** Sign in (prototype local auth) and finish the setup wizard on the defaults. */
export async function startChallenge(page: Page, email: string): Promise<void> {
  await page.goto('/signin')
  await page.locator('input[type=email]').fill(email)
  await page.getByRole('button', { name: /Send magic link|Continue on this device/ }).click()
  await page.waitForURL(/\/setup|\/dashboard/)

  if (page.url().includes('/setup')) {
    await page.getByRole('button', { name: 'Next: rules' }).click()
    await page.getByRole('button', { name: 'Next: stakes' }).click()
    await page.getByRole('button', { name: /Start my 75/ }).click()
  }
  await page.waitForURL(/\/dashboard/)
  await expect(page.getByRole('heading', { level: 1, name: 'Day 1 of 75' })).toBeAttached()
}

/**
 * Meet every rule on the default set: tick the plain rules, write the log and
 * attach a link (the log and artifact rules are met by the evidence itself).
 */
export async function completeToday(page: Page): Promise<void> {
  const checks = page.locator('button.check')
  const count = await checks.count()
  for (let i = 0; i < count; i++) await checks.nth(i).click()
  await page.locator('textarea.log-input').fill('ink studies of the harbour')
  await page.getByPlaceholder('paste a link').fill('example.com/study.png')
  await page.getByRole('button', { name: 'Add link' }).click()
}

/** Fail the test on any console error, so a silent regression can't slip past. */
export function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}
