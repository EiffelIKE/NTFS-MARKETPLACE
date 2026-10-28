import type { Page } from '@playwright/test'

import { CREDENTIALS } from '../src/mocks/fixtures/credentials'
import { expectNoAxeViolations } from './support/a11y'
import {
  checkoutHeading,
  confirmPurchase,
  connectWallet,
  eth,
  expectFormReady,
  field,
  openCheckout,
  openReview,
  pay,
  pending,
  reviewConnectAndPay,
  reviewDialog,
  settle,
} from './support/checkout'
import { expectNoHorizontalOverflow } from './support/layout'
import { apiFetch, bearer, loginAs, mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 09 design §12 (brief §9 scenario 6): the purchase from the cart to a confirmed order, and
// the gates in front of it. The receipt is spec 10's: the purchase test stops at the navigation to
// `/orders/$orderId`.

const summaryLines = (page: Page) => page.getByTestId('checkout-summary').getByTestId('quote-line')

// The 503s of the region-error test are logged by the browser.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

test.describe('the purchase (CHK-01, CHK-06, CHK-14, CHK-18, CHK-29, CHK-31)', () => {
  test('Ana pays from her cart and lands on the confirmed order', async ({ page, isMobile }) => {
    await loginAs(page, 'ana')
    await page.goto('/cart')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page).toHaveTitle('Finalizar compra · KURIO')
    await expectFormReady(page)

    // Her details and wallet are already filled in: she only confirms (CHK-06).
    const details = isMobile ? page.getByRole('button', { name: 'Dados do colecionador' }) : null
    await details?.click()
    await expect(field(page, 'Nome de exibição')).toHaveValue('Ana Souza')
    await expect(field(page, 'Nome de usuário')).toHaveValue('anasouza')
    await expect(field(page, 'E-mail')).toHaveValue('ana@kurio.example')
    await expect(field(page, 'Nome ENS')).toHaveValue('ana')
    await expect(field(page, 'Código de indicação')).toHaveValue('ANA-KURIO')
    await expect(field(page, 'Endereço da carteira')).toHaveAttribute('readonly', '')
    await details?.click()

    // The summary and the review show what the quote says, nothing computed here (CHK-12).
    if (!isMobile) {
      await expect(summaryLines(page)).toHaveCount(2)
      await expect(page.getByTestId('quote-total')).toContainText(eth('3.186'))
      await expectNoAxeViolations(page)
    }
    await expectNoHorizontalOverflow(page)

    await openReview(page)
    const review = reviewDialog(page)
    await expect(review.getByTestId('quote-subtotal')).toContainText(eth('3.17'))
    await expect(review.getByTestId('quote-fee')).toContainText(eth('0.016'))
    await expect(review.getByTestId('quote-total')).toContainText(eth('3.186'))
    await expect(review.getByTestId('review-network')).toHaveText('Ethereum')
    await expect(review.getByTestId('review-provider')).toHaveText('MetaMask')
    // Nothing is paid until the wallet is connected (CHK-14).
    await expect(pay(page)).toBeDisabled()
    await expectNoAxeViolations(page)
    await connectWallet(page)
    await expect(pay(page)).toBeEnabled()
    await pay(page).click()

    // The default scenario settles after 3 s: the page follows the order to its page.
    await expect(page).toHaveURL(/\/orders\/ord_000002$/, { timeout: 15_000 })
    // TODO(spec 10): replace this stub assertion with the receipt (items, totals, transaction).
    await expect(
      page.getByRole('heading', { level: 1, name: 'Confirmação do pedido' }),
    ).toBeVisible()

    const state = await mock(page).snapshot()
    expect(Object.values(state.orders).map((order) => [order.id, order.status])).toEqual([
      ['ord_000001', 'confirmed'],
      ['ord_000002', 'confirmed'],
    ])
    expect(await mock(page).requests({ op: 'orders.create' })).toHaveLength(1)

    // What was bought left the cart (CHK-34).
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('shows the order as processing first, with its id, and announces it (CHK-29)', async ({
    page,
  }) => {
    await openCheckout(page, { scenario: 'payment-manual' })
    await expectFormReady(page)
    await reviewConnectAndPay(page)

    await expect(pending(page)).toBeVisible()
    await expect(pending(page)).toContainText('Processando pagamento')
    await expect(pending(page)).toContainText('ord_000002')
    await expect(pending(page)).toContainText('Ethereum')
    // The form is gone: there is no button that could pay again (CHK-30).
    await expect(confirmPurchase(page)).toHaveCount(0)
    await expect(reviewDialog(page)).toHaveCount(0)
    await expect(page.getByTestId('announcer-polite')).toContainText('Processando pagamento')
    await expectNoAxeViolations(page)

    // Settlement from outside travels through the socket and ends the wait.
    await mock(page).settleOrder('ord_000002', 'confirmed')
    await expect(page).toHaveURL(/\/orders\/ord_000002$/)
  })

  test('removes only what was bought: lines added while the order was pending stay (CHK-34)', async ({
    page,
  }) => {
    await page.goto('/?scenario=payment-manual')
    const token = await loginAs(page, 'ana')
    await page.goto('/checkout')
    await expectFormReady(page)
    await reviewConnectAndPay(page)
    await expect(pending(page)).toBeVisible()

    const added = await apiFetch(page, '/cart/items', {
      method: 'POST',
      headers: bearer(token),
      body: { nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 },
    })
    expect(added.status).toBe(200)

    await mock(page).settleOrder('ord_000002', 'confirmed')
    await expect(page).toHaveURL(/\/orders\/ord_000002$/)

    await page.goto('/cart')
    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(1)
    await expect(lines.first()).toContainText('Penny Pixel #001')
  })
})

test.describe('access and gates (CHK-01 – CHK-04)', () => {
  test('a guest is sent to login and comes back to checkout (CHK-01)', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)

    await page.getByRole('main').getByLabel('E-mail', { exact: true }).fill(CREDENTIALS.ana.email)
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill(CREDENTIALS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL(/\/checkout$/)
    await expectFormReady(page)
  })

  test('an empty cart shows the empty state and no form (CHK-02)', async ({ page }) => {
    await loginAs(page, 'bruno')
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar NFTs' })).toBeVisible()
    await expect(confirmPurchase(page)).toHaveCount(0)
    await expect(checkoutHeading(page)).toBeAttached()
  })

  test('a collector with no wallet is sent to register one (CHK-03)', async ({ page }) => {
    const token = await loginAs(page, 'carla')
    await apiFetch(page, '/cart/items', {
      method: 'POST',
      headers: bearer(token),
      body: { nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 },
    })
    await page.goto('/checkout')
    await expect(
      page.getByRole('heading', { name: 'Cadastre uma carteira para finalizar a compra' }),
    ).toBeVisible()
    await expect(confirmPurchase(page)).toHaveCount(0)
    await page.getByRole('link', { name: 'Cadastrar carteira' }).click()
    await expect(page).toHaveURL(/\/wallets$/)
  })

  test('an unavailable cart shows an inline error that "Tentar novamente" clears (CHK-04)', async ({
    page,
  }) => {
    await page.clock.install()
    await loginAs(page, 'ana')
    // What `errors-then-recover` does to the cart: three 503s exhaust the query's retries.
    await mock(page).addRule({
      op: 'cart.get',
      effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
      times: 3,
    })
    await page.goto('/checkout')
    await page.clock.runFor(5000)

    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
    await expect(alert.first()).toBeVisible()
    await expect(confirmPurchase(page)).toHaveCount(0)

    await page.getByRole('main').getByRole('button', { name: 'Tentar novamente' }).first().click()
    await page.clock.runFor(500)
    await expect(confirmPurchase(page)).toBeVisible()
  })
})

// Kept so a reader finds the viewport-specific expectations in one place.
test('the collector sees the composition of her viewport (CHK-35)', async ({ page, isMobile }) => {
  await openCheckout(page)
  await settle(page)
  if (isMobile) {
    await expect(page.getByTestId('wallet-card')).toHaveCount(2)
    await expect(page.getByTestId('compatible-wallets')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Dados do colecionador' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect(confirmPurchase(page)).toBeInViewport()
  } else {
    await expect(page.getByTestId('compatible-wallets')).toBeVisible()
    await expect(page.getByTestId('wallet-card')).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: 'Usar outra carteira?' })).toBeVisible()
  }
  await expectNoHorizontalOverflow(page)
})
