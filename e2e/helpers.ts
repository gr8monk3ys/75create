import { expect, type Page } from '@playwright/test'

/** Sign in (prototype local auth) and finish the setup wizard on the defaults. */
export async function startChallenge(page: Page, email: string): Promise<void> {
  await page.goto('/signin')
  await page.locator('input[type=email]').fill(email)
  await page.getByRole('button', { name: 'Send magic link' }).click()
  await page.waitForURL(/\/setup|\/dashboard/)

  if (page.url().includes('/setup')) {
    await page.getByRole('button', { name: 'Next: rules' }).click()
    await page.getByRole('button', { name: 'Next: stakes' }).click()
    await page.getByRole('button', { name: /Start my 75/ }).click()
  }
  await page.waitForURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: /Day 1/ })).toBeVisible()
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
