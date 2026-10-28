import type { Locator, Page } from '@playwright/test'

import { homeHeading } from './support/home'
import { mock } from './support/mock'
import { expect, test } from './support/test'

// Brief §9 scenario 12: skeletons while loading slowly, failure feedback and recovery after a
// retry. Each screen spec adds its block; this file starts with the catalog (spec 05). Time is the
// page clock, so "slow" and "retry after 1 s, then 2 s" take no real time.

const cards = (page: Page) => page.getByTestId('product-card')
const names = (page: Page) => cards(page).locator('h3').allTextContents()
const results = (page: Page) => page.getByTestId('catalog-results')
const catalogPanel = (page: Page) => page.getByRole('tabpanel')

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('element has no box')
  return rect
}

/** Changes the sort from wherever the viewport keeps it: the toolbar, or the mobile sheet. */
async function chooseSort(page: Page, isMobile: boolean, label: string) {
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
  const scope = isMobile ? page.getByRole('dialog', { name: 'Filtros' }) : page.locator('main')
  await scope.getByRole('combobox', { name: /^Ordenar por/ }).click()
  await page.getByRole('option', { name: label }).click()
  if (isMobile)
    await page
      .getByRole('dialog', { name: 'Filtros' })
      .getByRole('button', { name: /^Ver / })
      .click()
}

test.describe('catalog', () => {
  test('slow network: nine skeleton cards in a busy region, replaced without a layout shift (CAT-14)', async ({
    page,
  }) => {
    await page.clock.install()
    await page.goto('/?scenario=slow')

    const skeletonRow = page.locator('ul[aria-hidden=true] > li')
    await expect(skeletonRow).toHaveCount(9)
    await expect(catalogPanel(page).locator('[aria-busy=true]')).toBeVisible()
    await expect(catalogPanel(page).getByRole('status')).toHaveText('Carregando catálogo')
    // Facet rows and the hero are skeletons too.
    await expect(page.locator('[data-slot=skeleton]').first()).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    const before = await box(skeletonRow.first())

    await page.clock.runFor(3000)
    await expect(cards(page)).toHaveCount(9)
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
    await expect(skeletonRow).toHaveCount(0)
    const after = await box(results(page).locator('ul > li').first())

    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(after[key] - before[key]), `${key} moved`).toBeLessThanOrEqual(1)
    }
  })

  test('a slow change keeps the previous cards, dimmed and busy, until the new ones arrive (CAT-15)', async ({
    page,
    isMobile,
  }) => {
    await page.clock.install()
    await page.goto('/?scenario=slow')
    await page.clock.runFor(3000)
    await expect(cards(page)).toHaveCount(9)
    const first = await names(page)

    await chooseSort(page, isMobile, 'Menor preço')
    await expect(page).toHaveURL(/sort=price-asc/)

    // The old grid stays, dimmed, and the region says it is updating.
    await expect(results(page)).toHaveAttribute('data-outdated', 'true')
    await expect(results(page)).toHaveCSS('opacity', '0.6')
    expect(await names(page)).toEqual(first)
    await expect(catalogPanel(page).locator('[aria-busy=true]')).toBeVisible()
    await expect(catalogPanel(page).getByRole('status')).toHaveText('Atualizando resultados')
    await expect(page.locator('ul[aria-hidden=true] > li')).toHaveCount(0)

    await page.clock.runFor(3000)
    await expect(cards(page).first()).toContainText('Penny Pixel #001')
    await expect(results(page)).not.toHaveAttribute('data-outdated')
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
  })

  test.describe('failures', () => {
    // The browser logs every failed request; the app's feedback is what these tests check.
    test.use({ allowedConsoleErrors: [/Failed to load resource|Failed to fetch|ERR_|net::/i] })

    test('503s exhaust the retries, then "Tentar novamente" recovers; the hero retries on its own (CAT-18)', async ({
      page,
    }) => {
      await page.clock.install()
      await page.goto('/?scenario=errors-then-recover')
      // Three failures per operation: the first call and its two retries (1 s, then 2 s).
      await page.clock.runFor(5000)

      const panel = catalogPanel(page)
      await expect(panel.getByRole('alert')).toContainText('Não foi possível carregar o catálogo')
      await expect(cards(page)).toHaveCount(0)
      // The hero failed on its own and keeps the page's h1.
      await expect(homeHeading(page)).toHaveText('KURIO')

      await page.getByRole('main').getByRole('button', { name: 'Tentar novamente' }).first().click()
      await page.clock.runFor(500)
      await expect(page.getByRole('region', { name: 'Destaques', exact: true })).toBeVisible()
      await expect(panel.getByRole('alert')).toBeVisible()

      await panel.getByRole('button', { name: 'Tentar novamente' }).click()
      await page.clock.runFor(500)
      await expect(cards(page)).toHaveCount(9)
      await expect(panel.getByRole('alert')).toHaveCount(0)
    })

    test('a failure after a successful load shows the alert above the old results, and retry recovers', async ({
      page,
      isMobile,
    }) => {
      await page.clock.install()
      await page.goto('/')
      await page.clock.runFor(1000)
      await expect(cards(page)).toHaveCount(9)
      const first = await names(page)

      await mock(page).addRule({
        op: 'nfts.list',
        effect: { kind: 'network-error' },
        times: 'always',
      })
      await chooseSort(page, isMobile, 'Maior preço')
      await page.clock.runFor(5000)

      const panel = catalogPanel(page)
      await expect(panel.getByRole('alert')).toContainText('Não foi possível carregar o catálogo')
      // The last results stay visible under the alert, marked as outdated.
      expect(await names(page)).toEqual(first)
      await expect(results(page)).toHaveAttribute('data-outdated', 'true')

      await mock(page).clearRules()
      await panel.getByRole('button', { name: 'Tentar novamente' }).click()
      await page.clock.runFor(500)
      await expect(cards(page).first()).toContainText('Crown Relic #999')
      await expect(panel.getByRole('alert')).toHaveCount(0)
      await expect(results(page)).not.toHaveAttribute('data-outdated')
    })
  })
})
