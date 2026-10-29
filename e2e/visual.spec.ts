import { expect, test } from './support/test'
import { prepare, settle, settleLoading } from './support/visual'

// Brief §9: visual regression for home, details, cart and checkout, in the desktop and mobile
// projects, with version-controlled baselines (spec 12). Data is the `default` seed, the clock is
// fixed, and the mock answers at once, so a diff means the UI changed. Regenerate on purpose with
// `pnpm test:visual:update` and review the images before committing.

const DETAILS = '/nfts/emerald-ape-042'

test.describe('@visual', () => {
  // The baselines are named `-linux` (playwright.config `snapshotPathTemplate`): fonts and
  // anti-aliasing differ per OS, so elsewhere they would fail on a missing file, not on the UI (G3).
  // `pnpm test:visual:update` still runs here, to create local baselines on that OS.
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured first argument
  test.beforeEach(({}, testInfo) => {
    test.skip(
      process.platform !== 'linux' && testInfo.config.updateSnapshots !== 'all',
      `Visual baselines are Linux-only and this is ${process.platform}. Run \`pnpm test:visual:update\` to create local ones.`,
    )
  })

  test('home', async ({ page, isMobile }) => {
    await prepare(page)
    await page.goto('/')
    await settle(page)
    await expect(page).toHaveScreenshot('home.png', { fullPage: true })
    if (isMobile) await expect(page).toHaveScreenshot('home-viewport.png')
  })

  test('home loading', async ({ page }) => {
    await prepare(page, { latency: 'never' })
    await page.goto('/')
    await settleLoading(page)
    await expect(page).toHaveScreenshot('home-loading.png')
  })

  test('details', async ({ page, isMobile }) => {
    await prepare(page)
    await page.goto(DETAILS)
    await settle(page)
    await expect(page).toHaveScreenshot('details.png', { fullPage: true })
    if (isMobile) await expect(page).toHaveScreenshot('details-viewport.png')
  })

  test('details loading', async ({ page }) => {
    await prepare(page, { latency: 'never' })
    await page.goto(DETAILS)
    await settleLoading(page)
    await expect(page).toHaveScreenshot('details-loading.png')
  })

  test('cart', async ({ page }) => {
    await prepare(page, { as: 'ana' })
    await page.goto('/cart')
    await settle(page)
    await expect(page).toHaveScreenshot('cart.png', { fullPage: true })
  })

  test('checkout', async ({ page }) => {
    await prepare(page, { as: 'ana' })
    await page.goto('/checkout')
    await settle(page)
    await expect(page).toHaveScreenshot('checkout.png', { fullPage: true })
  })
})
