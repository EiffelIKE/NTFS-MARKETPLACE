import type { Page } from '@playwright/test'

import { expectNoAxeViolations } from './support/a11y'
import {
  assertive,
  confirmPurchase,
  connectWallet,
  connection,
  ensureConnected,
  declined,
  eth,
  expectFormReady,
  field,
  openCheckout,
  openReview,
  pay,
  pending,
  readAttempt,
  reviewConnectAndPay,
  reviewDialog,
  settle,
  storeAttempt,
} from './support/checkout'
import { apiFetch, bearer, forgetSession, loginAs, mock } from './support/mock'
import { waitForConnection } from './support/realtime'
import { expect, test } from './support/test'

// Spec 09 design §12 (brief §9 scenario 7): the purchase when things go wrong. A declined payment,
// repeated clicks, a lost response, a wallet that refuses or drops, and an expired session. In every
// case at most one order exists and nothing the collector typed is lost. The browser logs each
// refused request, and refusals are the point here.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const ordersOf = async (page: Page) => Object.keys((await mock(page).snapshot()).orders)
const note = (page: Page) => page.getByRole('main').getByLabel(/^Observação do colecionador/)

/** The mobile composition keeps the collector form collapsed; this opens it when it is. */
async function openDetails(page: Page, isMobile: boolean) {
  if (!isMobile) return
  const toggle = page.getByRole('button', { name: 'Dados do colecionador' })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
}

test.describe('declined payment (CHK-32)', () => {
  test('keeps the cart, offers a retry and then confirms', async ({ page }) => {
    await openCheckout(page, { scenario: 'payment-declined' })
    await expectFormReady(page)
    await reviewConnectAndPay(page)

    await expect(pending(page)).toBeVisible()
    await expect(declined(page)).toBeVisible({ timeout: 15_000 })
    await expect(declined(page)).toContainText('Pagamento recusado')
    await expect(assertive(page)).toContainText('Pagamento recusado')
    await expect(declined(page).getByRole('link', { name: 'Voltar ao carrinho' })).toBeVisible()
    await expect(confirmPurchase(page)).toHaveCount(0)
    await expectNoAxeViolations(page)

    // The cart is exactly what it was: the declined order released its stock, nothing was removed.
    const cart = await mock(page).snapshot()
    expect(cart.carts['user:usr_ana']?.items.map((item) => item.nftId)).toEqual([
      'emerald-ape-042',
      'golden-beat-207',
    ])

    // The next payment goes through, and "Tentar novamente" starts a new attempt from the same data.
    await mock(page).configure({ payment: { outcome: 'confirm' } })
    await declined(page).getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(reviewDialog(page)).toBeVisible()
    await expect(reviewDialog(page).getByTestId('quote-total')).toContainText(eth('3.186'))
    await ensureConnected(page)
    await pay(page).click()

    await expect(page).toHaveURL(/\/orders\/ord_000003$/, { timeout: 15_000 })
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002', 'ord_000003'])
  })

  test('"Voltar ao carrinho" leaves with the cart intact', async ({ page }) => {
    await openCheckout(page, { scenario: 'payment-declined' })
    await expectFormReady(page)
    await reviewConnectAndPay(page)
    await expect(declined(page)).toBeVisible({ timeout: 15_000 })

    await declined(page).getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
  })
})

test.describe('no duplicate orders (CHK-23 – CHK-27)', () => {
  test('three rapid clicks on "Confirmar pagamento" create one order (CHK-24)', async ({
    page,
  }) => {
    await openCheckout(page, { scenario: 'payment-manual' })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)

    await pay(page).click({ clickCount: 3 })

    await expect(pending(page)).toBeVisible()
    expect(await mock(page).requests({ op: 'orders.create' })).toHaveLength(1)
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])
  })

  test('a lost response is unknown, and "Tentar novamente" returns the same order (CHK-25)', async ({
    page,
  }) => {
    await page.clock.install()
    await openCheckout(page, { scenario: 'order-timeout' })
    // The payment stays pending, so the cart (and the review) are still there when the answer is lost.
    await mock(page).configure({ payment: { outcome: 'manual' } })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)
    await pay(page).click()

    // The Axios timeout is 10 s: the order exists, only the answer was lost.
    await page.clock.runFor(10_500)
    const unknown = reviewDialog(page).getByTestId('order-unknown')
    await expect(unknown).toContainText('Não conseguimos confirmar se o pedido foi criado.')
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])

    await unknown.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(pending(page)).toContainText('ord_000002')
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])
    expect(await mock(page).requests({ op: 'orders.create' })).toHaveLength(2)
  })

  test('an order that settles while its answer is lost is still found (CHK-25, CHK-26)', async ({
    page,
  }) => {
    await page.clock.install()
    await openCheckout(page, { scenario: 'order-timeout' })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)
    await pay(page).click()

    // The order settles after 3 s and leaves the cart empty while the review still waits for its
    // answer: the page finds the order by replaying the attempt instead of saying the cart is empty.
    await page.clock.runFor(4000)
    await expect(page).toHaveURL(/\/orders\/ord_000002$/)
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])
  })

  test('a reload while the answer is lost recovers the same order (CHK-26)', async ({ page }) => {
    await openCheckout(page, { scenario: 'order-timeout' })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)
    await pay(page).click()
    // The mock has written the order and is now holding the answer.
    await expect.poll(() => ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])

    await page.reload()
    await expect(pending(page)).toBeVisible()
    await expect(pending(page)).toContainText('ord_000002')
    await expect(confirmPurchase(page)).toHaveCount(0)
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])
  })

  test('a pending order blocks a second purchase on reopening checkout (CHK-30)', async ({
    page,
  }) => {
    await openCheckout(page, { scenario: 'pending-order' })
    await expect(pending(page)).toBeVisible()
    await expect(pending(page)).toContainText('ord_000002')
    await expect(confirmPurchase(page)).toHaveCount(0)
    expect(await mock(page).requests({ op: 'orders.create' })).toEqual([])
  })
})

test.describe('stale attempts (R2, R3)', () => {
  test('an attempt older than ten minutes is dropped, never replayed without a click (R2)', async ({
    page,
  }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await storeAttempt(page, { ageMs: 11 * 60_000 })

    await page.reload()
    // The form is next, with nothing paid and nothing sent on the user's behalf.
    await expectFormReady(page)
    expect(await mock(page).requests({ op: 'orders.create' })).toEqual([])
    expect(await ordersOf(page)).toEqual(['ord_000001'])
    expect(await readAttempt(page)).toBeNull()
  })

  test('a recent attempt is still replayed once, so a reload recovers the order (R2, CHK-26)', async ({
    page,
  }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await storeAttempt(page, { ageMs: 60_000 })

    await page.reload()
    await page.waitForFunction(() => '__mock' in window)
    // The replay's own request was sent: that is the recovery. The stale quote is refused, so
    // nothing is created, and the form is next.
    await expect
      .poll(async () => (await mock(page).requests({ op: 'orders.create' })).length)
      .toBe(1)
  })

  /** Pays, leaves checkout while the order is pending and returns the stored attempt. */
  async function payAndLeave(page: Page) {
    await openCheckout(page, { scenario: 'payment-manual' })
    await expectFormReady(page)
    await reviewConnectAndPay(page)
    await expect(pending(page)).toContainText('ord_000002')
    const attempt = await readAttempt(page)
    expect(attempt).toContain('ord_000002')
    await page.goto('/')
    await waitForConnection(page, { userId: 'usr_ana' })
    return attempt ?? ''
  }

  /** The next purchase: a line in the cart and /checkout, which must show the form. */
  async function buyAgain(page: Page) {
    const token = await loginAs(page, 'ana', { seed: false })
    const added = await apiFetch(page, '/cart/items', {
      method: 'POST',
      headers: bearer(token),
      body: { nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 },
    })
    expect(added.status).toBe(200)
    await page.goto('/checkout')
    await expectFormReady(page)
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(pending(page)).toHaveCount(0)
  }

  test('an order that settles while the user is elsewhere ends its attempt (R3)', async ({
    page,
  }) => {
    await payAndLeave(page)
    await mock(page).settleOrder('ord_000002', 'confirmed')
    await expect.poll(() => readAttempt(page)).toBeNull()
    await buyAgain(page)
  })

  test('seeing the settled order on its receipt ends a stored attempt, so the next purchase is not sent back (R3)', async ({
    page,
  }) => {
    const attempt = await payAndLeave(page)
    await mock(page).settleOrder('ord_000002', 'confirmed')
    await expect.poll(() => readAttempt(page)).toBeNull()
    // The attempt that a lost event would have left behind.
    await page.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, value)
      },
      ['kurio.checkout.attempt.usr_ana', attempt] as const,
    )

    await page.goto('/orders/ord_000002')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seus NFTs agora estão na sua carteira' }),
    ).toBeVisible()
    await expect.poll(() => readAttempt(page)).toBeNull()
    await buyAgain(page)
  })
})

test.describe('the wallet (CHK-15, CHK-16)', () => {
  test('a refused connection says so, keeps the form and connects on retry (CHK-15)', async ({
    page,
    isMobile,
  }) => {
    await openCheckout(page, { scenario: 'wallet-reject' })
    await expectFormReady(page)
    await openDetails(page, isMobile)
    await note(page).fill('Entregar com cuidado')
    await openReview(page)

    await connection(page)
      .getByRole('button', { name: /^Conectar / })
      .click()
    await expect(connection(page)).toContainText('A carteira recusou a conexão.')
    await expect(pay(page)).toBeDisabled()
    await expect(connection(page).getByRole('alert')).toContainText('A carteira recusou a conexão.')

    await mock(page).configure({ walletConnect: { outcome: 'approve' } })
    await connection(page).getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(connection(page)).toContainText('Conectada')
    await expect(pay(page)).toBeEnabled()

    await reviewDialog(page).getByRole('button', { name: 'Editar dados' }).click()
    await openDetails(page, isMobile)
    await expect(note(page)).toHaveValue('Entregar com cuidado')
  })

  test('a wallet that dropped asks to reconnect and then pays (CHK-16)', async ({ page }) => {
    await openCheckout(page, { scenario: 'payment-manual' })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)

    await mock(page).disconnectWallet()
    await pay(page).click()

    await expect(connection(page)).toContainText('Carteira desconectada')
    await expect(reviewDialog(page)).toContainText(
      'Sua carteira foi desconectada. Conecte novamente para pagar.',
    )
    expect(await ordersOf(page)).toEqual(['ord_000001'])

    await connectWallet(page)
    await pay(page).click()
    await expect(pending(page)).toBeVisible()
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])
  })

  test('changing the provider requires a new connection (CHK-17)', async ({ page, isMobile }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)
    await reviewDialog(page).getByRole('button', { name: 'Editar dados' }).click()

    const group = page.getByRole('radiogroup', { name: 'Carteira e rede' })
    await group.getByRole('radio', { name: 'Coinbase Wallet' }).check({ force: isMobile })
    await openReview(page)
    await expect(reviewDialog(page).getByTestId('review-provider')).toHaveText('Coinbase Wallet')
    await expect(connection(page)).toContainText('Carteira desconectada')
    await expect(pay(page)).toBeDisabled()
  })
})

test.describe('the form (CHK-07, CHK-09)', () => {
  test('an invalid field blocks the review, shows its message and takes focus (CHK-07)', async ({
    page,
    isMobile,
  }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await openDetails(page, isMobile)
    await field(page, 'Código de indicação').fill('abc')
    if (isMobile) await page.getByRole('button', { name: 'Dados do colecionador' }).click()

    await confirmPurchase(page).click()

    // The collapsed section opens by itself on mobile.
    await expect(field(page, 'Código de indicação')).toBeFocused()
    await expect(
      page.getByRole('main').getByText('Use de 4 a 16 letras maiúsculas, números ou hífen.'),
    ).toBeVisible()
    await expect(reviewDialog(page)).toHaveCount(0)
    expect(await mock(page).requests({ op: 'orders.create' })).toEqual([])
  })

  test('the draft survives a reload (CHK-09)', async ({ page, isMobile }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await openDetails(page, isMobile)
    await note(page).fill('Presente para Bruno')
    await field(page, 'Código de indicação').fill('PRESENTE-1')
    // The draft is written after a short pause.
    await expect
      .poll(() =>
        page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('draft'))),
      )
      .toHaveLength(1)

    await page.reload()
    await expectFormReady(page)
    await openDetails(page, isMobile)
    await expect(note(page)).toHaveValue('Presente para Bruno')
    await expect(field(page, 'Código de indicação')).toHaveValue('PRESENTE-1')
  })
})

test.describe('session expiry (CHK-28)', () => {
  test('keeps the draft and the attempt through login, then pays', async ({ page, isMobile }) => {
    await openCheckout(page, { scenario: 'payment-manual' })
    await settle(page)
    await openDetails(page, isMobile)
    await note(page).fill('Voltei do login')
    await expect
      .poll(() =>
        page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('draft'))),
      )
      .toHaveLength(1)
    await openReview(page)
    await connectWallet(page)

    await mock(page).expireSessions()
    await pay(page).click()

    await expect(page).toHaveURL(/\/login\?/)
    const login = new URL(page.url())
    expect(login.searchParams.get('redirect')).toBe('/checkout')
    expect(login.searchParams.get('reason')).toBe('expired')
    expect(await ordersOf(page)).toEqual(['ord_000001'])

    await page.getByRole('main').getByLabel('E-mail', { exact: true }).fill('ana@kurio.example')
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill('Kurio#Ana2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL(/\/checkout$/)
    await expectFormReady(page)
    await openDetails(page, isMobile)
    await expect(note(page)).toHaveValue('Voltei do login')

    await openReview(page)
    await ensureConnected(page)
    await pay(page).click()
    await expect(pending(page)).toBeVisible()
    expect(await ordersOf(page)).toEqual(['ord_000001', 'ord_000002'])
    expect(await mock(page).requests({ op: 'orders.create' })).toHaveLength(2)
  })

  test('signing out clears the draft (CHK-09)', async ({ page, isMobile }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await openDetails(page, isMobile)
    await note(page).fill('Privado')
    await expect
      .poll(() =>
        page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('draft'))),
      )
      .toHaveLength(1)

    await page.evaluate(() => {
      localStorage.removeItem('kurio.session')
    })
    // The same effect as signing out in another tab: the storage event reaches this one.
    await page.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'kurio.session', newValue: null }))
    })
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    expect(
      await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.includes('draft'))),
    ).toEqual([])
    await forgetSession(page)
  })
})

test.describe('another user after an expiry (R8)', () => {
  const DRAFT = 'kurio.checkout.draft.usr_ana'

  async function expiredWithAnaData(page: Page) {
    await page.goto('/login?redirect=%2Fcheckout&reason=expired')
    await page.evaluate(
      ([attemptKey, draftKey]) => {
        localStorage.setItem(attemptKey, '{}')
        sessionStorage.setItem(draftKey, '{}')
      },
      ['kurio.checkout.attempt.usr_ana', DRAFT] as const,
    )
  }

  async function signIn(page: Page, who: { email: string; password: string }) {
    await page.getByRole('main').getByLabel('E-mail', { exact: true }).fill(who.email)
    await page.getByRole('main').getByLabel('Senha', { exact: true }).fill(who.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout/)
  }

  test("somebody else signing in removes the first user's draft and attempt", async ({ page }) => {
    await expiredWithAnaData(page)
    await signIn(page, { email: 'bruno@kurio.example', password: 'Kurio#Bruno2026' })
    expect(await readAttempt(page)).toBeNull()
    expect(await page.evaluate((key) => sessionStorage.getItem(key), DRAFT)).toBeNull()
  })
})

test.describe('keyboard and assistive technology (CHK-36)', () => {
  test('the whole path from "Confirmar compra" to processing works from the keyboard', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'The keyboard path is a desktop concern; touch has its own flow.')
    await openCheckout(page, { scenario: 'payment-manual' })
    await expectFormReady(page)

    await confirmPurchase(page).focus()
    await page.keyboard.press('Enter')
    await expect(reviewDialog(page)).toBeVisible()
    await expect(reviewDialog(page).getByTestId('quote-total')).toBeVisible()
    await expect(reviewDialog(page).locator(':focus')).toHaveCount(1)
    await expectNoAxeViolations(page)

    const connect = reviewDialog(page).getByRole('button', { name: /^Conectar / })
    for (
      let step = 0;
      step < 8 && !(await connect.evaluate((el) => el === document.activeElement));
      step += 1
    ) {
      await page.keyboard.press('Tab')
    }
    await expect(connect).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(connection(page)).toContainText('Conectada')

    const confirm = pay(page)
    for (
      let step = 0;
      step < 8 && !(await confirm.evaluate((el) => el === document.activeElement));
      step += 1
    ) {
      await page.keyboard.press('Tab')
    }
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(pending(page)).toBeVisible()
    await expect(
      pending(page).getByRole('heading', { name: 'Processando pagamento' }),
    ).toBeFocused()
  })

  test('Esc closes the review and focus returns to its trigger', async ({ page }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await openReview(page)
    await page.keyboard.press('Escape')
    await expect(reviewDialog(page)).toHaveCount(0)
    await expect(confirmPurchase(page)).toBeFocused()
  })
})

// A session that is gone before the page opens is the guard's job (spec 04), shown here once so the
// "private screen" case is on record next to the others.
test('a collector whose session ended before opening checkout lands on login', async ({ page }) => {
  await page.goto('/')
  await loginAs(page, 'ana')
  await mock(page).expireSessions()
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  await forgetSession(page)
})
