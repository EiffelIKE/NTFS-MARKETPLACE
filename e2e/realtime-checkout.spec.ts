import type { Page } from '@playwright/test'

import { expectNoAxeViolations } from './support/a11y'
import {
  accept,
  assertive,
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
import { mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 09 design §12 (brief §9 scenario 9): the quote moves while the collector is in checkout. A
// live `nft.updated` during the review, and the two scenarios that change the world at the moment
// of payment. Whatever changes, the collector looks at the new values and confirms again, and the
// order is created from the quote they last saw. The browser logs the refused `orders.create`.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const review = (page: Page) => reviewDialog(page)
const changed = (page: Page) => review(page).getByTestId('quote-changed')
const blocked = (page: Page) => review(page).getByTestId('quote-blocked')
const total = (page: Page) => review(page).getByTestId('quote-total')
const orders = async (page: Page) => Object.values((await mock(page).snapshot()).orders)

test.describe('a live price change during the review (CHK-19, CHK-20)', () => {
  test('shows the new values, asks to accept them and orders with the new quote', async ({
    page,
  }) => {
    await openCheckout(page)
    await settle(page)
    await openReview(page)
    await connectWallet(page)
    await expect(total(page)).toContainText(eth('3.186'))
    await expect(pay(page)).toBeEnabled()

    // The price rises after the collector opened the review.
    await mock(page).updateNft('emerald-ape-042', { price: '1.29' })

    await expect(changed(page)).toBeVisible()
    await expect(changed(page)).toContainText('Os valores do pedido mudaram.')
    await expect(assertive(page)).toContainText('Os valores do pedido mudaram.')
    await expect(total(page)).toContainText(eth('3.286'))
    // The old amount stays readable, struck, so the change is not only a color (DS rules).
    await expect(total(page)).toContainText(eth('3.186'))
    // Payment is off until the new values are accepted (CHK-20).
    await expect(pay(page)).toHaveCount(0)
    await expect(accept(page)).toBeFocused()
    await expectNoAxeViolations(page)

    await accept(page).click()
    await expect(pay(page)).toBeEnabled()
    await expect(pay(page)).toBeFocused()
    await expect(changed(page)).toHaveCount(0)
    await pay(page).click()

    await expect(pending(page)).toBeVisible()
    const created = (await orders(page)).filter((order) => order.id !== 'ord_000001')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ subtotal: '3.27', total: '3.286' })
  })

  test('a change in availability blocks payment and offers the way back (CHK-21)', async ({
    page,
  }) => {
    await openCheckout(page)
    await settle(page)
    await openReview(page)
    await connectWallet(page)

    await mock(page).updateNft('emerald-ape-042', { available: { editionId: 'open', value: 0 } })

    await expect(blocked(page)).toBeVisible()
    await expect(blocked(page)).toContainText('Emerald Ape #042')
    await expect(blocked(page)).toContainText('esgotado')
    await expect(pay(page)).toBeDisabled()
    await expectNoAxeViolations(page)

    await review(page).getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page).toHaveURL(/\/cart$/)
    expect(await mock(page).requests({ op: 'orders.create' })).toEqual([])
  })
})

test.describe('the world changes at the moment of payment (CHK-20, CHK-21)', () => {
  test('price-change-on-checkout: the 409 brings the new quote and a second look', async ({
    page,
  }) => {
    await openCheckout(page, { scenario: 'price-change-on-checkout' })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)
    await expect(total(page)).toContainText(eth('3.186'))

    await pay(page).click()

    // Nothing was created; the screen shows what the API now asks for.
    await expect(changed(page)).toBeVisible()
    expect(await orders(page)).toHaveLength(1)
    const newTotal = total(page).locator('[data-changed]')
    await expect(newTotal).not.toContainText(eth('3.186'))
    const refreshed = /(\d+\.\d+)\sETH/.exec(await newTotal.innerText())?.[1]
    expect(refreshed).toBeDefined()
    await expect(pay(page)).toHaveCount(0)

    await accept(page).click()
    await pay(page).click()
    await expect(pending(page)).toBeVisible()
    const created = (await orders(page)).filter((order) => order.id !== 'ord_000001')
    expect(created).toHaveLength(1)
    expect(created[0]?.total).toBe(refreshed)
    expect(await mock(page).requests({ op: 'orders.create' })).toHaveLength(2)
  })

  test('sold-out-on-checkout: the 409 lists the lines and offers the cart', async ({ page }) => {
    await openCheckout(page, { scenario: 'sold-out-on-checkout' })
    await expectFormReady(page)
    await reviewConnectAndPay(page)

    await expect(blocked(page)).toBeVisible()
    await expect(blocked(page)).toContainText('esgotado')
    await expect(pay(page)).toBeDisabled()
    expect(await orders(page)).toHaveLength(1)

    await review(page).getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page).toHaveURL(/\/cart$/)
  })
})

test.describe('the network (CHK-11, CHK-12)', () => {
  test('Polygon asks for its own quote: its fee and its total, nothing computed here', async ({
    page,
    isMobile,
  }) => {
    await openCheckout(page)
    await settle(page)
    if (isMobile) await page.getByRole('button', { name: 'Dados do colecionador' }).click()

    const network = page.getByRole('main').getByRole('combobox', { name: /^Rede/ })
    await network.click()
    // An EVM wallet cannot pay on Solana: only EVM networks are offered.
    await expect(page.getByRole('option', { name: 'Solana' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Polygon' }).click()
    if (isMobile) await page.getByRole('button', { name: 'Dados do colecionador' }).click()

    await openReview(page)
    await expect(review(page).getByTestId('review-network')).toHaveText('Polygon')
    await expect(review(page).getByTestId('quote-fee')).toContainText(eth('0.002'))
    await expect(review(page).getByTestId('quote-total')).toContainText(eth('3.172'))

    // The connection is for Ethereum: Polygon needs its own (CHK-17).
    await connectWallet(page)
    await pay(page).click()
    await expect(pending(page)).toBeVisible()
    await expect(pending(page)).toContainText('Polygon')
    const created = (await orders(page)).filter((order) => order.id !== 'ord_000001')
    expect(created[0]).toMatchObject({ network: 'polygon', networkFee: '0.002', total: '3.172' })
  })

  test('the address cannot be edited and follows the chosen wallet (CHK-10)', async ({
    page,
    isMobile,
  }) => {
    await openCheckout(page)
    await settle(page)
    if (isMobile) {
      await page.getByRole('radio', { name: /Carteira Polygon/ }).check({ force: true })
      await page.getByRole('button', { name: 'Dados do colecionador' }).click()
    } else {
      await page.getByRole('checkbox', { name: 'Usar outra carteira?' }).check()
    }
    await expect(field(page, 'Endereço da carteira')).toHaveAttribute('readonly', '')
    await expect(field(page, 'ENS ou carteira secundária')).toBeVisible()
    await expect(field(page, 'Rede')).toBeVisible()
  })
})
