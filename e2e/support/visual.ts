import type { Page } from '@playwright/test'

import { forgetSession, loginAs, mock } from './mock'
import { realtime } from './realtime'
import { expect } from './test'

// Preparation shared by the visual specs (spec 12 §3): a fresh database, a frozen clock, no mock
// latency (or a latency that never ends, for skeletons) and a "loaded" check that covers fonts,
// images and the mock request log.

/** The instant every visual test sees: the day of the challenge's fixtures. */
export const FROZEN = new Date('2026-10-27T12:00:00Z')

/** Longer than any test: a request held this long is a skeleton that cannot resolve. */
const NEVER_MS = 3_600_000

interface PrepareOptions {
  /** Sign in as this fixture user before the screen opens. */
  as?: 'ana'
  /** `none` loads at once; `never` keeps every API call pending, so skeletons stay on screen. */
  latency?: 'none' | 'never'
}

/**
 * Leaves the page on the `default` scenario's seed with the clock fixed and the chosen latency.
 * The caller then navigates to the screen, which restores the session and reads from the mock.
 */
export async function prepare(page: Page, { as, latency = 'none' }: PrepareOptions = {}) {
  // `setFixedTime` pins `Date` while timers keep running, so relative dates never move and the
  // mock's own waits still fire. `install` first so the pin covers the whole page lifetime.
  await page.clock.install({ time: FROZEN })
  // Skipped for skeletons: the router's pending delay reads `Date.now`, so a pinned date never shows it.
  if (latency === 'none') await page.clock.setFixedTime(FROZEN)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/?reset=1')
  await page.waitForFunction(() => '__mock' in window)
  // A reset drops the mock's sessions, so any stored one has to go before a new login.
  await forgetSession(page)
  await mock(page).configure({
    latency: latency === 'never' ? { kind: 'fixed', ms: NEVER_MS } : { kind: 'none' },
  })
  if (as && latency === 'none') await loginAs(page, as)
}

/** Everything that can still change the picture has finished. */
export async function settle(page: Page) {
  await page.waitForFunction(() => '__mock' in window)
  // The socket's first connection refetches what it covers, which dims the catalog while it runs.
  await expect.poll(async () => (await realtime(page).connections()).length).toBeGreaterThan(0)
  await expect(page.locator('[aria-busy="true"], [data-outdated]')).toHaveCount(0)
  await page.evaluate(async () => {
    await document.fonts.ready
    // Lazy images below the fold would otherwise be blank in a full-page capture.
    for (const img of document.images) img.loading = 'eager'
    await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)))
  })
  await expect
    .poll(async () => (await mock(page).requests()).filter((r) => r.status === 'pending').length)
    .toBe(0)
}

/** The skeleton state: the busy region is on screen and the fonts are ready. */
export async function settleLoading(page: Page) {
  // The router shows a route's pending view after `pendingMs` (150) of page time, and the page
  // clock does not move by itself: advance it until the busy region is on screen.
  await page.waitForFunction(() => '__mock' in window)
  const busy = page.locator('[aria-busy="true"]').first()
  await expect(async () => {
    await page.clock.runFor(200)
    await expect(busy).toBeVisible({ timeout: 250 })
  }).toPass()
  await page.evaluate(() => document.fonts.ready)
}
