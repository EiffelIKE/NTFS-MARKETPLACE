import type { Locator, Page } from '@playwright/test'

import type { ScenarioId } from '../src/mocks/scenarios'
import {
  expectFocusTrapped,
  expectNoClippedText,
  expectReadableOverArtwork,
  expectInvalidFieldsDescribed,
  expectNoAxeViolations,
  liveMessages,
  recordLiveMessages,
  tabThrough,
  tabTo,
  withTextSpacing,
  zoomTo,
} from './support/a11y'
import {
  confirmPurchase,
  connectWallet,
  expectFormReady,
  field,
  openCheckout,
  openReview,
  pay,
  reviewDialog,
} from './support/checkout'
import { expectNoHorizontalOverflow } from './support/layout'
import { loginAs, mock } from './support/mock'
import { realtime, waitForConnection } from './support/realtime'
import { expect, test } from './support/test'

// Spec 11 (brief §9 scenario 11): one consistent matrix over every route, state and overlay, in
// both projects. The per-screen suites prove each screen's own behavior; this file proves the
// properties that must hold everywhere (design §2 – §8).

// Failure states are part of the matrix, and the browser logs each failed request and the router
// logs a loader error (one combined pattern: `allowedConsoleErrors` takes a single regex).
test.use({ allowedConsoleErrors: [/Failed to load resource|ApiError/] })

type Who = 'ana' | 'bruno' | 'carla'

interface Screen {
  name: string
  url: string
  as?: Who | undefined
  scenario?: ScenarioId
}

/**
 * Opens a screen the way a user gets there. A scenario switch reseeds the mock and drops its
 * sessions, so the scenario is applied first on a bare page and the sign-in comes after it.
 */
async function openScreen(page: Page, { url, as, scenario }: Omit<Screen, 'name'>) {
  await page.goto(scenario ? `/?scenario=${scenario}` : '/')
  if (as) await loginAs(page, as)
  await page.goto(url)
  await settled(page)
}

/** The page has rendered its heading and nothing is loading or refetching. */
async function settled(page: Page) {
  await expect(page.locator('h1').first()).toBeAttached()
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
}

// Design §2. Every route in `src/routes/`, in the states it has.
const SCREENS: Screen[] = [
  { name: 'home', url: '/' },
  { name: 'home, empty catalog', url: '/', scenario: 'empty' },
  { name: 'home, server down', url: '/', scenario: 'server-down' },
  { name: 'favorites of Ana', url: '/?favorites=1', as: 'ana' },
  { name: 'favorites of Bruno (none)', url: '/?favorites=1', as: 'bruno' },
  { name: 'details', url: '/nfts/emerald-ape-042' },
  { name: 'details, sold out', url: '/nfts/obsidian-mask-007' },
  { name: 'details, server down', url: '/nfts/emerald-ape-042', scenario: 'server-down' },
  { name: 'details, unknown NFT (404)', url: '/nfts/nao-existe' },
  { name: 'cart of Ana', url: '/cart', as: 'ana' },
  { name: 'cart, empty', url: '/cart', scenario: 'empty' },
  { name: 'cart, server down', url: '/cart', scenario: 'server-down' },
  { name: 'checkout', url: '/checkout', as: 'ana' },
  { name: 'receipt', url: '/orders/ord_000001', as: 'ana' },
  { name: 'receipt of another user', url: '/orders/ord_000001', as: 'bruno' },
  { name: 'login', url: '/login' },
  { name: 'sign-up', url: '/signup' },
  { name: 'profile', url: '/profile', as: 'ana' },
  { name: 'profile, sparse', url: '/profile', as: 'carla' },
  { name: 'wallets', url: '/wallets', as: 'ana' },
  { name: 'wallets, none', url: '/wallets', as: 'carla' },
  { name: 'not found', url: '/nao-existe' },
]

test.describe('axe on every route and state (A11Y-01)', () => {
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await openScreen(page, screen)
      await expectNoAxeViolations(page)
    })
  }
})

test.describe('no overflow on every route and state (A11Y-15)', () => {
  const WIDTHS = [320, 390, 768, 1024, 1180, 1440]
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await openScreen(page, screen)
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await expectNoHorizontalOverflow(page)
      }
    })
  }
})

// Design §4. Each overlay: focus moves in, Tab cycles inside, Esc closes and focus returns to the
// trigger (or to the documented fallback), and the open state has no serious axe violation.
test.describe('overlays (A11Y-02, A11Y-06)', () => {
  async function expectOverlay(
    page: Page,
    { open, dialog, trigger }: { open: () => Promise<void>; dialog: Locator; trigger: Locator },
  ) {
    await open()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator(':focus')).toHaveCount(1)
    await expectNoAxeViolations(page)
    await expectFocusTrapped(page, dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  }

  test('the header account menu', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the account menu is the desktop header; mobile has the profile screen')
    await openScreen(page, { url: '/', as: 'ana' })
    const trigger = page.getByRole('button', { name: 'Conta de Ana Souza' })
    const menu = page.getByRole('menu')
    await trigger.focus()
    await expectOverlay(page, {
      open: () => page.keyboard.press('Enter'),
      dialog: menu,
      trigger,
    })
  })

  test('search', async ({ page, isMobile }) => {
    // Desktop: the header icon. Mobile: the tab bar button, on a screen without the catalog.
    await openScreen(page, isMobile ? { url: '/profile', as: 'ana' } : { url: '/' })
    const trigger = isMobile
      ? page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Buscar' })
      : page.getByRole('banner').getByRole('button', { name: 'Buscar' })
    await trigger.focus()
    await expectOverlay(page, {
      open: () => page.keyboard.press('Enter'),
      dialog: page.getByRole('dialog', { name: 'Buscar NFTs' }),
      trigger,
    })
  })

  test('the mobile filter sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the sheet is the mobile composition of the filters')
    await openScreen(page, { url: '/' })
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.focus()
    await expectOverlay(page, {
      open: () => page.keyboard.press('Enter'),
      dialog: page.getByRole('dialog', { name: 'Filtros' }),
      trigger,
    })
  })

  test('the image zoom', async ({ page }) => {
    await openScreen(page, { url: '/nfts/emerald-ape-042' })
    const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
    await trigger.focus()
    await expectOverlay(page, {
      open: () => page.keyboard.press('Enter'),
      dialog: page.getByRole('dialog'),
      trigger,
    })
  })

  test('the checkout review', async ({ page }) => {
    await openCheckout(page)
    await expectFormReady(page)
    await confirmPurchase(page).focus()
    await expectOverlay(page, {
      open: () => page.keyboard.press('Enter'),
      dialog: reviewDialog(page),
      trigger: confirmPurchase(page),
    })
  })

  test('the mock panel', async ({ page }) => {
    await openScreen(page, { url: '/' })
    const panel = page.getByRole('dialog', { name: 'Simulação da API' })
    await page.keyboard.press('Alt+Shift+M')
    await expect(panel).toBeVisible()
    await expect(panel.locator(':focus')).toHaveCount(1)
    await expectNoAxeViolations(page)
    await expectFocusTrapped(page, panel)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Simulação/ })).toBeFocused()
  })
})

test.describe('keyboard paths and route focus (A11Y-04, A11Y-05, A11Y-07)', () => {
  test('in-app navigation moves focus to the new h1; search params on the same page do not', async ({
    page,
    isMobile,
  }) => {
    await openScreen(page, { url: '/' })
    await expect(page).toHaveTitle('Início · KURIO')

    // Filters, search and sort rewrite the URL of the same page: focus stays where the user is.
    const control = isMobile
      ? page.getByRole('searchbox', { name: 'Buscar NFTs' })
      : page.getByRole('checkbox', { name: /^Música/ })
    if (isMobile) await control.fill('ape')
    else await control.check({ force: true })
    await expect(page).toHaveURL(/q=ape|categories=musica/)
    await expect(control).toBeFocused()

    // A link to another page: the new page's heading takes focus and the title follows.
    await page.getByTestId('product-card').first().getByRole('link').first().click()
    await expect(page).toHaveURL(/\/nfts\//)
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeFocused()
    await expect(page).toHaveTitle(`${(await heading.textContent()) ?? ''} · KURIO`)

    // Back: the list page again, and its heading, not a stale element, has focus.
    await page.goBack()
    await expect(page).toHaveTitle('Início · KURIO')
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  })

  test('the keyboard alone buys an NFT, from the catalog to the receipt', async ({ page }) => {
    await openScreen(page, { url: '/', as: 'ana' })

    // Catalog -> details.
    await tabTo(page, /link "Emerald Ape #042"/, { max: 80, visible: true })
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nfts\/emerald-ape-042/)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()

    // Details -> cart. Desktop "COMPRAR" and mobile "Comprar NFT" both add and open the cart.
    await tabTo(page, /button "(COMPRAR|Comprar NFT)"/, { max: 60, visible: true })
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Carrinho de NFTs' })).toBeFocused()

    // Cart -> checkout.
    await tabTo(page, /link "Conectar e finalizar"/, { max: 60, visible: true })
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/checkout$/)
    await expectFormReady(page)

    // Checkout -> review -> connect -> pay.
    await tabTo(page, /button "Confirmar compra"/, { max: 80, visible: true })
    await page.keyboard.press('Enter')
    await expect(reviewDialog(page)).toBeVisible()
    await expect(reviewDialog(page).getByTestId('quote-total')).toBeVisible()
    await tabTo(page, /button "Conectar /, { max: 12, visible: true })
    await page.keyboard.press('Enter')
    await expect(reviewDialog(page).getByTestId('wallet-connection')).toContainText('Conectada')
    await tabTo(page, /button "Confirmar pagamento"/, { max: 12, visible: true })
    await page.keyboard.press('Enter')

    // Receipt: confirmed, with focus on its heading.
    await expect(page).toHaveURL(/\/orders\/ord_\d+$/, { timeout: 20_000 })
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seus NFTs agora estão na sua carteira' }),
    ).toBeFocused()
  })

  test('sign in with the keyboard, then land on the page that asked for it', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)

    await tabTo(page, /textbox "E-mail/, { max: 30, visible: true })
    await page.keyboard.type('ana@kurio.example')
    await tabTo(page, /textbox "Senha/, { max: 4, visible: true })
    await page.keyboard.type('Kurio#Ana2026')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/profile$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' }),
    ).toBeFocused()
  })

  test('the filters work with the keyboard (desktop sidebar, mobile sheet)', async ({
    page,
    isMobile,
  }) => {
    await openScreen(page, { url: '/' })
    if (isMobile) {
      await tabTo(page, /button "Filtros/, { max: 40, visible: true })
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible()
    }
    await tabTo(page, /checkbox "Música/, { max: 40, visible: true })
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/categories=musica/)
    // The result list updates around the user: focus stays on the checkbox they just used.
    await expect(page.getByRole('checkbox', { name: /^Música/ })).toBeFocused()
  })

  test('focus stays visible and uncovered through the pages with fixed bars', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the fixed bars are the mobile compositions')
    const walk = async (url: string, as?: Who) => {
      await openScreen(page, { url, as })
      await tabThrough(page, 45)
    }
    await walk('/nfts/emerald-ape-042')
    await walk('/cart', 'ana')
    await page.goto('/checkout')
    await expectFormReady(page)
    await tabThrough(page, 45)
    await walk('/orders/ord_000001', 'ana')
    await walk('/profile', 'ana')
  })
})

test.describe('forms (A11Y-08)', () => {
  const main = (page: Page) => page.getByRole('main')

  test('sign-up: an empty submit focuses the first invalid field and ties each message to its field', async ({
    page,
  }) => {
    await openScreen(page, { url: '/signup' })
    await main(page)
      .getByRole('button', { name: /^Criar (conta|perfil)$/ })
      .click()
    await expect(main(page).getByLabel('Nome de usuário', { exact: true })).toBeFocused()
    const count = await expectInvalidFieldsDescribed(main(page))
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('sign-up: an API conflict lands on its field, which takes focus', async ({ page }) => {
    await openScreen(page, { url: '/signup' })
    await main(page).getByLabel('Nome de usuário', { exact: true }).fill('novousuario')
    await main(page).getByLabel('E-mail', { exact: true }).fill('ana@kurio.example')
    await main(page).getByLabel('Senha', { exact: true }).fill('Kurio#Nova2026')
    await main(page).getByLabel('Confirmar senha', { exact: true }).fill('Kurio#Nova2026')
    await main(page)
      .getByRole('button', { name: /^Criar (conta|perfil)$/ })
      .click()
    const email = main(page).getByLabel('E-mail', { exact: true })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Este e-mail já está cadastrado.')
  })

  test('login: a refused sign-in is a form-level alert, announced assertively', async ({
    page,
  }) => {
    await openScreen(page, { url: '/login' })
    await main(page).getByLabel('E-mail', { exact: true }).fill('ana@kurio.example')
    await main(page).getByLabel('Senha', { exact: true }).fill('errada-123')
    await main(page).getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(main(page).getByRole('alert')).toContainText('E-mail ou senha incorretos.')
  })

  test('profile: a cleared required field is described and focused', async ({ page }) => {
    await openScreen(page, { url: '/profile', as: 'ana' })
    await expect(main(page).getByLabel(/^Nome de exibição/)).toHaveValue('Ana Souza')
    await main(page)
      .getByLabel(/^Nome de exibição/)
      .fill('')
    await main(page).getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(main(page).getByLabel(/^Nome de exibição/)).toBeFocused()
    expect(await expectInvalidFieldsDescribed(main(page))).toBeGreaterThanOrEqual(1)
  })

  test('wallets: every empty required field is described, and the first one has focus', async ({
    page,
  }) => {
    await openScreen(page, { url: '/wallets', as: 'carla' })
    await main(page)
      .getByRole('button', { name: /^Salvar carteira/ })
      .first()
      .click()
    await expect(main(page).locator('[aria-invalid=true]').first()).toBeFocused()
    expect(await expectInvalidFieldsDescribed(main(page))).toBeGreaterThanOrEqual(5)
  })

  test('checkout: an invalid field is described and focused', async ({ page, isMobile }) => {
    await openCheckout(page)
    await expectFormReady(page)
    if (isMobile) await page.getByRole('button', { name: 'Dados do colecionador' }).click()
    await field(page, 'Código de indicação').fill('abc')
    await confirmPurchase(page).click()
    await expect(field(page, 'Código de indicação')).toBeFocused()
    expect(await expectInvalidFieldsDescribed(main(page))).toBe(1)
  })
})

// Design §5. `recordLiveMessages` captures every text that reaches a live region or a toast, so
// "once" is asserted on what a screen reader would be handed, not on what is on screen.
test.describe('live feedback (A11Y-09, A11Y-10)', () => {
  const only = (messages: string[], pattern: RegExp) => messages.filter((m) => pattern.test(m))

  test('adding to the cart: one toast, with a way to the cart', async ({ page, isMobile }) => {
    await recordLiveMessages(page)
    // Desktop adds from the catalog card; mobile has the cart button of the buy bar.
    await openScreen(
      page,
      isMobile ? { url: '/nfts/cosmic-bloom-118', as: 'ana' } : { url: '/?q=cosmic', as: 'ana' },
    )
    const add = isMobile
      ? page.getByRole('button', { name: 'Adicionar ao carrinho' })
      : page.getByRole('button', { name: 'Adicionar Cosmic Bloom #118 ao carrinho' })
    await add.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('region', { name: /Notificações/ }).getByText('Adicionado ao carrinho'),
    ).toBeVisible()
    expect(only(await liveMessages(page), /Adicionado ao carrinho/)).toHaveLength(1)
  })

  test('a failed favorite: one toast, and the heart goes back', async ({ page, isMobile }) => {
    await recordLiveMessages(page)
    await openScreen(page, { url: '/nfts/cosmic-bloom-118', as: 'ana' })
    const heart = isMobile
      ? page.getByRole('button', { name: 'Favoritar Cosmic Bloom #118' })
      : page.getByRole('button', { name: 'Favoritar', exact: true })
    await expect(heart).not.toHaveAttribute('aria-disabled', 'true')
    await mock(page).addRule({
      op: 'favorites.add',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })
    await heart.click()
    await expect(page.getByText('Não foi possível atualizar seus favoritos.')).toBeVisible()
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    expect(
      only(await liveMessages(page), /Não foi possível atualizar seus favoritos/),
    ).toHaveLength(1)
  })

  test('removing a cart line is announced once, by name', async ({ page }) => {
    await recordLiveMessages(page)
    await openScreen(page, { url: '/cart', as: 'ana' })
    await page.getByRole('button', { name: /^Remover Golden Beat #207/ }).click()
    await expect(page.getByTestId('cart-line').filter({ hasText: 'Golden Beat #207' })).toHaveCount(
      0,
    )
    await expect
      .poll(async () => only(await liveMessages(page), /Golden Beat #207 removido do carrinho/))
      .toHaveLength(1)
  })

  test('a price change in the cart is announced once, even when the event is delivered twice', async ({
    page,
  }) => {
    await recordLiveMessages(page)
    await openScreen(page, { url: '/cart', as: 'ana' })
    await waitForConnection(page, { userId: 'usr_ana' })
    await mock(page).updateNft('golden-beat-207', { price: '1.09' })
    await expect.poll(async () => only(await liveMessages(page), /Golden Beat #207/).length).toBe(1)
    await realtime(page).redeliver(1)
    // Give a (wrong) second announcement the time a real one would take.
    await page.waitForTimeout(500)
    expect(only(await liveMessages(page), /Golden Beat #207/)).toHaveLength(1)
  })

  test('the result count is announced when it changes, not on the first load', async ({
    page,
    isMobile,
  }) => {
    await recordLiveMessages(page)
    await openScreen(page, { url: '/' })
    await page.waitForTimeout(300)
    expect(only(await liveMessages(page), /encontrad/)).toHaveLength(0)

    if (isMobile) await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('ape')
    else await page.getByRole('checkbox', { name: /^Música/ }).check({ force: true })
    await expect.poll(async () => only(await liveMessages(page), /encontrad/).length).toBe(1)
  })

  test('a refetch that changes nothing announces nothing', async ({ page }) => {
    await recordLiveMessages(page)
    await openScreen(page, { url: '/cart', as: 'ana' })
    await waitForConnection(page, { userId: 'usr_ana' })
    await mock(page).clearRequests()
    const before = await liveMessages(page)

    // A reconnection reconciles over REST (spec 03): the cart is read again, and it is unchanged.
    await realtime(page).drop()
    await waitForConnection(page, { userId: 'usr_ana' })
    await expect
      .poll(async () => (await mock(page).requests({ op: 'cart.get' })).length)
      .toBeGreaterThan(0)
    await page.waitForTimeout(300)
    expect(await liveMessages(page)).toEqual(before)
  })

  test('a declined payment is announced once, assertively', async ({ page }) => {
    await recordLiveMessages(page)
    await openCheckout(page, { scenario: 'payment-declined' })
    await expectFormReady(page)
    await openReview(page)
    await connectWallet(page)
    await pay(page).click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    const declined = only(await liveMessages(page), /Pagamento recusado/)
    expect(declined).toHaveLength(1)
    expect(declined[0]).toMatch(/^alert:/)
  })
})

test.describe('semantics, titles and images (A11Y-11, A11Y-12)', () => {
  for (const screen of SCREENS) {
    test(`${screen.name}: one h1, no skipped heading level, a title in the KURIO pattern`, async ({
      page,
    }) => {
      await openScreen(page, screen)
      await expect(page).toHaveTitle(/ · KURIO$/)
      const levels = await page.evaluate(() =>
        [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
          .filter((heading) => heading.checkVisibility())
          .map((heading) => Number(heading.tagName.slice(1))),
      )
      expect(
        levels.filter((level) => level === 1),
        'h1 count',
      ).toHaveLength(1)
      const jumps = levels.flatMap((level, index) =>
        index > 0 && level > (levels[index - 1] ?? 0) + 1
          ? [`h${String(levels[index - 1])} to h${String(level)}`]
          : [],
      )
      expect(jumps, 'skipped heading levels').toEqual([])
    })
  }

  test('landmarks are unique and named where there is more than one', async ({ page }) => {
    await openScreen(page, { url: '/cart', as: 'ana' })
    const problems = await page.evaluate(() => {
      const found = new Map<string, string[]>()
      const selector =
        'header, footer, main, nav, aside, section[aria-label], section[aria-labelledby], form[aria-label], [role=region], [role=navigation], [role=search], [role=complementary]'
      for (const element of document.querySelectorAll(selector)) {
        if (!element.checkVisibility()) continue
        const role =
          element.getAttribute('role') ??
          {
            HEADER: 'banner',
            FOOTER: 'contentinfo',
            MAIN: 'main',
            NAV: 'navigation',
            ASIDE: 'complementary',
          }[element.tagName] ??
          'region'
        const labelledBy = element.getAttribute('aria-labelledby')
        const name = (
          element.getAttribute('aria-label') ??
          (labelledBy ? document.getElementById(labelledBy)?.textContent : '') ??
          ''
        ).trim()
        found.set(role, [...(found.get(role) ?? []), name])
      }
      return [...found].flatMap(([role, names]) => {
        const out: string[] = []
        if (role === 'main' && names.length !== 1)
          out.push(`${String(names.length)} main landmarks`)
        if (names.length > 1 && names.some((name) => name === ''))
          out.push(`${role}: an unnamed one among ${String(names.length)}`)
        if (new Set(names).size !== names.length)
          out.push(`${role}: repeated names ${names.join(', ')}`)
        return out
      })
    })
    expect(problems).toEqual([])
  })

  test('every image has an alt; a name that the link around it already gives is not read twice', async ({
    page,
  }) => {
    for (const url of ['/', '/nfts/emerald-ape-042', '/cart']) {
      await openScreen(page, { url, as: 'ana' })
      const problems = await page.evaluate(() => {
        const out: string[] = []
        for (const image of document.querySelectorAll('img')) {
          if (!image.checkVisibility()) continue
          const src = image.currentSrc.slice(-40)
          const alt = image.getAttribute('alt')
          if (alt === null) {
            out.push(`no alt attribute: ${src}`)
            continue
          }
          if (alt === '') continue
          // The accessible name of the control around the image, without the image itself.
          const host = image.closest('a, button')
          const own = host?.getAttribute('aria-label') ?? ''
          if (own.includes(alt)) out.push(`"${alt}" repeats the label "${own}"`)
        }
        return out
      })
      expect(problems, url).toEqual([])
    }
  })
})

// A11Y-13: each state is carried by text or shape as well as color.
test.describe('states without color alone (A11Y-13)', () => {
  test('current page, active segment, selected edition, previous price, sold-out edition', async ({
    page,
  }) => {
    await openScreen(page, { url: '/' })
    await expect(page.getByRole('tab', { selected: true })).toHaveCount(1)
    await expect(page.getByRole('link', { name: /^Página 1/ }).first()).toHaveAttribute(
      'aria-current',
      'page',
    )
    // A price with a discount shows the old value struck through, next to the new one.
    const struck = page.locator('s, del, [class*=line-through]').first()
    await expect(struck).toBeVisible()
    expect(
      await struck.evaluate((element) => getComputedStyle(element).textDecorationLine),
    ).toContain('line-through')

    // Sold-out and selected editions say so in words (the unavailable one is the unique edition).
    await openScreen(page, { url: '/nfts/cosmic-bloom-118' })
    const editions = page.getByRole('radiogroup', { name: 'Edição' })
    await expect(editions.getByRole('radio', { checked: true })).toHaveCount(1)
    await expect(editions.getByRole('radio', { name: /esgotada/ })).toBeDisabled()
  })
})

// A11Y-16: 200 % of a 1280 px window is a 640 px layout, 400 % is the 320 px reflow of WCAG 1.4.10
// (and a 200 px tall window, which flips every fixed bar to static). Text spacing is WCAG 1.4.12.
test.describe('zoom and text spacing on every route (A11Y-16)', () => {
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await openScreen(page, screen)
      for (const factor of [2, 4]) {
        await zoomTo(page, factor)
        await expectNoHorizontalOverflow(page)
      }
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await withTextSpacing(page)
        await expectNoHorizontalOverflow(page)
        await expectNoClippedText(page)
      }
    })
  }
})

// Design §7: there is no tablet frame, so 768 px gets the mobile composition (shell, filter sheet,
// single-column screens at 600 px) with the 3-column catalog grid.
test.describe('tablet at 768 px (A11Y-17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
  })

  test('home: tab bar, filter sheet button and three columns', async ({ page }) => {
    await openScreen(page, { url: '/' })
    await expect(
      page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Perfil' }),
    ).toBeVisible()
    await expect(page.getByRole('banner')).toBeHidden()
    await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible()
    await expect(page.getByTestId('product-card').first()).toBeVisible()
    const columns = await page
      .getByTestId('product-card')
      .evaluateAll(
        (cards) => new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
      )
    expect(columns).toBe(3)
  })

  test('details, cart and checkout keep their last content above the fixed bar', async ({
    page,
  }) => {
    for (const [url, as, bar] of [
      ['/nfts/emerald-ape-042', undefined, 'Compra'],
      ['/cart', 'ana', 'Resumo'],
      ['/checkout', 'ana', 'Confirmar compra'],
    ] as const) {
      await openScreen(page, { url, as })
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight)
      })
      const covered = await page.evaluate(() => {
        const inset = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--bottom-bar-inset'),
        )
        // The lowest piece of page content that is not the bar itself.
        let bottom = 0
        for (const element of document.querySelectorAll('main *')) {
          if (element.children.length > 0 || element.closest('.sr-only')) continue
          let inBar = false
          for (let up: Element | null = element; up; up = up.parentElement) {
            if (getComputedStyle(up).position === 'fixed') inBar = true
          }
          const box = element.getBoundingClientRect()
          if (!inBar && box.height > 0) bottom = Math.max(bottom, box.bottom)
        }
        return { inset, bottom, viewport: innerHeight }
      })
      expect(covered.inset, `${bar}: the bar publishes its height`).toBeGreaterThan(0)
      // The page ends where the bar begins, not under it.
      expect(covered.bottom, url).toBeLessThanOrEqual(covered.viewport - covered.inset + 1)
      await expectNoHorizontalOverflow(page)
    }
  })
})

test.describe('reduced motion (A11Y-18)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('skeletons, spinners, the carousel and overlays are static', async ({ page }) => {
    await page.goto('/?scenario=slow')
    await expect(page.locator('[data-slot=skeleton]').first()).toBeVisible()
    const motion = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const timing = animation.effect?.getTiming()
            // A transition or animation that lasts longer than a frame or two is motion.
            return (
              animation.playState === 'running' &&
              (timing?.iterations === Infinity || Number(timing?.duration ?? 0) > 50)
            )
          })
          .map((animation) => animation.id || animation.constructor.name),
      )
    expect(await motion(), 'skeleton shimmer').toEqual([])
    expect(
      await page
        .locator('[data-slot=skeleton]')
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe('none')

    // The hero never auto-advances (WCAG 2.2.2), whatever the preference.
    await page.clock.install()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Destaque 1 de 3' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await page.clock.runFor(15_000)
    await expect(page.getByRole('button', { name: 'Destaque 1 de 3' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    // An overlay opens without a lasting transition.
    await page.keyboard.press('Alt+Shift+M')
    await expect(page.getByRole('dialog', { name: 'Simulação da API' })).toBeVisible()
    await page.clock.runFor(100)
    expect(await motion(), 'overlay transition').toEqual([])
  })
})

// A11Y-14: axe cannot judge text over artwork, gradients or shapes, so those blocks are sampled.
test.describe('contrast over artwork (A11Y-14)', () => {
  test('the hero, the promos, the featured banner and the blog cards', async ({
    page,
    isMobile,
  }) => {
    await openScreen(page, { url: '/' })
    const hero = page.getByRole('region', { name: 'Destaques', exact: true })
    expect(await expectReadableOverArtwork(page, hero)).toBeGreaterThan(2)
    if (isMobile) return
    for (const section of [
      page.getByRole('region', { name: 'Promoções' }),
      page.getByRole('complementary', { name: 'Filtros' }).locator('> :last-child'),
      page.getByRole('region', { name: 'Diário da Cunhagem' }),
    ]) {
      expect(await expectReadableOverArtwork(page, section)).toBeGreaterThan(0)
    }
  })
})
