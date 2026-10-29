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

  test('shows the boot error instead of loading forever, and the button recovers', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(homeHeading(page)).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    // The worker stays registered but the page's requests bypass it (the state a Lighthouse run
    // can leave behind): the boot's own probe reaches the network instead of the mock.
    await cdp.send('Network.setBypassServiceWorker', { bypass: true })
    await page.reload()

    const title = page.getByRole('heading', { name: 'Não foi possível iniciar a simulação da API' })
    // One automatic recovery reload first, then the error screen: bounded, never a blank page.
    await expect(title).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/não está interceptando/)).toBeVisible()

    // Clicking while DevTools still bypasses workers must settle back to an actionable error,
    // without an additional automatic reload. The app cannot turn a DevTools override off.
    let navigations = 0
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations++
    })
    await page.getByRole('button', { name: 'Recarregar página' }).click()
    await expect.poll(() => navigations).toBe(1)
    await expect(title).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/feche o DevTools/)).toBeVisible()
    expect(navigations).toBe(1)

    await cdp.send('Network.setBypassServiceWorker', { bypass: false })
    await page.getByRole('button', { name: 'Recarregar página' }).click()
    await expect(homeHeading(page)).toBeVisible({ timeout: 30_000 })
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  })
})
