import type { Page } from '@playwright/test'

import { expectNoAxeViolations } from './support/a11y'
import { expectNoHorizontalOverflow } from './support/layout'
import { apiFetch, bearer, type ApiResponse, forgetSession, loginAs, mock } from './support/mock'
import { waitForConnection } from './support/realtime'
import { expect, test } from './support/test'

// Spec 07 design §10 (brief §9 scenario 5): the cart screen in both projects. Ana's seeded cart is
// Emerald Ape #042 (open, 1 × 1.19) and Golden Beat #207 (1/50, 2 × 0.99): subtotal 3.17, fee
// 0.016, total 3.186 ETH. Amounts are asserted as text because the screen shows what the quote
// says and computes nothing.

// Refused coupons and quantities are the point of several tests; the browser logs each 4xx.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const EMERALD = 'Emerald Ape #042'
const GOLDEN = 'Golden Beat #207'

const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Carrinho de NFTs' })
const lines = (page: Page) => page.getByTestId('cart-line')
const line = (page: Page, name: string) => lines(page).filter({ hasText: name })
const amount = (page: Page, row: 'subtotal' | 'discount' | 'fee' | 'total') =>
  page.getByTestId(`summary-${row}`)
// On desktop the notice is a row of its own under the line; its sr-only prefix names the NFT.
const notice = (page: Page, name: string) =>
  page.getByTestId('line-notice').filter({ hasText: name })
const summary = (page: Page) => page.getByTestId('cart-summary')
const checkout = (page: Page) => summary(page).getByRole('button', { name: 'Conectar e finalizar' })
const checkoutLink = (page: Page) =>
  summary(page).getByRole('link', { name: 'Conectar e finalizar' })
const plus = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^Aumentar quantidade de ${name}`) })
const minus = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^Diminuir quantidade de ${name}`) })
const stepperValue = (page: Page, name: string) =>
  line(page, name).locator('output[aria-label=Quantidade]')
const trash = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^Remover ${name}`) })
const codeField = (page: Page) => summary(page).getByLabel('Código promocional')
const polite = (page: Page) => page.getByTestId('announcer-polite')

/** ETH amounts are joined with a non-breaking space, which `\s` matches. */
const eth = (value: string) => new RegExp(`${value.replace('.', '\\.')}\\sETH`)

async function openCart(page: Page, as?: 'ana' | 'bruno') {
  if (as) await loginAs(page, as)
  await page.goto('/cart')
  await expect(heading(page)).toBeAttached()
}

async function expectAnaSummary(page: Page) {
  await expect(amount(page, 'subtotal')).toContainText(eth('3.17'))
  await expect(amount(page, 'discount')).toContainText(eth('0.00'))
  await expect(amount(page, 'fee')).toContainText(eth('0.016'))
  await expect(amount(page, 'total')).toContainText(eth('3.186'))
}

/** A guest cart through the API, kept where the app keeps it (as the details page would). */
async function guestAdds(
  page: Page,
  items: { nftId: string; editionId: string; quantity: number }[],
) {
  await page.goto('/')
  await page.waitForFunction(() => '__mock' in window)
  let id = ''
  for (const item of items) {
    const response: ApiResponse<{ id: string }> = await apiFetch<{ id: string }>(
      page,
      '/cart/items',
      { method: 'POST', body: item, headers: id ? { 'X-Guest-Cart-Id': id } : {} },
    )
    expect(response.status).toBe(200)
    id = response.body.id
  }
  await page.evaluate((value) => {
    localStorage.setItem('kurio.guestCartId', value)
  }, id)
}

async function updateRequests(page: Page) {
  return mock(page).requests({ op: 'cart.updateItem' })
}

test.describe('lines and summary (CART-03, CART-06, CART-15, CART-17, CART-25)', () => {
  test('Ana sees both lines in API order and the summary the quote computed, and keeps them after a reload', async ({
    page,
    isMobile,
  }) => {
    await openCart(page, 'ana')
    await expect(lines(page)).toHaveCount(2)
    await expect(lines(page).nth(0)).toContainText(EMERALD)
    await expect(lines(page).nth(1)).toContainText(GOLDEN)
    await expect(line(page, GOLDEN)).toContainText(eth('1.98'))
    await expect(line(page, GOLDEN)).toContainText('1/50')
    await expect(stepperValue(page, GOLDEN)).toHaveText('2')
    await expectAnaSummary(page)
    await expect(page).toHaveTitle('Carrinho · KURIO')
    if (!isMobile) {
      await expect(page.getByRole('link', { name: 'Carrinho, 3 itens' })).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: 'Trilha de navegação' })
          .locator('[aria-current=page]'),
      ).toHaveText('Carrinho')
    }
    // Every control says which line it acts on.
    await expect(trash(page, GOLDEN)).toHaveAccessibleName('Remover Golden Beat #207, edição 1/50')
    await expect(plus(page, GOLDEN)).toHaveAccessibleName(
      'Aumentar quantidade de Golden Beat #207, edição 1/50',
    )

    await page.reload()
    await expect(lines(page)).toHaveCount(2)
    await expectAnaSummary(page)
  })

  test('a guest cart survives a reload and shows its coupon', async ({ page }) => {
    await page.goto('/nfts/penny-pixel-001')
    await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(line(page, 'Penny Pixel #001')).toBeVisible()
    await expect(page.getByTestId('summary-subtotal')).toContainText(eth('0.02'))

    await page.reload()
    await expect(line(page, 'Penny Pixel #001')).toBeVisible()
    await expect(amount(page, 'subtotal')).toContainText(eth('0.02'))
    await expect(amount(page, 'total')).toContainText(eth('0.036'))
  })

  test('the layout composition follows the viewport: a table from lg, cards below', async ({
    page,
    isMobile,
  }) => {
    await openCart(page, 'ana')
    await expect(lines(page)).toHaveCount(2)
    if (isMobile) {
      await expect(page.getByRole('table')).toHaveCount(0)
      await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
    } else {
      await expect(page.getByRole('table', { name: 'Itens do carrinho' })).toBeVisible()
      await expect(
        page.getByRole('columnheader').filter({ hasText: /^(NFTs|Preço|Edições|Total)$/ }),
      ).toHaveCount(4)
      await expect(page.getByRole('heading', { name: 'Colecionadores também viram' })).toBeVisible()
    }
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('quantity (CART-07, CART-08, CART-09)', () => {
  test('changes the quantity within the limit and shows why it stops', async ({ page }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)

    await plus(page, GOLDEN).click()
    await expect(stepperValue(page, GOLDEN)).toHaveText('3')
    await expect(amount(page, 'total')).toContainText(eth('4.176'))
    await expect(line(page, GOLDEN)).toContainText(eth('2.97'))

    await plus(page, GOLDEN).click()
    await plus(page, GOLDEN).click()
    await expect(stepperValue(page, GOLDEN)).toHaveText('5')
    await expect(plus(page, GOLDEN)).toBeDisabled()
    await expect(line(page, GOLDEN)).toContainText('Máximo por pedido: 5')
    await expect(amount(page, 'total')).toContainText(eth('6.156'))

    await expect(minus(page, EMERALD)).toBeDisabled()
    await page.reload()
    await expect(stepperValue(page, GOLDEN)).toHaveText('5')
  })

  test('five fast clicks send at most two requests and settle on the last value', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await mock(page).clearRequests()
    const before = await updateRequests(page)
    expect(before).toHaveLength(0)

    // 2 → 3 → 4 → 5, then back to 4 and 3: the last click wins.
    for (let i = 0; i < 3; i += 1) await plus(page, GOLDEN).click()
    await minus(page, GOLDEN).click()
    await minus(page, GOLDEN).click()
    await expect(stepperValue(page, GOLDEN)).toHaveText('3')
    await expect(amount(page, 'total')).toContainText(eth('4.176'))
    const requests = await updateRequests(page)
    expect(requests.length).toBeGreaterThanOrEqual(1)
    expect(requests.length).toBeLessThanOrEqual(2)
    const { cart } = await mock(page)
      .snapshot()
      .then((state) => ({ cart: state.carts['user:usr_ana'] }))
    expect(cart?.items.find((item) => item.nftId === 'golden-beat-207')?.quantity).toBe(3)
  })

  test('a failed update restores the server quantity, keeps the line and offers a retry', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await mock(page).addRule({
      op: 'cart.updateItem',
      effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
      times: 1,
    })
    await plus(page, GOLDEN).click()
    const toast = page.getByRole('region', { name: 'Notificações' })
    await expect(toast.getByRole('button', { name: 'Tentar novamente' })).toBeVisible()
    await expect(stepperValue(page, GOLDEN)).toHaveText('2')
    await expect(line(page, GOLDEN)).toBeVisible()
    await expectAnaSummary(page)

    await toast.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(stepperValue(page, GOLDEN)).toHaveText('3')
    await expect(amount(page, 'total')).toContainText(eth('4.176'))
  })
})

test.describe('removal (CART-10, CART-11)', () => {
  test('removes after the API confirms, announces it, moves focus, and ends in the empty state', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expect(lines(page)).toHaveCount(2)

    await trash(page, EMERALD).click()
    await expect(lines(page)).toHaveCount(1)
    await expect(polite(page)).toHaveText('Emerald Ape #042 removido do carrinho')
    await expect(trash(page, GOLDEN)).toBeFocused()
    await expect(amount(page, 'subtotal')).toContainText(eth('1.98'))

    await trash(page, GOLDEN).click()
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expect(heading(page)).toBeFocused()
    await expect(summary(page)).toHaveCount(0)
    await page.getByRole('link', { name: 'Explorar NFTs' }).click()
    await expect(page).toHaveURL(/\/#mercado$/)
  })

  test('a failed removal keeps the line', async ({ page }) => {
    await openCart(page, 'ana')
    await mock(page).addRule({
      op: 'cart.removeItem',
      effect: { kind: 'http', status: 503, code: 'SERVICE_UNAVAILABLE' },
      times: 1,
    })
    await trash(page, EMERALD).click()
    await expect(
      page.getByRole('region', { name: 'Notificações' }).getByRole('button', {
        name: 'Tentar novamente',
      }),
    ).toBeVisible()
    await expect(lines(page)).toHaveCount(2)
  })
})

test.describe('coupons (CART-12 – CART-14)', () => {
  test('refuses an empty, invalid and expired code on the field, then applies and removes a valid one', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await mock(page).clearRequests()

    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary(page)).toContainText('Informe um código.')
    expect(await mock(page).requests({ op: 'cart.applyCoupon' })).toHaveLength(0)

    await codeField(page).fill('xpto')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    await expect(codeField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(summary(page).getByRole('alert')).toContainText(/inválid/i)
    await expect(codeField(page)).toHaveValue('xpto')

    await codeField(page).fill('VERAO25')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary(page).getByRole('alert')).toContainText(/expirou/i)
    await expectAnaSummary(page)

    await codeField(page).fill('kurio10')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('applied-coupon')).toContainText('KURIO10')
    await expect(amount(page, 'discount')).toContainText(eth('0.317'))
    await expect(amount(page, 'total')).toContainText(eth('2.869'))
    await expect(polite(page)).toHaveText('Cupom KURIO10 aplicado')

    await page.reload()
    await expect(page.getByTestId('applied-coupon')).toContainText('KURIO10')
    await expect(amount(page, 'total')).toContainText(eth('2.869'))

    await summary(page).getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('applied-coupon')).toHaveCount(0)
    await expect(amount(page, 'total')).toContainText(eth('3.186'))
  })

  test('a guest gets "not applicable" for a coupon with a minimum subtotal', async ({ page }) => {
    await guestAdds(page, [{ nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 }])
    await page.goto('/cart')
    await expect(line(page, 'Penny Pixel #001')).toBeVisible()
    await codeField(page).fill('COLECAO05')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary(page).getByRole('alert')).toContainText(/aplic/i)
    await expect(page.getByTestId('applied-coupon')).toHaveCount(0)
  })
})

test.describe('guest cart and login (CART-01, CART-04, CART-18)', () => {
  const email = (page: Page) => page.getByRole('main').getByLabel('E-mail', { exact: true })
  const password = (page: Page) => page.getByRole('main').getByLabel('Senha', { exact: true })

  async function signInThroughForm(
    page: Page,
    who: { email: string; password: string },
    redirect = '/cart',
  ) {
    await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
    await email(page).fill(who.email)
    await password(page).fill(who.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  }

  test('guest items are merged into the account on login and the stored id is dropped', async ({
    page,
  }) => {
    await guestAdds(page, [{ nftId: 'violet-nomad-314', editionId: 'limited-50', quantity: 1 }])
    expect(await page.evaluate(() => localStorage.getItem('kurio.guestCartId'))).toMatch(/^g_/)
    await page.goto('/cart')
    await expect(line(page, 'Violet Nomad #314')).toBeVisible()

    await signInThroughForm(page, { email: 'bruno@kurio.example', password: 'Kurio#Bruno2026' })
    await expect(page).toHaveURL(/\/cart$/)
    await expect(line(page, 'Violet Nomad #314')).toBeVisible()
    await expect(amount(page, 'subtotal')).toContainText(eth('1.39'))
    expect(await page.evaluate(() => localStorage.getItem('kurio.guestCartId'))).toBeNull()
    expect(await mock(page).requests({ op: 'cart.merge' })).toHaveLength(1)

    await page.reload()
    await expect(line(page, 'Violet Nomad #314')).toBeVisible()
  })

  test('a line above the limit after the merge is capped and reported in one toast', async ({
    page,
  }) => {
    await guestAdds(page, [{ nftId: 'emerald-ape-042', editionId: 'open', quantity: 10 }])
    await signInThroughForm(page, { email: 'ana@kurio.example', password: 'Kurio#Ana2026' })
    await expect(page).toHaveURL(/\/cart$/)
    // The toast first: it is shown when the merge ends, which can be before the cart has painted,
    // and a toast does not wait for the page to catch up.
    const toasts = page.getByRole('region', { name: 'Notificações' })
    await expect(toasts.getByText('Carrinho ajustado ao entrar')).toBeVisible()
    await expect(toasts).toContainText('quantidade ajustada para 10')
    await expect(toasts.getByRole('listitem')).toHaveCount(1)
    await expect(stepperValue(page, EMERALD)).toHaveText('10')
  })

  test('"Conectar e finalizar" sends a guest to login and a signed-in user to checkout', async ({
    page,
  }) => {
    await guestAdds(page, [{ nftId: 'penny-pixel-001', editionId: 'open', quantity: 1 }])
    await page.goto('/cart')
    await expect(line(page, 'Penny Pixel #001')).toBeVisible()
    await expect(checkoutLink(page)).toBeVisible()
    await checkoutLink(page).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/)

    await forgetSession(page)
    await openCart(page, 'ana')
    await expect(checkoutLink(page)).toHaveAttribute('href', '/checkout')
  })
})

test.describe('owner isolation (CART-05)', () => {
  test('after signing out the cart is the guest one; another user never sees the first one', async ({
    page,
    isMobile,
  }) => {
    await openCart(page, 'ana')
    await expect(lines(page)).toHaveCount(2)

    if (isMobile) {
      // Mobile has no header menu yet (spec 08): the stored session is dropped instead.
      await forgetSession(page)
      await page.goto('/cart')
    } else {
      await page.getByRole('button', { name: 'Conta de Ana Souza' }).click()
      await page.getByRole('menuitem', { name: 'Sair' }).click()
    }
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expect(lines(page)).toHaveCount(0)

    await openCart(page, 'bruno')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expect(page.getByText(EMERALD)).toHaveCount(0)
  })
})

test.describe('live changes (CART-18 – CART-22)', () => {
  test('a new price shows the old and new price, updates the summary and is announced once', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await waitForConnection(page, { userId: 'usr_ana' })

    await mock(page).updateNft('golden-beat-207', { price: '1.09' })
    const note = notice(page, GOLDEN)
    await expect(note).toContainText(/de 0\.99\sETH para 1\.09\sETH/)
    await expect(amount(page, 'subtotal')).toContainText(eth('3.37'))
    await expect(amount(page, 'total')).toContainText(eth('3.386'))
    await expect(polite(page)).toContainText('Golden Beat #207: Preço atualizado')
    // A price change does not block the purchase.
    await expect(checkoutLink(page)).toBeVisible()

    await note.getByRole('button', { name: /^Entendi/ }).click()
    await expect(note).toHaveCount(0)
    await expect(amount(page, 'subtotal')).toContainText(eth('3.37'))
  })

  test('availability below the quantity limits the line and blocks checkout until it is adjusted', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await waitForConnection(page, { userId: 'usr_ana' })

    await mock(page).updateNft('golden-beat-207', {
      available: { editionId: 'limited-50', value: 1 },
    })
    const note = notice(page, GOLDEN)
    await expect(note).toContainText('Resta apenas 1 disponível.')
    await expect(polite(page)).toContainText('Resta apenas 1 disponível.')
    await expect(checkout(page)).toBeDisabled()
    await expect(summary(page)).toContainText('Ajuste as quantidades indisponíveis para continuar.')

    await note.getByRole('button', { name: /^Ajustar quantidade/ }).click()
    await expect(stepperValue(page, GOLDEN)).toHaveText('1')
    await expect(note).toHaveCount(0)
    await expect(checkoutLink(page)).toBeVisible()
    await expect(amount(page, 'subtotal')).toContainText(eth('2.18'))
  })

  test('a sold-out line says "Esgotado", leaves the totals and can be removed', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await waitForConnection(page, { userId: 'usr_ana' })

    await mock(page).updateNft('golden-beat-207', {
      available: { editionId: 'limited-50', value: 0 },
    })
    const note = notice(page, GOLDEN)
    await expect(note).toContainText('Esgotado.')
    await expect(amount(page, 'subtotal')).toContainText(eth('1.19'))
    await expect(summary(page)).toContainText('Remova os itens esgotados para continuar.')
    await expect(checkout(page)).toBeDisabled()

    await note.getByRole('button', { name: /^Remover item esgotado/ }).click()
    await expect(line(page, GOLDEN)).toHaveCount(0)
    await expect(checkoutLink(page)).toBeVisible()
  })

  test('an applied coupon that stops applying says so and gives no discount (CART-14)', async ({
    page,
  }) => {
    await openCart(page, 'ana')
    await codeField(page).fill('COLECAO05')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    await expect(amount(page, 'discount')).toContainText(eth('0.05'))
    await waitForConnection(page, { userId: 'usr_ana' })

    // Both prices fall, so the subtotal (0.30) is below the coupon's 0.50 minimum.
    await mock(page).updateNft('emerald-ape-042', { price: '0.10' })
    await mock(page).updateNft('golden-beat-207', { price: '0.10' })
    await expect(page.getByTestId('applied-coupon')).toContainText(
      'Cupom não aplicável ao subtotal atual.',
    )
    await expect(amount(page, 'subtotal')).toContainText(eth('0.30'))
    await expect(amount(page, 'discount')).toContainText(eth('0.00'))
  })
})

test.describe('mobile frame (CART-24)', () => {
  test('inner top bar, no tab bar, and the bottom summary never covers the last line', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'The mobile composition')
    const token = await loginAs(page, 'ana')
    for (const nftId of ['ivory-baron-088', 'cosmic-bloom-118', 'golden-signal-160']) {
      const { status } = await apiFetch(page, '/cart/items', {
        method: 'POST',
        headers: bearer(token),
        body: { nftId, editionId: 'open', quantity: 1 },
      })
      expect(status).toBe(200)
    }
    await page.goto('/cart')
    await expect(lines(page)).toHaveCount(5)
    await expect(page.getByText('Carrinho de NFTs', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden()
    await expect(summary(page)).toBeInViewport()

    // More lines than the viewport holds: the last one scrolls clear of the fixed sheet.
    const last = lines(page).last()
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    await expect(last).toBeInViewport()
    const lastBox = await last.boundingBox()
    const sheetBox = await summary(page).boundingBox()
    expect(lastBox).not.toBeNull()
    expect(sheetBox).not.toBeNull()
    if (lastBox && sheetBox) expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(sheetBox.y + 1)
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('accessibility (CART-25)', () => {
  test('no serious violations loaded, with a notice, and empty', async ({ page }) => {
    await openCart(page, 'ana')
    await expectAnaSummary(page)
    await expectNoAxeViolations(page)

    await waitForConnection(page, { userId: 'usr_ana' })
    await mock(page).updateNft('golden-beat-207', { price: '1.09' })
    await expect(notice(page, GOLDEN)).toBeVisible()
    await expectNoAxeViolations(page)

    await mock(page).useScenario('empty')
    await forgetSession(page)
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await expectNoAxeViolations(page)
  })
})
