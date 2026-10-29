import type { Locator, Page } from '@playwright/test'

import { expectNoAxeViolations } from './support/a11y'
import { loginAs, mock } from './support/mock'
import { realtime, waitForConnection } from './support/realtime'
import { expect, test } from './support/test'

// Spec 06 design §11 (brief §9 scenario 2): the details screen on `/nfts/$nftId`, in both
// projects. Data are the default scenario's anchor NFTs; the live rows go through the real
// Socket.IO client via `__mock.updateNft`.

// Rejections are the point of several tests, and the browser logs each 4xx and network failure.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const heading = (page: Page) => page.getByRole('heading', { level: 1 })
// Strings match exactly: "1/1" is a substring of "1/10".
const chip = (page: Page, name: string | RegExp) =>
  page.getByRole('radio', typeof name === 'string' ? { name, exact: true } : { name })
const plus = (page: Page) => page.getByRole('button', { name: 'Aumentar quantidade' })
const minus = (page: Page) => page.getByRole('button', { name: 'Diminuir quantidade' })
const quantity = (page: Page) => page.locator('output[aria-label=Quantidade]')
const buyButton = (page: Page, isMobile: boolean) =>
  page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true })
/** The one element of a duplicated desktop/mobile pair that the viewport shows. */
const shown = (locator: Locator) => locator.locator('visible=true').first()

async function openNft(page: Page, id: string, query = '') {
  await page.goto(`/nfts/${id}${query}`)
  await expect(heading(page)).toBeVisible()
}

/** Raises the `+` button to `target` clicks' worth of quantity. */
async function setQuantity(page: Page, target: number) {
  while (Number(await quantity(page).textContent()) < target) await plus(page).click()
}

test.describe('direct access (DET-01, DET-02)', () => {
  test('opens by URL and after a reload, with the NFT in the title and the breadcrumb', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042')
    await expect(heading(page)).toHaveText('Emerald Ape #042')
    await expect(shown(page.getByText(/1\.19\sETH/))).toBeVisible()
    await expect(chip(page, /./)).toHaveCount(4)
    await expect(page).toHaveTitle('Emerald Ape #042 · KURIO')
    if (!isMobile) {
      await expect(
        page
          .getByRole('navigation', { name: 'Trilha de navegação' })
          .locator('[aria-current=page]'),
      ).toHaveText('Emerald Ape #042')
    }

    await page.reload()
    await expect(heading(page)).toHaveText('Emerald Ape #042')
    await expect(page).toHaveTitle('Emerald Ape #042 · KURIO')
  })

  test('a nonexistent id shows "NFT não encontrado", keeps the URL and links back to the market', async ({
    page,
  }) => {
    await page.goto('/nfts/nao-existe')
    await expect(heading(page)).toHaveText('NFT não encontrado')
    await expect(page).toHaveURL(/\/nfts\/nao-existe$/)
    await expect(page).toHaveTitle('NFT não encontrado · KURIO')

    await page.getByRole('link', { name: 'Voltar ao mercado' }).click()
    await expect(page).toHaveURL(/\/#mercado$/)
  })

  test('an id that is not even shaped like one gets the same view without asking the API', async ({
    page,
  }) => {
    await page.goto('/nfts/BAD!!')
    await expect(heading(page)).toHaveText('NFT não encontrado')
    expect(await mock(page).requests({ op: 'nfts.get' })).toHaveLength(0)
  })
})

test.describe('editions and quantity (DET-10 – DET-14)', () => {
  test('a fully sold-out NFT disables every edition and buying, and says "Esgotado"', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'obsidian-mask-007')
    const sold = chip(page, /esgotada/)
    await expect(sold).toHaveCount(3)
    for (const radio of await sold.all()) await expect(radio).toBeDisabled()
    await expect(buyButton(page, isMobile)).toBeDisabled()
    await expect(page.getByText('Esgotado', { exact: true })).toBeVisible()
  })

  test('a sold-out edition is skipped: Cosmic Bloom starts on 1/10, with or without ?edition=', async ({
    page,
  }) => {
    await openNft(page, 'cosmic-bloom-118')
    await expect(chip(page, /^1\/1 — esgotada/)).toBeDisabled()
    await expect(chip(page, '1/10')).toBeChecked()

    await openNft(page, 'cosmic-bloom-118', '?edition=unique')
    await expect(chip(page, '1/10')).toBeChecked()

    await openNft(page, 'emerald-ape-042', '?edition=limited-50')
    await expect(chip(page, '1/50')).toBeChecked()
  })

  test('choosing an edition updates the URL without adding history', async ({ page }) => {
    await openNft(page, 'emerald-ape-042')
    await chip(page, 'ABERTA').click()
    await expect(page).toHaveURL(/\?edition=open$/)
    await expect(chip(page, 'ABERTA')).toBeChecked()
    await page.goBack()
    await expect(page).not.toHaveURL(/nfts/)
  })

  test('the quantity stops at what remains: 1 of 50 left means "+" is disabled', async ({
    page,
  }) => {
    await openNft(page, 'violet-nomad-314', '?edition=limited-50')
    await expect(page.getByText('1 de 50 disponíveis')).toBeVisible()
    await expect(quantity(page)).toHaveText('1')
    await expect(plus(page)).toBeDisabled()
    await expect(minus(page)).toBeDisabled()
  })

  test("the cart's own units count against the limit (Ana already holds 1 ABERTA)", async ({
    page,
  }) => {
    await loginAs(page, 'ana')
    await openNft(page, 'emerald-ape-042', '?edition=open')
    await expect(page.getByText(/você já tem 1 no carrinho/)).toBeVisible()
    await setQuantity(page, 9)
    await expect(plus(page)).toBeDisabled()
    await expect(quantity(page)).toHaveText('9')
  })
})

test.describe('add to cart (DET-15 – DET-19)', () => {
  test('a guest adds 2 units and lands on the cart; the count, and the guest cart, survive a reload', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042', '?edition=limited-10')
    await plus(page).click()
    await expect(quantity(page)).toHaveText('2')
    await buyButton(page, isMobile).click()

    await expect(page).toHaveURL(/\/cart$/)
    if (!isMobile) await expect(page.getByRole('link', { name: 'Carrinho, 2 itens' })).toBeVisible()
    const guestId = await page.evaluate(() => localStorage.getItem('kurio.guestCartId'))
    expect(guestId).toMatch(/^g_/)

    await openNft(page, 'emerald-ape-042', '?edition=limited-10')
    await expect(page.getByText(/você já tem 2 no carrinho/)).toBeVisible()
    if (!isMobile) await expect(page.getByRole('link', { name: 'Carrinho, 2 itens' })).toBeVisible()
  })

  test('a double click sends one request', async ({ page, isMobile }) => {
    await openNft(page, 'emerald-ape-042', '?edition=open')
    await buyButton(page, isMobile).dblclick()
    await expect(page).toHaveURL(/\/cart$/)
    expect(await mock(page).requests({ op: 'cart.addItem' })).toHaveLength(1)
  })

  test('mobile: the cart button adds and stays, with a toast that opens the cart', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'The cart button is part of the mobile buy bar')
    await openNft(page, 'emerald-ape-042', '?edition=open')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByText('Adicionado ao carrinho')).toBeVisible()
    await expect(page).toHaveURL(/\/nfts\/emerald-ape-042/)

    await page.getByRole('button', { name: 'Ver carrinho' }).click()
    await expect(page).toHaveURL(/\/cart$/)
  })

  test('an edition that sold out under the user says so, refetches, and leaves the cart alone', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042', '?edition=limited-10')
    await waitForConnection(page)
    // The page is cut off from the events, so only the API knows (the 409 is the real one).
    await realtime(page).drop({ block: true })
    await mock(page).updateNft('emerald-ape-042', {
      available: { editionId: 'limited-10', value: 0 },
    })
    await mock(page).clearRequests()

    await buyButton(page, isMobile).click()

    await expect(page.getByRole('alert').filter({ hasText: 'Esta edição esgotou' })).toBeVisible()
    await expect(page).toHaveURL(/\/nfts\/emerald-ape-042/)
    await expect.poll(async () => (await mock(page).requests({ op: 'nfts.get' })).length).toBe(1)
    await expect(chip(page, /1\/10/)).toBeDisabled()
    if (!isMobile) await expect(page.getByRole('link', { name: 'Carrinho' })).toBeVisible()
    const cart = await mock(page).snapshot()
    expect(Object.values(cart.carts)).toHaveLength(1) // only Ana's seeded cart: no guest cart was made
  })

  test('"not enough left" lowers the quantity to what the server says remains', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042', '?edition=limited-10')
    await waitForConnection(page)
    await setQuantity(page, 3)
    await realtime(page).drop({ block: true })
    await mock(page).updateNft('emerald-ape-042', {
      available: { editionId: 'limited-10', value: 2 },
    })

    await buyButton(page, isMobile).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'Restam apenas 2 unidades' }),
    ).toBeVisible()
    await expect(quantity(page)).toHaveText('2')
  })

  test('another failure shows a toast whose "Tentar novamente" repeats the request', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042', '?edition=open')
    await mock(page).addRule({
      op: 'cart.addItem',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })

    await buyButton(page, isMobile).click()
    await expect(page.getByText('Não foi possível adicionar ao carrinho.')).toBeVisible()
    await expect(page).toHaveURL(/\/nfts\//)

    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(/\/cart$/)
  })

  test('desktop: the card cart button adds one unit of the first available edition', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'The card actions are the desktop hover row')
    await page.goto('/?q=golden')
    const card = page.getByTestId('product-card').filter({ hasText: 'Golden Beat #207' })
    await card.hover()
    await card.getByRole('button', { name: 'Adicionar Golden Beat #207 ao carrinho' }).click()

    await expect(page.getByText('Adicionado ao carrinho')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Carrinho, 1 item' })).toBeVisible()
    const { carts } = await mock(page).snapshot()
    const guestCart = Object.entries(carts).find(([key]) => key.startsWith('guest:'))?.[1]
    expect(guestCart?.items).toMatchObject([{ nftId: 'golden-beat-207', quantity: 1 }])
  })
})

test.describe('live updates (DET-24)', () => {
  test('a new price shows without reloading', async ({ page }) => {
    await openNft(page, 'emerald-ape-042')
    await waitForConnection(page)
    await mock(page).updateNft('emerald-ape-042', { price: '1.25' })
    await expect(shown(page.getByText(/1\.25\sETH/))).toBeVisible()
    await expect(page.getByText('Preço atualizado para 1.25 ETH')).toBeAttached()
  })

  test('the selected edition selling out stays selected but disabled, and blocks buying', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042', '?edition=limited-10')
    await waitForConnection(page)
    await mock(page).updateNft('emerald-ape-042', {
      available: { editionId: 'limited-10', value: 0 },
    })

    const sold = chip(page, /1\/10/)
    await expect(sold).toBeDisabled()
    await expect(sold).toBeChecked()
    await expect(buyButton(page, isMobile)).toBeDisabled()
    await expect(page.getByText('Esta edição esgotou. Escolha outra edição.')).toBeVisible()
  })

  test('a limit that drops below the chosen quantity lowers it and announces it', async ({
    page,
  }) => {
    await openNft(page, 'emerald-ape-042', '?edition=limited-10')
    await waitForConnection(page)
    await setQuantity(page, 3)
    await mock(page).updateNft('emerald-ape-042', {
      available: { editionId: 'limited-10', value: 1 },
    })

    await expect(quantity(page)).toHaveText('1')
    await expect(page.getByText('Quantidade ajustada para 1 (disponível: 1).')).toBeAttached()
    await expect(plus(page)).toBeDisabled()
  })
})

test.describe('content (DET-05 – DET-09)', () => {
  test('gallery: thumbnails swap the image (desktop), the zoom dialog names the image and returns focus', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042')
    const zoom = page.getByRole('button', { name: 'Ampliar imagem' })

    if (isMobile) {
      await page.locator('[role=group][aria-roledescription=slide]').nth(1).scrollIntoViewIfNeeded()
      await page.getByRole('button', { name: 'Ver imagem 2 de 4' }).click()
      await expect(page.getByRole('button', { name: 'Ver imagem 2 de 4' })).toHaveAttribute(
        'aria-current',
        'true',
      )
    } else {
      const thumb = page.getByRole('button', { name: 'Imagem 2 de 4' })
      await expect(page.getByRole('button', { name: 'Imagem 1 de 4' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await thumb.click()
      await expect(thumb).toHaveAttribute('aria-pressed', 'true')
    }

    await zoom.click()
    await expect(page.getByRole('dialog', { name: /imagem 2 de 4/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(zoom).toBeFocused()
  })

  test('tabs: each spec value is under its own label, the reviews list and the rating link', async ({
    page,
    isMobile,
  }) => {
    await openNft(page, 'emerald-ape-042')
    const value = (label: string) =>
      page.locator('dt', { hasText: `${label}:` }).locator('xpath=following-sibling::dd')
    await expect(value('Rede')).toContainText('Ethereum')
    await expect(value('Contrato')).toContainText('0x7A42')
    await expect(value('Direitos autorais')).toContainText('5%')

    const reviewsTab = page.getByRole('tab', { name: 'Avaliações de colecionadores (19)' })
    await reviewsTab.click()
    await expect(page.getByRole('tabpanel').getByRole('article')).toHaveCount(3)
    await expect(page.getByText('Mostrando 3 de 19 avaliações')).toBeVisible()

    await page.getByRole('tab', { name: 'Detalhes do NFT' }).click()
    await expect(reviewsTab).toHaveAttribute('aria-selected', 'false')
    await (
      isMobile
        ? page.getByRole('button', { name: /Ver avaliações/ })
        : page.getByRole('button', { name: '19 avaliações de colecionadores' })
    ).click()
    await expect(reviewsTab).toHaveAttribute('aria-selected', 'true')
  })

  test('related: five compact cards in order, each opening its own details', async ({ page }) => {
    await openNft(page, 'emerald-ape-042')
    const related = page.getByRole('region', { name: 'Mais desta coleção' })
    const cards = related.getByTestId('product-card')
    await expect(cards).toHaveCount(5)
    expect(await cards.locator('h3').allTextContents()).toEqual([
      'Cosmic Bloom #118',
      'Violet Nomad #314',
      'Ivory Baron #088',
      'Golden Beat #207',
      'Golden Signal #160',
    ])

    await related.getByRole('link', { name: 'Cosmic Bloom #118' }).click()
    await expect(page).toHaveURL(/\/nfts\/cosmic-bloom-118/)
    await expect(heading(page)).toHaveText('Cosmic Bloom #118')
    // A fresh selection: the first edition with stock, not Emerald's.
    await expect(chip(page, '1/10')).toBeChecked()
  })

  test('share links are real share targets for this page (desktop)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The share row is desktop only, as in Figma')
    await openNft(page, 'emerald-ape-042')
    const url = encodeURIComponent('http://localhost:4173/nfts/emerald-ape-042')
    const linkedin = page.getByRole('link', { name: /Compartilhar no LinkedIn/ })
    await expect(linkedin).toHaveAttribute(
      'href',
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    )
    await expect(linkedin).toHaveAttribute('target', '_blank')
    await expect(linkedin).toHaveAttribute('rel', /noopener/)
    await expect(page.getByRole('link', { name: /Compartilhar no Twitter/ })).toHaveAttribute(
      'href',
      `https://twitter.com/intent/tweet?url=${url}&text=${encodeURIComponent('Emerald Ape #042')}`,
    )
    await expect(page.getByRole('link', { name: 'Compartilhar por e-mail' })).toHaveAttribute(
      'href',
      `mailto:?subject=${encodeURIComponent('Emerald Ape #042 na KURIO')}&body=${url}`,
    )
  })

  test('the details of an unavailable NFT and a related failure do not break each other', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/nfts/emerald-ape-042')
    await page.clock.runFor(500)
    await expect(heading(page)).toBeVisible()
    await mock(page).addRule({
      op: 'nfts.related',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 'always',
    })
    const related = page.getByRole('region', { name: 'Mais desta coleção' })
    await related.getByRole('link', { name: 'Cosmic Bloom #118' }).click()
    await page.clock.runFor(5000)

    await expect(heading(page)).toHaveText('Cosmic Bloom #118')
    await expect(related.getByRole('alert')).toContainText('Não foi possível carregar')
    await mock(page).clearRules()
    await related.getByRole('button', { name: 'Tentar novamente' }).click()
    await page.clock.runFor(500)
    await expect(related.getByTestId('product-card')).not.toHaveCount(0)
  })
})

test.describe('keyboard and accessibility (DET-27)', () => {
  test('a purchase with the keyboard only: edition, quantity, COMPRAR', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'On mobile the buy bar follows the whole content in tab order')
    await openNft(page, 'emerald-ape-042')
    await chip(page, '1/1').focus()
    // Radix checks the radio on focus only while the arrow is still down; `press` releases it
    // before the focus move, which a real key held for a few frames never does.
    await page.keyboard.down('ArrowRight')
    await expect(chip(page, '1/10')).toBeFocused()
    await page.keyboard.up('ArrowRight')
    await expect(chip(page, '1/10')).toBeChecked()

    await page.keyboard.press('Tab')
    await expect(plus(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(quantity(page)).toHaveText('2')

    await page.keyboard.press('Tab')
    await expect(buyButton(page, false)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/cart$/)
  })

  test('the mobile buy bar is a labelled region that follows the content', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Mobile only')
    await openNft(page, 'emerald-ape-042')
    const bar = page.getByRole('region', { name: 'Compra' })
    await expect(bar).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Comprar NFT' })).toBeVisible()
    const box = await bar.boundingBox()
    const viewport = page.viewportSize()
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(viewport?.height)
    for (const button of await bar.getByRole('button').all()) {
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(22)
    }
  })

  test('axe: details, sold out, and not found', async ({ page }) => {
    await openNft(page, 'emerald-ape-042')
    await expectNoAxeViolations(page)
    await openNft(page, 'obsidian-mask-007')
    await expectNoAxeViolations(page)
    await page.goto('/nfts/nao-existe')
    await expect(heading(page)).toHaveText('NFT não encontrado')
    await expectNoAxeViolations(page)
  })
})
