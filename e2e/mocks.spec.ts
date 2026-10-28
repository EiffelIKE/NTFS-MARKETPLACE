import type { Page } from '@playwright/test'

import { NftListResponse } from '../src/contracts'
import { expectNoAxeViolations } from './support/a11y'
import { apiFetch, bearer, forgetSession, loginAs, mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 02 design §13 E2E table: the service worker, URL params, persistence, scenarios, the fake
// clock and the panel, against the optimized build.

async function open(page: Page, url = '/') {
  await page.goto(url)
  await expect(page.getByRole('heading', { level: 1, name: 'KURIO' })).toBeVisible()
}

async function total(page: Page) {
  const { body } = await apiFetch<{ totalItems: number }>(page, '/nfts?pageSize=1')
  return body.totalItems
}

const launcher = (page: Page) => page.getByRole('button', { name: 'Simulação', exact: true })
const panel = (page: Page) => page.getByRole('dialog', { name: 'Simulação da API' })
const scenarios = (page: Page) => panel(page).getByRole('radiogroup', { name: 'Cenário' })

test('the worker answers API calls with data that satisfies the contract (API-34, API-01)', async ({
  page,
}) => {
  await open(page)
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  const { status, body } = await apiFetch(page, '/nfts?pageSize=3')
  expect(status).toBe(200)
  const parsed = NftListResponse.parse(body)
  expect(parsed.items).toHaveLength(3)
  expect(parsed.totalItems).toBe(120)
})

test('?scenario= switches the scenario and cleans the URL (API-39)', async ({ page }) => {
  await open(page, '/?scenario=empty')
  expect(new URL(page.url()).search).toBe('')
  expect((await mock(page).state()).scenarioId).toBe('empty')
  expect(await total(page)).toBe(0)
  await open(page, '/?scenario=default')
  expect(new URL(page.url()).search).toBe('')
  expect(await total(page)).toBe(120)
})

test('data persists across reloads and ?reset=1 restores the seed (API-36, API-40)', async ({
  page,
}) => {
  await open(page)
  const token = await loginAs(page, 'ana')
  const headers = bearer(token)
  const before = await apiFetch<{ nftIds: string[] }>(page, '/favorites', { headers })
  const catalog = await apiFetch<{ items: { id: string }[] }>(page, '/nfts?pageSize=12')
  const nftId = catalog.body.items
    .map((item) => item.id)
    .find((id) => !before.body.nftIds.includes(id))
  if (!nftId) throw new Error('every NFT of the page is already a favorite')
  expect((await apiFetch(page, `/favorites/${nftId}`, { method: 'PUT', headers })).status).toBe(204)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'KURIO' })).toBeVisible()
  const after = await apiFetch<{ nftIds: string[] }>(page, '/favorites', { headers })
  expect(after.body.nftIds).toContain(nftId)

  await forgetSession(page)
  await open(page, '/?reset=1')
  expect(new URL(page.url()).search).toBe('')
  // The reset also drops sessions, so the old token is gone.
  const reset = await apiFetch<{ nftIds: string[] }>(page, '/favorites', {
    headers: bearer(await loginAs(page, 'ana')),
  })
  expect(reset.body.nftIds).not.toContain(nftId)
})

test('another browser context starts from the seed (isolation)', async ({ page, browser }) => {
  await open(page)
  const token = await loginAs(page, 'ana')
  const cart = await apiFetch<{ items: unknown[] }>(page, '/cart', { headers: bearer(token) })
  const seeded = cart.body.items.length
  await apiFetch(page, '/cart/items', {
    method: 'POST',
    headers: bearer(token),
    body: { nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 },
  })
  const changed = await apiFetch<{ items: unknown[] }>(page, '/cart', { headers: bearer(token) })
  expect(changed.body.items.length).toBe(seeded + 1)

  const context = await browser.newContext({ baseURL: 'http://localhost:4173' })
  const other = await context.newPage()
  await open(other)
  const fresh = await apiFetch<{ items: unknown[] }>(other, '/cart', {
    headers: bearer(await loginAs(other, 'ana')),
  })
  expect(fresh.body.items.length).toBe(seeded)
  await context.close()
})

test.describe('offline scenario (API-41)', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource|Failed to fetch|ERR_|net::/i] })

  test('calls fail, and returning to default works without a reload', async ({ page }) => {
    await open(page, '/?scenario=offline')
    await expect(apiFetch(page, '/nfts?pageSize=1')).rejects.toThrow()
    await mock(page).useScenario('default')
    expect(await total(page)).toBe(120)
  })
})

test('latency follows the page clock (API-41, API-43)', async ({ page }) => {
  await page.clock.install()
  await page.goto('/?scenario=slow')
  await expect(page.getByRole('heading', { level: 1, name: 'KURIO' })).toBeVisible()
  await page.evaluate(() => {
    const w = window as unknown as { done?: boolean }
    void fetch('/api/nfts?pageSize=1').then(() => {
      w.done = true
    })
  })
  await page.clock.runFor(2400)
  expect(await page.evaluate(() => (window as unknown as { done?: boolean }).done === true)).toBe(
    false,
  )
  await page.clock.runFor(200)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { done?: boolean }).done === true))
    .toBe(true)
})

test('the panel is hidden by default and works by keyboard (API-44)', async ({ page }) => {
  await open(page)
  await expect(launcher(page)).toHaveCount(0)
  await expect(panel(page)).toHaveCount(0)

  await page.keyboard.press('Alt+Shift+M')
  await expect(panel(page)).toBeVisible()
  await expect(scenarios(page).getByRole('radio', { name: /^Padrão/ })).toBeFocused()
  await expectNoAxeViolations(page)

  await page.keyboard.press('Escape')
  await expect(panel(page)).toHaveCount(0)
  await expect(launcher(page)).toBeVisible()
  await expect(launcher(page)).toBeFocused()

  await launcher(page).click()
  await panel(page)
    .getByRole('radio', { name: /^Catálogo vazio/ })
    .click()
  await panel(page).getByRole('button', { name: 'Aplicar e recarregar' }).click()
  await page.waitForFunction(
    () =>
      (window as unknown as { __mock?: { state(): { scenarioId: string } } }).__mock?.state()
        .scenarioId === 'empty',
  )
  expect(await total(page)).toBe(0)
})

test('?mockPanel=1 opens the panel on load (API-44)', async ({ page }) => {
  await page.goto('/?mockPanel=1')
  await expect(panel(page)).toBeVisible()
})
