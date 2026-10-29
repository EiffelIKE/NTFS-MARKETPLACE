import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
// The preview port; `E2E_PORT` lets a second checkout run beside another one that holds 4173.
const port = process.env.E2E_PORT ?? '4173'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Baselines live in the repo, one folder per project, tagged with the OS that rendered them
  // (spec 12 §2): fonts and anti-aliasing differ between platforms, so a mismatched OS fails loudly
  // on a missing baseline instead of on pixel noise.
  snapshotPathTemplate: 'e2e/__screenshots__/{projectName}/{arg}-{platform}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      stylePath: './e2e/support/visual.css',
    },
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Tests run against the optimized build, the same thing that gets deployed, except that this one
  // keeps the `/dev/*` harnesses (the realtime page and the UI kit) the deploy leaves out
  // (spec 14 §9). A server started from a plain `pnpm build` answers those routes with not-found.
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    env: { VITE_ENABLE_DEV_ROUTES: 'true' },
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
})
