import { expect, test, type Page } from '@playwright/test'

import { loginAs } from './support/mock'

const routes = [
  { path: '/nfts/1', link: 'Detalhes do NFT', heading: 'Detalhes do NFT', private: false },
  { path: '/cart', link: 'Carrinho', heading: 'Carrinho', private: false },
  { path: '/checkout', link: 'Finalizar compra', heading: 'Finalizar compra', private: true },
  {
    path: '/orders/1',
    link: 'Confirmação do pedido',
    heading: 'Confirmação do pedido',
    private: true,
  },
  { path: '/login', link: 'Entrar', heading: 'Entrar', private: false },
  { path: '/signup', link: 'Criar conta', heading: 'Criar conta', private: false },
  { path: '/profile', link: 'Perfil', heading: 'Perfil', private: true },
  { path: '/wallets', link: 'Carteiras', heading: 'Carteiras', private: true },
] as const

function heading(page: Page, name: string | RegExp) {
  return page.getByRole('heading', { level: 1, name, exact: typeof name === 'string' })
}

// The sign-up page titles itself differently below `lg` (spec 04 design §7).
const SIGNUP_HEADING = /^Criar (conta|perfil de colecionador)$/

test('home renders the brand heading, document metadata and a link to every route', async ({
  page,
}) => {
  await page.goto('/')
  await expect(heading(page, 'KURIO')).toBeVisible()
  await expect(page).toHaveTitle('KURIO — Marketplace de NFTs')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /KURIO/)
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1',
  )

  const nav = page.getByRole('navigation', { name: 'Telas' })
  for (const route of routes) {
    await expect(nav.getByRole('link', { name: route.link, exact: true })).toHaveAttribute(
      'href',
      route.path,
    )
  }
})

for (const route of routes) {
  test(`direct access to ${route.path} renders its placeholder`, async ({ page }) => {
    // Private routes sit behind the session guard (spec 04): start signed in.
    if (route.private) {
      await page.goto('/')
      await loginAs(page, 'ana')
    }
    await page.goto(route.path)
    await expect(
      heading(page, route.path === '/signup' ? SIGNUP_HEADING : route.heading),
    ).toBeVisible()
    await expect(page).toHaveTitle(`${route.heading} · KURIO`)
  })
}

test('reloading a deep link keeps the route and URL', async ({ page }) => {
  await page.goto('/nfts/abc')
  await expect(heading(page, 'Detalhes do NFT')).toBeVisible()
  await page.reload()
  await expect(heading(page, 'Detalhes do NFT')).toBeVisible()
  await expect(page).toHaveURL('/nfts/abc')
})

test('an unknown URL renders the not-found view and links back home', async ({ page }) => {
  await page.goto('/nao-existe')
  await expect(heading(page, 'Página não encontrada')).toBeVisible()
  await expect(page).toHaveTitle('Página não encontrada · KURIO')
  await expect(page).toHaveURL('/nao-existe')

  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page).toHaveURL('/')
  await expect(heading(page, 'KURIO')).toBeVisible()
})

test.describe('a route chunk that fails to load', () => {
  // The router reloads the page once on a missing module; the chunk stays blocked, so the second
  // attempt surfaces the error view.
  async function openBrokenCart(page: Page) {
    await page.goto('/')
    await page.context().route('**/assets/cart-*.js', (route) => route.abort())
    await page
      .getByRole('navigation', { name: 'Telas' })
      .getByRole('link', { name: 'Carrinho', exact: true })
      .click()
    await expect(heading(page, 'Algo deu errado')).toBeVisible()
    await page.context().unroute('**/assets/cart-*.js')
  }

  test('recovers with "Tentar novamente"', async ({ page }) => {
    await openBrokenCart(page)
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(heading(page, 'Carrinho')).toBeVisible()
  })

  test('recovers with "Recarregar página"', async ({ page }) => {
    await openBrokenCart(page)
    await page.getByRole('button', { name: 'Recarregar página' }).click()
    await expect(heading(page, 'Carrinho')).toBeVisible()
    await expect(page).toHaveURL('/cart')
  })
})

test('the login redirect param never crashes the page', async ({ page }) => {
  await page.goto('/login?redirect=https://evil.test')
  await expect(heading(page, 'Entrar')).toBeVisible()
  await page.goto('/login?redirect=/cart')
  await expect(heading(page, 'Entrar')).toBeVisible()
})
