import type { Page } from '@playwright/test'

import { CREDENTIALS } from '../src/mocks/fixtures/credentials'
import { expectNoAxeViolations } from './support/a11y'
import { eth } from './support/checkout'
import { expectNoHorizontalOverflow } from './support/layout'
import { loginAs, mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 10 design §8: the receipt at `/orders/$orderId`. The purchase path to it is `purchase.spec.ts`
// (scenario 6); this file covers direct access, the order's states, the snapshot and the layouts.
// Ana's seeded order is `ord_000001` (Sage Nomad #009 1 x 1.69, Golden Signal #160 2 x 0.39,
// KURIO10 -10%, Ethereum fee 0.016): subtotal 2.47, discount 0.247, total 2.239 ETH.

// The 403, 404 and 503 answers are logged by the browser, and the router logs the loader error that
// the 503 test lets reach the error component.
test.use({ allowedConsoleErrors: [/Failed to load resource|ApiError: Serviço temporariamente/] })

const receipt = (page: Page) => page.getByTestId('receipt')
const heading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Seus NFTs agora estão na sua carteira' })

async function openOrder(page: Page, orderId: string, as: 'ana' | 'bruno' = 'ana') {
  await page.goto('/')
  await loginAs(page, as)
  await page.goto(`/orders/${orderId}`)
}

const amounts = async (page: Page) => ({
  lines: await page.getByTestId('receipt-line').allInnerTexts(),
  subtotal: await page.getByTestId('receipt-row-subtotal').innerText(),
  discount: await page.getByTestId('receipt-row-discount').innerText(),
  fee: await page.getByTestId('receipt-row-fee').innerText(),
  total: await page.getByTestId('receipt-row-total').innerText(),
})

test.describe('the receipt of a confirmed order (RCPT-08 – RCPT-11, RCPT-13)', () => {
  test('Ana opens her order directly and finds everything in it', async ({ page, isMobile }) => {
    await openOrder(page, 'ord_000001')
    await expect(heading(page)).toBeVisible()
    await expect(page).toHaveTitle('Pedido confirmado · KURIO')
    await expect(page).toHaveURL(/\/orders\/ord_000001$/)

    // The summary band: shortened hash (full one for assistive technology), date, total, wallet.
    const state = await mock(page).snapshot()
    const hash = state.orders.ord_000001?.transaction?.hash ?? ''
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/)
    await expect(page.getByTestId('receipt-hash')).toContainText(
      `${hash.slice(0, 8)}…${hash.slice(-4)}`,
    )
    await expect(page.getByTestId('receipt-hash')).toContainText(hash)
    await expect(page.getByTestId('receipt-summary')).toContainText('20 de set. de 2026')
    await expect(page.getByTestId('receipt-summary')).toContainText('MetaMask')
    await expect(page.getByTestId('receipt-summary').getByTestId('receipt-total')).toContainText(
      eth('2.239'),
    )

    // The lines, with the table semantics kept at every width (RCPT-15).
    const lines = page.getByTestId('receipt-line')
    await expect(lines).toHaveCount(2)
    await expect(lines.nth(0)).toContainText('Sage Nomad #009')
    await expect(lines.nth(0)).toContainText('ID do token: #0009')
    await expect(lines.nth(0)).toContainText('(x 1)')
    await expect(lines.nth(0)).toContainText(eth('1.69'))
    await expect(lines.nth(1)).toContainText('Golden Signal #160')
    await expect(lines.nth(1)).toContainText('(x 2)')
    await expect(lines.nth(1)).toContainText(eth('0.78'))
    await expect(page.getByRole('table', { name: 'Itens da compra' })).toBeAttached()
    await expect(page.getByRole('columnheader')).toHaveCount(3)

    // Subtotal, discount with its coupon, fee, total.
    await expect(page.getByTestId('receipt-row-subtotal')).toContainText(eth('2.47'))
    await expect(page.getByTestId('receipt-row-discount')).toContainText('Desconto (KURIO10)')
    await expect(page.getByTestId('receipt-row-discount')).toContainText(eth('0.247'))
    await expect(page.getByTestId('receipt-row-fee')).toContainText(eth('0.016'))
    await expect(page.getByTestId('receipt-row-total')).toContainText(eth('2.239'))

    await expect(page.getByTestId('receipt-note')).toHaveText(
      'Transação confirmada na Ethereum. A propriedade foi transferida para sua carteira conectada e registrada na rede.',
    )

    // The explorer is simulated and says so (RCPT-11).
    const explorer = page.getByRole('link', { name: /^Ver no Etherscan/ })
    await expect(explorer).toHaveAttribute(
      'href',
      `https://explorer.kurio.example/ethereum/tx/${hash}`,
    )
    await expect(explorer).toHaveAttribute('target', '_blank')
    await expect(explorer).toHaveAttribute('rel', /noopener/)
    await expect(page.getByText('Link de demonstração: o explorador é simulado.')).toBeVisible()

    // Direct access does not rely on the catalog (RCPT-08).
    const requests = await mock(page).requests()
    expect(requests.filter((entry) => entry.op.startsWith('nfts.'))).toEqual([])
    expect(requests.filter((entry) => entry.op === 'orders.get')).not.toHaveLength(0)

    // Direct access leaves focus alone (RCPT-15).
    await expect(heading(page)).not.toBeFocused()
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page)

    // The close button is the desktop's; the mobile top bar has its own back button.
    await expect(page.getByRole('link', { name: 'Fechar' })).toBeVisible({ visible: !isMobile })
  })

  test('the amounts do not follow the catalog (RCPT-12)', async ({ page }) => {
    await openOrder(page, 'ord_000001')
    await expect(heading(page)).toBeVisible()
    const before = await amounts(page)

    // The catalog moves on after the purchase: a price change and a sell-out of what was bought.
    await mock(page).updateNft('sage-nomad-009', { price: '9.99' })
    await mock(page).updateNft('golden-signal-160', {
      price: '5.5',
      available: { editionId: 'open', value: 0 },
    })
    // The change reaches the open page through the socket, and the receipt does not move.
    await page.waitForTimeout(500)
    expect(await amounts(page)).toEqual(before)

    await page.reload()
    await expect(heading(page)).toBeVisible()
    expect(await amounts(page)).toEqual(before)
    await expect(page.getByTestId('receipt-line').nth(0)).not.toContainText('9.99')
  })

  test('the close button and "Continuar explorando" lead to the catalog (RCPT-16)', async ({
    page,
    isMobile,
  }) => {
    await openOrder(page, 'ord_000001')
    await page.getByRole('link', { name: 'Continuar explorando' }).click()
    await expect(page).toHaveURL(/\/$/)

    if (isMobile) return
    await page.goBack()
    await expect(heading(page)).toBeVisible()
    await page.getByRole('link', { name: 'Fechar' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('access (RCPT-01 – RCPT-04)', () => {
  test('a guest is sent to login and comes back to the order (RCPT-01)', async ({ page }) => {
    await page.goto('/orders/ord_000001')
    await expect(page).toHaveURL(/\/login\?redirect=%2Forders%2Ford_000001/)

    await page.getByRole('main').getByLabel('E-mail', { exact: true }).fill(CREDENTIALS.ana.email)
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill(CREDENTIALS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL(/\/orders\/ord_000001$/)
    await expect(heading(page)).toBeVisible()
  })

  test("another collector's order is not shown (RCPT-03)", async ({ page }) => {
    await openOrder(page, 'ord_000001', 'bruno')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Você não tem acesso a este pedido.' }),
    ).toBeVisible()
    await expect(page).toHaveTitle('Pedido indisponível · KURIO')
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await expect(page.getByText('Sage Nomad #009')).toHaveCount(0)
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Voltar ao início' }),
    ).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('an order that does not exist is a 404 with the URL kept (RCPT-02)', async ({ page }) => {
    await openOrder(page, 'ord_999999')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/orders\/ord_999999$/)
  })

  test('a failed load shows an inline error and "Tentar novamente" recovers (RCPT-04)', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/')
    await loginAs(page, 'ana')
    await mock(page).addRule({
      op: 'orders.get',
      effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
      times: 3,
    })
    await page.goto('/orders/ord_000001')
    await page.clock.runFor(5000)

    await expect(
      page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' }),
    ).toBeVisible()
    await expect(receipt(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await page.clock.runFor(500)
    await expect(heading(page)).toBeVisible()
  })
})

test.describe('an order that is not confirmed has no receipt (RCPT-05 – RCPT-07)', () => {
  test('a pending order shows the processing panel, then the receipt in place (RCPT-06)', async ({
    page,
  }) => {
    await page.goto('/?scenario=pending-order')
    await loginAs(page, 'ana')
    await page.goto('/orders/ord_000002')

    const pending = page.getByTestId('order-pending')
    await expect(pending).toContainText('Processando pagamento')
    await expect(pending).toContainText('ord_000002')
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await expect(heading(page)).toHaveCount(0)
    await expect(page).toHaveTitle('Pedido ord_000002 · KURIO')

    await page.waitForFunction(() => '__mock' in window)
    await mock(page).settleOrder('ord_000002', 'confirmed')

    // Same page, no reload: the receipt takes the panel's place and the heading takes focus.
    await expect(heading(page)).toBeVisible()
    await expect(heading(page)).toBeFocused()
    await expect(pending).toHaveCount(0)
    await expect(page).toHaveTitle('Pedido confirmado · KURIO')
    await expect(page.getByTestId('receipt-line')).toHaveCount(1)
    await expect(page.getByTestId('receipt-line')).toContainText('Cosmic Bloom #118')
    await expect(page).toHaveURL(/\/orders\/ord_000002$/)
  })

  test('a declined order shows the refusal and the ways on (RCPT-07)', async ({ page }) => {
    await page.goto('/?scenario=pending-order')
    await loginAs(page, 'ana')
    await page.goto('/orders/ord_000002')
    await expect(page.getByTestId('order-pending')).toBeVisible()

    await page.waitForFunction(() => '__mock' in window)
    await mock(page).settleOrder('ord_000002', 'declined')

    const declined = page.getByTestId('order-declined')
    await expect(declined).toBeVisible()
    await expect(declined).toContainText('Pagamento recusado')
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
    ).toHaveCount(0)
    await expect(declined.getByRole('link', { name: 'Voltar ao carrinho' })).toHaveAttribute(
      'href',
      '/cart',
    )
    await declined.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
  })
})

test.describe('layouts (RCPT-13 – RCPT-15)', () => {
  test('desktop: the Figma card, centered, with the close button and the bar', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop composition')
    await openOrder(page, 'ord_000001')
    await expect(heading(page)).toBeVisible()
    const box = await receipt(page).boundingBox()
    expect(box?.width).toBe(580)
    const viewport = page.viewportSize()?.width ?? 0
    expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(viewport / 2, 0)
    await expect(
      page
        .getByRole('table', { name: 'Itens da compra' })
        .getByRole('columnheader', { name: 'Edições' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Fechar' })).toBeVisible()
  })

  test('mobile: a full-width page, no horizontal scroll, the explorer action fixed at the bottom', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile composition')
    await openOrder(page, 'ord_000001')
    await expect(heading(page)).toBeVisible()
    await expectNoHorizontalOverflow(page)

    // The shell's back button replaces the close button; the column headers stay for readers only.
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Fechar' })).toBeHidden()
    await expect(page.getByRole('columnheader', { name: 'Edições' })).toBeAttached()

    const explorer = page.getByTestId('explorer-link')
    await expect(explorer).toBeInViewport()
    const link = await explorer.boundingBox()
    const height = page.viewportSize()?.height ?? 0
    expect((link?.y ?? 0) + (link?.height ?? 0)).toBeGreaterThan(height - 40)
    expect(link?.width ?? 0).toBeGreaterThan(300)

    // Scrolled to the end, the last line and the note are not hidden under the bar.
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await expect(page.getByRole('link', { name: 'Continuar explorando' })).toBeInViewport()
    await expectNoAxeViolations(page)
  })
})
