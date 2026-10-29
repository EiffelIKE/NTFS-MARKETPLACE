import type { Page } from '@playwright/test'

import { CREDENTIALS } from '../src/mocks/fixtures/credentials'
import { expectNoAxeViolations } from './support/a11y'
import { ANA_TX_HASH, ANA_TX_PATH } from './support/explorer'
import { expectNoHorizontalOverflow } from './support/layout'
import { forgetSession, loginAs, mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 10 amendment: the simulated block explorer at `/explorer/$network/tx/$txHash`, reached from
// the receipt. Ana's seeded `ord_000001`: Sage Nomad #009 (1 x 1.69) and Golden Signal #160
// (2 x 0.39), KURIO10, Ethereum fee 0.016: the receipt total is 2.239 ETH and the contract
// received 2.223.

// The 404 answers are logged by the browser, and the router logs the loader error of the 503 test.
test.use({ allowedConsoleErrors: [/Failed to load resource|ApiError: Serviço temporariamente/] })

const banner = (page: Page) => page.getByTestId('explorer-banner')
const heading = (page: Page) => page.getByRole('heading', { level: 1 })

async function expectTransaction(page: Page) {
  await expect(heading(page)).toHaveText('Detalhes da transação')
  await expect(banner(page)).toContainText('Explorador simulado — ambiente de demonstração')
  await expect(page.getByTestId('explorer-hash')).toHaveText(ANA_TX_HASH)
  await expect(page.getByTestId('explorer-status')).toHaveText('Confirmada')
  await expect(page.getByTestId('explorer-value')).toContainText('2.223 ETH')
  await expect(page.getByTestId('explorer-fee')).toContainText('0.016 ETH')
}

test.describe('from the receipt to the explorer', () => {
  test('the link opens the simulated explorer in the same tab, with the receipt amounts', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await loginAs(page, 'ana')
    await page.goto('/orders/ord_000001')
    await expect(page.getByTestId('receipt')).toBeVisible()
    const receiptTotal = await page.getByTestId('receipt-row-total').locator('dd').innerText()
    const receiptFee = await page.getByTestId('receipt-row-fee').locator('dd').innerText()
    const hash = (await mock(page).snapshot()).orders.ord_000001?.transaction?.hash ?? ''
    expect(hash).toBe(ANA_TX_HASH)

    const pages = context.pages().length
    await page.getByRole('link', { name: 'Ver no Etherscan' }).click()

    // Same tab, an in-app navigation: no new page, no reload of the app.
    await expect(page).toHaveURL(new RegExp(`/explorer/ethereum/tx/${hash}$`))
    expect(context.pages()).toHaveLength(pages)
    await expectTransaction(page)
    await expect(page).toHaveTitle(`Transação ${hash.slice(0, 10)}… · KURIO`)

    // The same hash, and amounts that add up to the receipt: value + fee = total.
    await expect(page.getByTestId('explorer-fee')).toHaveText(receiptFee)
    expect(receiptTotal).toBe('2.239\u00A0ETH')
    await expect(page.getByTestId('explorer-from')).toHaveText(
      (await mock(page).snapshot()).orders.ord_000001?.wallet.address ?? '',
    )

    // The items moved, with their editions and quantities.
    const items = page.getByTestId('explorer-item')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('Sage Nomad #009')
    await expect(items.nth(0)).toContainText('1/10')
    await expect(items.nth(0)).toContainText('x 1')
    await expect(items.nth(1)).toContainText('Golden Signal #160')
    await expect(items.nth(1)).toContainText('ABERTA')
    await expect(items.nth(1)).toContainText('x 2')

    // Back brings the receipt back.
    await page.goBack()
    await expect(page.getByTestId('receipt')).toBeVisible()
  })

  test('the page shows no private data of the collector', async ({ page }) => {
    await page.goto('/')
    await loginAs(page, 'ana')
    await page.goto('/orders/ord_000001')
    await page.getByRole('link', { name: 'Ver no Etherscan' }).click()
    await expectTransaction(page)

    // The header names the signed-in user; the transaction itself must not.
    const main = page.getByRole('main')
    const text = (await main.innerText()) + (await main.innerHTML())
    const order = (await mock(page).snapshot()).orders.ord_000001
    for (const secret of [
      CREDENTIALS.ana.email,
      order?.collector.displayName ?? 'x',
      order?.collector.referralCode ?? 'x',
      order?.wallet.nickname ?? 'x',
      'KURIO10',
      'ord_000001',
    ]) {
      expect(text).not.toContain(secret)
    }
  })
})

test.describe('direct access and refresh', () => {
  test('a visitor with no session opens the address, and a refresh keeps it', async ({ page }) => {
    await page.goto('/')
    await forgetSession(page)
    await page.goto(ANA_TX_PATH)
    await expectTransaction(page)
    await expect(page).toHaveURL(new RegExp(`${ANA_TX_PATH}$`))

    await page.reload()
    await expectTransaction(page)
    await expect(page).toHaveURL(new RegExp(`${ANA_TX_PATH}$`))
  })

  test('another signed-in user sees the same public transaction', async ({ page }) => {
    await page.goto('/')
    await loginAs(page, 'bruno')
    await page.goto(ANA_TX_PATH)
    await expectTransaction(page)
  })
})

test.describe('transactions that do not exist', () => {
  test('an unknown hash is a not-found state, the URL unchanged', async ({ page }) => {
    const path = `/explorer/ethereum/tx/0x${'0'.repeat(64)}`
    await page.goto(path)
    await expect(heading(page)).toHaveText('Transação não encontrada')
    await expect(page).toHaveTitle('Transação não encontrada · KURIO')
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(
      page.getByRole('main').getByRole('status').filter({ hasText: 'Explorador simulado' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao mercado' })).toBeVisible()
    await expectNoAxeViolations(page)

    await page.reload()
    await expect(heading(page)).toHaveText('Transação não encontrada')
  })

  test('a real hash on another network is not found either', async ({ page }) => {
    await page.goto(ANA_TX_PATH.replace('/ethereum/', '/polygon/'))
    await expect(heading(page)).toHaveText('Transação não encontrada')
  })

  test('a network that does not exist is not found without asking the API', async ({ page }) => {
    await page.goto(ANA_TX_PATH.replace('/ethereum/', '/bitcoin/'))
    await expect(heading(page)).toHaveText('Transação não encontrada')
    expect(await mock(page).requests({ op: 'explorer.getTransaction' })).toHaveLength(0)
  })

  test('a failing request shows an inline error and "Tentar novamente" recovers', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/')
    await page.waitForFunction(() => '__mock' in window)
    await mock(page).addRule({
      op: 'explorer.getTransaction',
      effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
      times: 3,
    })
    await page.goto(ANA_TX_PATH)
    await page.clock.runFor(5000)
    await expect(
      page.getByRole('alert').filter({ hasText: 'Não foi possível carregar esta transação' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await page.clock.runFor(500)
    await expectTransaction(page)
  })
})

test.describe('layouts', () => {
  for (const width of [390, 768, 1440]) {
    test(`${String(width)} px: no horizontal scroll, no serious axe violation`, async ({
      page,
      isMobile,
    }) => {
      // The two projects fix the width of their device; the others are set on top of it.
      test.skip(isMobile && width === 1440, 'a phone is not 1440 wide')
      test.skip(!isMobile && width === 390, 'covered by the mobile project')
      await page.setViewportSize({ width, height: 900 })
      await page.goto(ANA_TX_PATH)
      await expectTransaction(page)
      await expect(page.getByTestId('explorer-item')).toHaveCount(2)
      await expectNoHorizontalOverflow(page)
      await expectNoAxeViolations(page)
    })
  }

  test('the long hash and addresses wrap inside the card', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the narrowest layout')
    await page.goto(ANA_TX_PATH)
    await expectTransaction(page)
    const card = await page.getByTestId('explorer-hash').boundingBox()
    const viewport = page.viewportSize()?.width ?? 0
    expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThanOrEqual(viewport)
  })

  test('mobile: the shell shows the back button and the title', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile shell')
    await page.goto(ANA_TX_PATH)
    await expectTransaction(page)
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
  })
})
