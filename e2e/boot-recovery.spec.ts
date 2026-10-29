import type { Page } from '@playwright/test'

import { apiFetch } from './support/mock'
import { homeHeading } from './support/home'
import { expect, test } from './support/test'

// Spec 13, "Post-deploy fix: SW boot recovery": the mock worker can be taken away from a page
// (Lighthouse and "Clear site data" do it), and a persisted database can be left half written.
// The app must come back on its own, or say why it cannot, and never wait forever.

test('a persisted database cut short is reseeded instead of failing every request', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Only before the first boot: later loads must see what the app itself wrote.
    if (sessionStorage.getItem('seeded-damage') !== null) return
    sessionStorage.setItem('seeded-damage', '1')
    localStorage.setItem('kurio.mock.db', JSON.stringify({ schemaVersion: 2, seq: { user: 1 } }))
  })
  await page.goto('/')
  await expect(homeHeading(page)).toBeVisible()
  const { status, body } = await apiFetch<{ totalItems: number }>(page, '/nfts?pageSize=1')
  expect(status).toBe(200)
  expect(body.totalItems).toBe(120)
})

test('a worker unregistered while the page was away is registered again on reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(homeHeading(page)).toBeVisible()
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister()
    }
  })
  await page.reload()
  await expect(homeHeading(page)).toBeVisible()
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  const { status } = await apiFetch(page, '/nfts?pageSize=1')
  expect(status).toBe(200)
})

test('another tab that registers a fresh worker does not break this one', async ({
  page,
  context,
}) => {
  // What Lighthouse does to the other open tabs of the site: it clears the origin's workers, then
  // its own load registers a fresh one, which claims every tab. Each tab must reconnect to it,
  // without unregistering it from under the others (they would then fight over the worker).
  test.setTimeout(60_000)
  await page.goto('/')
  await expect(homeHeading(page)).toBeVisible()
  const other = await context.newPage()
  await other.goto('/')
  await expect(homeHeading(other)).toBeVisible()

  const cdp = await context.newCDPSession(page)
  await cdp.send('Storage.clearDataForOrigin', {
    origin: new URL(page.url()).origin,
    storageTypes: 'service_workers',
  })
  await page.reload()
  await expect(homeHeading(page)).toBeVisible()

  // Only the mock sets the marker; a request that slipped past the worker gets the SPA's HTML.
  const mocked = (tab: typeof page) =>
    tab.evaluate(async () => {
      const response = await fetch('/api/__mock/health', { cache: 'no-store' })
      return response.headers.get('x-kurio-mock') === '1'
    })
  await expect.poll(() => mocked(other), { timeout: 20_000 }).toBe(true)
  await expect(homeHeading(other)).toBeVisible()
  // And the tab that reconnected did not take the worker away from the first one.
  await expect.poll(() => mocked(page), { timeout: 10_000 }).toBe(true)
  for (const tab of [page, other]) {
    await expect(tab.getByRole('heading', { name: /Não foi possível iniciar/ })).toHaveCount(0)
  }
})

test.describe('a worker that never takes control', () => {
  // The failed requests and the realtime socket that cannot be created are the point here.
  test.use({ allowedConsoleErrors: [/./] })

  // Document loads only: `framenavigated` also counts same-document (history) navigations.
  const documentLoads = (page: Page) => {
    const count = { value: 0 }
    page.on('domcontentloaded', () => {
      count.value++
    })
    return count
  }

  test('falls back to mocking inside the page after one automatic reload', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(homeHeading(page)).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    // The worker stays registered but the page's requests bypass it (DevTools "Bypass for
    // network"): the boot's own probe reaches the network instead of the mock.
    await cdp.send('Network.setBypassServiceWorker', { bypass: true })
    const navigations = documentLoads(page)
    await page.reload()

    await expect(homeHeading(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('html')).toHaveAttribute('data-mock', 'page')
    // This reload plus the one automatic recovery reload: bounded, never a loop.
    expect(navigations.value).toBe(2)
    const { status, body } = await apiFetch<{ totalItems: number }>(page, '/nfts?pageSize=1')
    expect(status).toBe(200)
    expect(body.totalItems).toBe(120)
    await expect(page.getByRole('heading', { name: /Não foi possível iniciar/ })).toHaveCount(0)
  })

  test('a registration wedged in the browser: mocks inside the page without reloading', async ({
    page,
  }) => {
    // What a DevTools Lighthouse run can leave behind: a registration with no worker in it, whose
    // unregister() and register() never settle. Only the browser can clear it, so reloading would
    // not help.
    await page.addInitScript(() => {
      const never = () => new Promise<never>(() => undefined)
      const wedged = {
        scope: `${location.origin}/`,
        active: null,
        waiting: null,
        installing: null,
        unregister: never,
        update: never,
      }
      const container = navigator.serviceWorker
      Object.defineProperty(container, 'controller', { get: () => null })
      container.getRegistrations = () =>
        Promise.resolve([wedged as unknown as ServiceWorkerRegistration])
      container.register = never
    })
    const navigations = documentLoads(page)
    await page.goto('/')

    await expect(homeHeading(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('html')).toHaveAttribute('data-mock', 'page')
    expect(navigations.value).toBe(1)
    const { status } = await apiFetch(page, '/nfts?pageSize=1')
    expect(status).toBe(200)
  })
})
