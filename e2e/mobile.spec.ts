import { test, expect } from '@playwright/test'
import { startChallenge } from './helpers'

// Most people will run this on a phone, so layout regressions on a small
// viewport matter as much as broken logic.
test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile viewport only')

  const ROUTES = ['/', '/signin', '/dashboard', '/settings', '/recap', '/dashboard/share']

  test('no route scrolls sideways', async ({ page }) => {
    await startChallenge(page, 'mobile-overflow@75create.test')

    for (const route of ROUTES) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(
        overflow.scroll,
        `${route} overflows horizontally (${overflow.scroll} > ${overflow.client})`,
      ).toBeLessThanOrEqual(overflow.client)
    }
  })

  test('controls on the check-in card are thumb-sized', async ({ page }) => {
    await startChallenge(page, 'mobile-targets@75create.test')

    const small = await page.evaluate(() => {
      const tooSmall: string[] = []
      // Scoped to the controls people actually tap every day — the check-in
      // card and the page nav. The wordmark is a brand mark, not a control.
      const selector = [
        '.daycard button',
        '.daycard a',
        '.daycard input:not([type=file])',
        '.daycard textarea',
        '.nav-links a',
      ].join(', ')
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.height < 44) {
          tooSmall.push(
          `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} ${Math.round(r.height)}px`,
        )
        }
      }
      return tooSmall
    })
    expect(small).toEqual([])
  })

  test('the grid stays visible and legible', async ({ page }) => {
    await startChallenge(page, 'mobile-grid@75create.test')

    const cells = page.locator('.cell')
    await expect(cells).toHaveCount(75)
    const box = await cells.first().boundingBox()
    expect(box!.width).toBeGreaterThan(8)
  })

  test('the PWA manifest matches the app’s own colours', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest')
    const manifest = await response!.json()
    expect(manifest.display).toBe('standalone')
    // A mismatch here shows up as a splash screen that flashes a different
    // colour than the app it opens into.
    expect(manifest.background_color).toBe('#efe9dc')
    expect(manifest.theme_color).toBe('#efe9dc')
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(
      true,
    )
  })
})
