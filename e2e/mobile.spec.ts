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

  test('controls on settings, setup and the grid foot are thumb-sized', async ({ page }) => {
    await startChallenge(page, 'mobile-targets-2@75create.test')

    const tooSmall = (selector: string) =>
      page.evaluate((sel) => {
        const out: string[] = []
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (r.height < 44) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.height)}px`)
        }
        return out
      }, selector)

    await page.goto('/settings')
    await page.locator('input[type=checkbox]').first().check()
    expect(await tooSmall('main button, main input:not([type=checkbox]), main a.back-link')).toEqual([])

    // Setup is only reachable without a running challenge: close this one.
    await page.goto('/dashboard')
    expect(await tooSmall('.grid-foot button, .detail button')).toEqual([])

    await page.evaluate(() => {
      const root = JSON.parse(localStorage.getItem('75create.v1')!)
      root.challenges = []
      localStorage.setItem('75create.v1', JSON.stringify(root))
    })
    await page.goto('/setup')
    expect(await tooSmall('main button, main input, main textarea')).toEqual([])
    await page.getByRole('button', { name: 'Next: rules' }).click()
    expect(
      await tooSmall('main button, main input:not([type=checkbox]), .req-toggle'),
    ).toEqual([])
  })

  test('the grid stays visible and legible', async ({ page }) => {
    await startChallenge(page, 'mobile-grid@75create.test')

    const cells = page.locator('.grid-panel .cell')
    await expect(cells).toHaveCount(75)
    // A compact copy of the grid sits up top on phones, where the app opens.
    await expect(page.locator('.mini-grid .cell')).toHaveCount(75)
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
