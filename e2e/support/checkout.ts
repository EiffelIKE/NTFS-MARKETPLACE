import type { Locator, Page } from '@playwright/test'

import type { ScenarioId } from '../../src/mocks/scenarios'
import { loginAs } from './mock'
import { waitForConnection } from './realtime'
import { expect } from './test'

// Shared by the checkout specs (spec 09 design §12): the screen's landmarks and the steps every
// scenario repeats. Ana's seeded cart is Emerald Ape #042 (open, 1 × 1.19) and Golden Beat #207
// (1/50, 2 × 0.99): subtotal 3.17, Ethereum fee 0.016, total 3.186 ETH.

export const checkoutHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Finalizar compra' })
export const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Revise seu pedido' })
export const confirmPurchase = (page: Page) =>
  page.getByRole('button', { name: 'Confirmar compra', exact: true })
export const pay = (page: Page) =>
  reviewDialog(page).getByRole('button', { name: 'Confirmar pagamento' })
export const accept = (page: Page) =>
  reviewDialog(page).getByRole('button', { name: 'Aceitar novos valores' })
export const connection = (page: Page) => reviewDialog(page).getByTestId('wallet-connection')
export const pending = (page: Page) => page.getByTestId('order-pending')
export const declined = (page: Page) => page.getByTestId('order-declined')
export const polite = (page: Page) => page.getByTestId('announcer-polite')
export const assertive = (page: Page) => page.getByTestId('announcer-assertive')

/** Labels carry a hidden "(obrigatório)", so fields are found by a label prefix. */
export const field = (page: Page, label: string): Locator =>
  page.getByRole('main').getByLabel(new RegExp(`^${label}`))

/** ETH amounts are joined with a non-breaking space, which `\s` matches. */
export const eth = (value: string) => new RegExp(`${value.replace('.', '\\.')}\\sETH`)

/**
 * Signs in and opens the screen. A scenario switch reseeds the mock and drops its sessions, so the
 * scenario is applied first, on a bare page, and the sign-in comes after it.
 */
export async function openCheckout(
  page: Page,
  {
    as = 'ana',
    scenario,
    url = '/checkout',
  }: { as?: 'ana' | 'bruno' | 'carla'; scenario?: ScenarioId; url?: string } = {},
) {
  await page.goto(scenario ? `/?scenario=${scenario}` : '/')
  await loginAs(page, as)
  await page.goto(url)
  // The worker starts with the page: control calls are safe once `__mock` exists.
  await page.waitForFunction(() => '__mock' in window)
}

/** The form is ready: Ana's cart is in the summary and the buttons are live. */
export async function expectFormReady(page: Page) {
  await expect(checkoutHeading(page)).toBeAttached()
  await expect(confirmPurchase(page)).toBeEnabled()
}

/** Opens the review and waits for its quote. */
export async function openReview(page: Page) {
  await confirmPurchase(page).click()
  await expect(reviewDialog(page)).toBeVisible()
  await expect(reviewDialog(page).getByTestId('quote-total')).toBeVisible()
}

/** Connects the wallet in the open review. */
export async function connectWallet(page: Page) {
  await connection(page)
    .getByRole('button', { name: /^Conectar / })
    .click()
  await expect(connection(page)).toContainText('Conectada')
}

/** From the form to the payment click: review, connect, pay. */
export async function reviewConnectAndPay(page: Page) {
  await openReview(page)
  await connectWallet(page)
  await expect(pay(page)).toBeEnabled()
  await pay(page).click()
}

/** The screen's reads have landed and the socket is up, so a later 401 cannot come from a read. */
export async function settle(page: Page, userId = 'usr_ana') {
  await expectFormReady(page)
  await waitForConnection(page, { userId })
}

/**
 * Connects the wallet only when the review shows it disconnected, after its first answer: a session
 * that came back from login finds the connection the server already holds.
 */
export async function ensureConnected(page: Page) {
  await expect(connection(page)).toContainText(/Conectada|Carteira desconectada/)
  if (
    await connection(page)
      .getByRole('button', { name: /^Conectar / })
      .isVisible()
  ) {
    await connectWallet(page)
  }
}
