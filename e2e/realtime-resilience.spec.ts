import type { Page } from '@playwright/test'

import { eventId, type RealtimeEvent } from '../src/contracts'
import { expectNoAxeViolations } from './support/a11y'
import { forgetSession, loginAs, mock } from './support/mock'
import { realtime, waitForConnection } from './support/realtime'
import { expect, test } from './support/test'

// Spec 03 design §9 and the first half of brief scenario 10: duplicates, old versions,
// disconnection and reconnection. Every event reaches the page through the app's own
// `socket.io-client`; the mock server only decides what to send and to whom. The pending-order
// half (resume after reload) is added by spec 09.

const NFT = 'emerald-ape-042'

const status = (page: Page) => page.getByRole('status', { name: 'Conexão', exact: true })
const nftData = (page: Page) => page.getByRole('group', { name: 'Dados do NFT' })
const orderData = (page: Page) => page.getByRole('group', { name: 'Dados do pedido' })
const events = (page: Page) => page.getByRole('table', { name: 'Eventos recebidos' })

async function open(page: Page, url = '/dev/realtime') {
  await page.goto(url)
  await expect(page.getByRole('heading', { level: 1, name: 'Tempo real' })).toBeVisible()
}

async function loadOrder(page: Page, orderId: string) {
  await page.getByLabel('ID do pedido').fill(orderId)
}

/** Starts the app signed in as `name`: the next navigation restores the seeded session (spec 04). */
async function openAs(page: Page, name: 'ana' | 'bruno', url = '/dev/realtime') {
  await loginAs(page, name)
  await open(page, url)
}

/** The page has loaded the NFT over REST, so a later change can only arrive as an event. */
async function waitForNft(page: Page) {
  await waitForConnection(page, { userId: null })
  await expect(nftData(page)).toContainText('Versão: 1')
}

function nftEvent(version: number, price: string): RealtimeEvent {
  return {
    id: eventId('nft.updated', NFT, version),
    type: 'nft.updated',
    resource: { type: 'nft', id: NFT },
    version,
    occurredAt: '2026-10-28T12:00:00.000Z',
    data: { price, available: true, editions: [] },
  }
}

test('a price change reaches the page through Socket.IO, with no REST refetch (RT-01, RT-07, RT-13)', async ({
  page,
}) => {
  await open(page)
  await waitForNft(page)
  await expect(status(page)).toHaveText('Status: conectado')
  await expect(nftData(page)).toContainText('Preço: 1.19 ETH')

  await mock(page).clearRequests()
  await mock(page).updateNft(NFT, {
    price: '1.29',
    available: { editionId: 'limited-10', value: 0 },
  })

  await expect(nftData(page)).toContainText('Preço: 1.29 ETH')
  await expect(nftData(page)).toContainText('Versão: 2')
  await expect(nftData(page)).toContainText('1/10: 0 restantes')
  await expect(events(page)).toContainText('nft.updated')
  await expect(events(page)).toContainText('aplicado')
  expect(await mock(page).requests({ op: 'nfts.get' })).toEqual([])
})

test('the developer page has no serious axe violations, with events listed', async ({ page }) => {
  await open(page)
  await waitForNft(page)
  await mock(page).updateNft(NFT, { price: '1.29' })
  await expect(events(page)).toContainText('aplicado')
  await expectNoAxeViolations(page)
})

test('a duplicate and an old version are ignored and never revert the price (RT-11, RT-12)', async ({
  page,
}) => {
  await open(page)
  await waitForNft(page)
  await mock(page).updateNft(NFT, { price: '1.29' })
  await expect(nftData(page)).toContainText('Preço: 1.29 ETH')

  await realtime(page).redeliver(1)
  await expect(events(page).getByRole('row', { name: /duplicado/ })).toHaveCount(1)
  await expect(nftData(page)).toContainText('Preço: 1.29 ETH')

  // The previous version, with an older price, arriving late.
  await realtime(page).inject(nftEvent(1, '1.19'))
  await expect(events(page).getByRole('row', { name: /antigo/ })).toHaveCount(1)
  await expect(nftData(page)).toContainText('Preço: 1.29 ETH')
  await expect(nftData(page)).toContainText('Versão: 2')

  // A payload that breaks the contract is dropped and later events still work.
  await realtime(page).inject({ type: 'nft.updated', data: { price: 1.5 } })
  await expect(events(page).getByRole('row', { name: /inválido/ })).toHaveCount(1)
  await mock(page).updateNft(NFT, { price: '1.31' })
  await expect(nftData(page)).toContainText('Preço: 1.31 ETH')
})

test('after a disconnection the page reconnects and reconciles with REST (RT-16, RT-17)', async ({
  page,
}) => {
  await page.clock.install()
  await open(page)
  await waitForNft(page)
  await expect(status(page)).toHaveText('Status: conectado')

  await realtime(page).drop({ block: true })
  await expect(status(page)).toHaveText('Status: reconectando')
  await realtime(page).clearLog()

  // The change happens while the page is cut off: nobody is entitled to the event.
  await mock(page).updateNft(NFT, { price: '1.39' })
  await page.clock.runFor(100)
  await expect
    .poll(async () => (await realtime(page).log()).map((e) => e.connectionIds))
    .toEqual([[]])
  await expect(nftData(page)).toContainText('Preço: 1.19 ETH')

  await mock(page).clearRequests()
  await realtime(page).restore()
  // Backoff is 1 s growing to 5 s: one run is enough for the next attempt.
  await page.clock.runFor(5000)
  await expect(status(page)).toHaveText('Status: conectado')
  await page.clock.runFor(500)

  await expect(nftData(page)).toContainText('Preço: 1.39 ETH')
  expect((await mock(page).requests({ op: 'nfts.get' })).length).toBeGreaterThan(0)
})

test('an idle connection survives the Engine.IO ping timeout thanks to the mock heartbeat (RT-03)', async ({
  page,
}) => {
  await page.clock.install()
  await open(page)
  await waitForConnection(page)
  const [first] = await realtime(page).connections()

  // 3 × 15 s: well past the 30 s (pingInterval + pingTimeout) the open packet announces.
  for (let step = 0; step < 3; step += 1) await page.clock.runFor(15_000)

  await expect(status(page)).toHaveText('Status: conectado')
  const open_ = await realtime(page).connections()
  expect(open_.map((c) => c.id)).toEqual([first?.id])
})

test('a restored session connects as its user, and a new one replaces it (RT-18)', async ({
  page,
}) => {
  await open(page)
  await waitForConnection(page, { userId: null })

  await openAs(page, 'ana')
  await waitForConnection(page, { userId: 'usr_ana' })

  await openAs(page, 'bruno')
  await expect
    .poll(async () => (await realtime(page).connections()).map((c) => c.userId))
    .toEqual(['usr_bruno'])
  expect(await realtime(page).connections()).toHaveLength(1)
  // The live switch, with no reload, is covered in `auth.spec.ts`.
})

// Bruno asks for Ana's order with his token on the developer page, so the browser logs the 403.
test.describe("another collector's order", () => {
  test.use({ allowedConsoleErrors: [/status of 403/] })

  test('order.updated reaches only the owner (RT-07, RT-08, RT-14)', async ({ page }) => {
    // The scenario reseeds the mock and drops its sessions, so Bruno signs in after it.
    await open(page, '/dev/realtime?scenario=pending-order')
    await waitForConnection(page)
    await openAs(page, 'bruno')
    await loadOrder(page, 'ord_000002')
    await waitForConnection(page, { userId: 'usr_bruno' })

    // Bruno is connected: the settlement of Ana's order is not for him.
    await realtime(page).clearLog()
    await mock(page).settleOrder('ord_000002', 'confirmed')
    await expect
      .poll(async () => (await realtime(page).log()).filter((e) => e.type === 'order.updated'))
      .toMatchObject([{ eventId: 'evt_order.updated_ord_000002_2', connectionIds: [] }])
    await expect(page.getByText('Nenhum evento recebido.')).toBeVisible()
    // The page asked REST for Ana's order with Bruno's token, and was refused.
    await expect(page.getByText('Não foi possível carregar o pedido.')).toBeVisible()

    // A fresh start, with Ana connected: she sees it settle without asking REST again.
    await forgetSession(page)
    await open(page, '/dev/realtime?reset=1')
    await openAs(page, 'ana')
    await waitForConnection(page, { userId: 'usr_ana' })
    await loadOrder(page, 'ord_000002')
    await expect(orderData(page)).toContainText('Status do pedido: pendente')

    await mock(page).clearRequests()
    await mock(page).settleOrder('ord_000002', 'confirmed')
    await expect(orderData(page)).toContainText('Status do pedido: confirmado')
    await expect(orderData(page)).toContainText('Versão do pedido: 2')
    expect(await mock(page).requests({ op: 'orders.get' })).toEqual([])
  })
})

test('the mock panel can cut and restore realtime (RT-09, RT-10)', async ({ page }) => {
  await page.clock.install()
  await open(page)
  await waitForConnection(page)

  await page.keyboard.press('Alt+Shift+M')
  const panel = page.getByRole('dialog', { name: 'Simulação da API' })
  await panel.getByRole('checkbox', { name: 'Tempo real indisponível' }).check()
  await expect.poll(() => realtime(page).connections()).toEqual([])
  // The dialog hides the page from assistive tech, so the status is read after it closes.
  await page.keyboard.press('Escape')
  await expect(status(page)).toHaveText('Status: reconectando')

  await page.keyboard.press('Alt+Shift+M')
  await panel.getByRole('checkbox', { name: 'Tempo real indisponível' }).uncheck()
  await page.keyboard.press('Escape')
  await page.clock.runFor(5000)
  await expect(status(page)).toHaveText('Status: conectado')
  expect(await realtime(page).connections()).toHaveLength(1)
})

test.describe('offline scenario', () => {
  // Every REST call fails on purpose, and the browser logs each one.
  test.use({ allowedConsoleErrors: [/net::ERR_|Failed to load resource/] })

  test('with realtime unavailable the page keeps retrying and the server has no connection (RT-09)', async ({
    page,
  }) => {
    await page.clock.install()
    await open(page, '/dev/realtime?scenario=offline')
    await page.clock.runFor(4000)
    await expect(status(page)).toHaveText('Status: reconectando')
    expect(await realtime(page).connections()).toEqual([])

    // Turning it back on lets the next attempt through.
    await mock(page).configure({ realtime: { available: true } })
    await page.clock.runFor(6000)
    await expect(status(page)).toHaveText('Status: conectado')
    expect(await realtime(page).connections()).toHaveLength(1)
  })
})
