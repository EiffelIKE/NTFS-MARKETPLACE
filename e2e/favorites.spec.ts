import type { Page } from '@playwright/test'

import { forgetSession, loginAs, mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 06 design §11 (brief §9 scenario 4): favorites, including a failed mutation and its
// recovery, in both projects. Ana's seeded favorites do not include Cosmic Bloom #118 (Sage Nomad
// #009 is one of them), so the toggles below start from "not favorited".

// Rejections are the point of several tests, and the browser logs each 4xx and network failure.
test.use({ allowedConsoleErrors: [/Failed to load resource/] })

const NFT = 'cosmic-bloom-118'
const NAME = 'Cosmic Bloom #118'
const FAILED = 'Não foi possível atualizar seus favoritos.'

/** Desktop has the labelled "Favoritar" button; mobile has the heart in the top bar. */
const heart = (page: Page, isMobile: boolean) =>
  isMobile
    ? page.getByRole('button', { name: `Favoritar ${NAME}` })
    : page.getByRole('button', { name: /^Favorit(ar|ado)$/ })

async function openDetails(page: Page, id = NFT) {
  await page.goto(`/nfts/${id}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

async function serverFavorites(page: Page): Promise<string[]> {
  const { favorites } = await mock(page).snapshot()
  return favorites.usr_ana ?? []
}

test.describe('toggle (DET-20, DET-23)', () => {
  test('flips before the server answers, persists after a reload, and shows in the favorites list', async ({
    page,
    isMobile,
  }) => {
    await loginAs(page, 'ana')
    await openDetails(page)
    await mock(page).configure({ latency: { kind: 'fixed', ms: 1000 } })

    await heart(page, isMobile).click()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
    // The request is still in flight: only the cache knows.
    expect(await serverFavorites(page)).not.toContain(NFT)
    await expect.poll(() => serverFavorites(page)).toContain(NFT)

    await page.reload()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/?favorites=1')
    await expect(page.getByTestId('product-card').filter({ hasText: NAME })).toBeVisible()

    await openDetails(page)
    // A fresh page load: wait for the list to arrive, or the heart still shows "not favorited".
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
    await heart(page, isMobile).click()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => serverFavorites(page)).not.toContain(NFT)
    await page.goto('/?favorites=1')
    await expect(page.getByTestId('product-card').filter({ hasText: NAME })).toHaveCount(0)
  })

  test('the desktop button says "Favoritar" / "Favoritado" and exposes the state', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'The labelled button is the desktop control')
    await loginAs(page, 'ana')
    await openDetails(page)
    const button = page.getByRole('button', { name: 'Favoritar', exact: true })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(page.getByRole('button', { name: 'Favoritado', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

test.describe('failure and recovery (DET-21)', () => {
  test('a failed request undoes the change and says so; "Tentar novamente" applies and persists it', async ({
    page,
    isMobile,
  }) => {
    await loginAs(page, 'ana')
    await openDetails(page)
    await mock(page).configure({ latency: { kind: 'fixed', ms: 800 } })
    await mock(page).addRule({
      op: 'favorites.add',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })

    await heart(page, isMobile).click()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(FAILED)).toBeVisible()
    expect(await serverFavorites(page)).not.toContain(NFT)

    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => serverFavorites(page)).toContain(NFT)
    await page.reload()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
  })

  test('three rapid clicks end on, in the cache and on the server', async ({ page, isMobile }) => {
    await loginAs(page, 'ana')
    await openDetails(page)

    await heart(page, isMobile).click({ clickCount: 3 })

    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => serverFavorites(page)).toContain(NFT)
    await expect
      .poll(async () => (await mock(page).requests({ op: 'favorites.add' })).length)
      .toBe(2)
    expect(await mock(page).requests({ op: 'favorites.remove' })).toHaveLength(1)
    await page.reload()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
  })

  test('an expired session rolls back, runs the expiry flow and shows no favorites error', async ({
    page,
    isMobile,
  }) => {
    await loginAs(page, 'ana')
    await openDetails(page)
    await mock(page).expireSessions()

    await heart(page, isMobile).click()

    await expect(page.getByText(/Sua sessão expirou/)).toBeVisible()
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(FAILED)).toHaveCount(0)
  })
})

test.describe('catalog cards (DET-25)', () => {
  test('the card heart toggles the same state the details page shows', async ({
    page,
    isMobile,
  }) => {
    await loginAs(page, 'ana')
    await page.goto('/?q=cosmic')
    const card = page.getByTestId('product-card').filter({ hasText: NAME })
    const cardHeart = card.getByRole('button', { name: `Favoritar ${NAME}` })
    if (!isMobile) await card.hover()
    await expect(cardHeart).toHaveAttribute('aria-pressed', 'false')
    await cardHeart.click()
    await expect(cardHeart).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => serverFavorites(page)).toContain(NFT)

    await card.getByRole('link', { name: NAME, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/nfts/${NFT}`))
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('guests and other users (DET-22, DET-23)', () => {
  test('a guest is sent to login with a way back, and nothing shows as favorited', async ({
    page,
    isMobile,
  }) => {
    await openDetails(page, 'sage-nomad-009')
    const guestHeart = isMobile
      ? page.getByRole('button', { name: 'Favoritar Sage Nomad #009' })
      : page.getByRole('button', { name: 'Favoritar', exact: true })

    await guestHeart.click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnfts%2Fsage-nomad-009$/)
    await page.goBack()
    await expect(guestHeart).toHaveAttribute('aria-pressed', 'false')
    expect(await mock(page).requests({ op: 'favorites.add' })).toHaveLength(0)
  })

  test("another account does not see the first one's favorite", async ({ page, isMobile }) => {
    await loginAs(page, 'ana')
    await openDetails(page)
    await heart(page, isMobile).click()
    await expect.poll(() => serverFavorites(page)).toContain(NFT)

    await forgetSession(page)
    await loginAs(page, 'bruno')
    await openDetails(page)
    await expect(heart(page, isMobile)).toHaveAttribute('aria-pressed', 'false')
  })

  test('signing out leaves the control unpressed for the guest that remains', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'mobile has no header menu: "Sair" lives in the profile screen (spec 08)')
    await loginAs(page, 'ana')
    await openDetails(page)
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favoritado', exact: true })).toBeVisible()
    await expect.poll(() => serverFavorites(page)).toContain(NFT)

    await page.getByRole('button', { name: 'Conta de Ana Souza' }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()

    await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
