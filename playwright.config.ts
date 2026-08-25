import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against a real production build, because several of the
// things they cover — the service worker, the security headers, static
// prerendering — only exist in `next start`.
const PORT = Number(process.env.E2E_PORT ?? 3123)
const baseURL = `http://127.0.0.1:${PORT}`

// Lets a sandbox with a pre-installed browser point at it instead of
// downloading one; CI uses the browser `playwright install` puts in place.
const executablePath = process.env.CHROMIUM_PATH

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(executablePath
      ? // A pre-installed browser implies a container running as root, where
        // Chromium's sandbox can't start.
        { launchOptions: { executablePath, args: ['--no-sandbox'] } }
      : {}),
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      // Phone viewport and touch, driven by Chromium: the point is catching
      // layout and tap-target regressions, not WebKit-specific behaviour.
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],

  webServer: {
    command: `bun run build && bun x next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
