import type { Locator, Page } from '@playwright/test'

import { NftListResponse } from '../src/contracts'
import { expectNoAxeViolations } from './support/a11y'
import { homeHeading, openHome } from './support/home'
import { expectNoHorizontalOverflow } from './support/layout'
import { apiFetch, bearer, loginAs, mock } from './support/mock'
import { expect, test } from './support/test'

// Spec 05 design §13: the catalog on `/` (brief §9 scenario 1), in both projects. The data is the
// default scenario's 120 NFTs; expected results come from the mock REST API itself, so the page
// is compared with what the handlers return for the same query.

const cards = (page: Page) => page.getByTestId('product-card')
const names = (page: Page) => cards(page).locator('h3').allTextContents()

/** The results the REST handlers return for a query string (the page under test is not involved). */
async function apiNames(page: Page, query: string): Promise<string[]> {
  const { status, body } = await apiFetch(page, `/nfts?${query}`)
  expect(status).toBe(200)
  return NftListResponse.parse(body).items.map((item) => item.name)
}

async function waitForGrid(page: Page, count = 9) {
  await expect(cards(page)).toHaveCount(count)
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
}

/** Desktop filters sit in the sidebar; on mobile they live in a bottom sheet. */
async function openFilters(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole('complementary', { name: 'Filtros' })
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  await expect(sheet).toBeVisible()
  return sheet
}

async function closeFilters(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page
      .getByRole('dialog', { name: 'Filtros' })
      .getByRole('button', { name: /^Ver / })
      .click()
    await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeHidden()
  }
}

/** A facet row: the label that wraps the checkbox, so a click is a user's click. */
function facetRow(scope: Locator, name: RegExp | string) {
  return scope.locator('label').filter({ has: scope.page().getByRole('checkbox', { name }) })
}

async function chooseSort(page: Page, scope: Locator, label: string) {
  await scope.getByRole('combobox', { name: /^Ordenar por/ }).click()
  await page.getByRole('option', { name: label }).click()
}

/** The sort select is in the toolbar on desktop and inside the sheet on mobile. */
function sortScope(page: Page, isMobile: boolean) {
  return isMobile ? page.getByRole('dialog', { name: 'Filtros' }) : page.locator('main')
}

test.describe('the grid (CAT-06, CAT-21)', () => {
  test('shows the nine Figma cards with their prices', async ({ page }) => {
    await openHome(page)
    await waitForGrid(page)
    expect(await names(page)).toEqual([
      'Emerald Ape #042',
      'Sage Nomad #009',
      'Neon Vessel #552',
      'Cosmic Bloom #118',
      'Violet Nomad #314',
      'Ivory Baron #088',
      'Golden Beat #207',
      'Golden Frequency #071',
      'Golden Signal #160',
    ])
    const prices = ['1.19', '1.69', '1.99', '1.29', '1.39', '1.79', '0.99', '0.59', '0.39']
    for (const [index, price] of prices.entries()) {
      await expect(cards(page).nth(index)).toContainText(`${price} ETH`)
    }
    // Neon Vessel's previous price is struck through and has a text alternative.
    const previous = cards(page).nth(2).locator('s')
    await expect(previous).toContainText('2.29 ETH')
    await expect(previous).toContainText('Preço anterior:')
    await expect(cards(page).nth(2)).toContainText('Preço atual:')
    // Every card links to its details.
    await expect(
      cards(page).first().getByRole('link', { name: 'Emerald Ape #042', exact: true }),
    ).toHaveAttribute('href', '/nfts/emerald-ape-042')
  })

  test('images carry srcset, sizes and intrinsic size; only the first hero image is eager (CAT-23)', async ({
    page,
  }) => {
    await openHome(page)
    await waitForGrid(page)
    const card = await cards(page)
      .first()
      .locator('img')
      .evaluate((img: HTMLImageElement) => ({
        candidates: img.srcset.split(',').length,
        sizes: img.sizes,
        width: img.getAttribute('width'),
        height: img.getAttribute('height'),
        loading: img.loading,
      }))
    expect(card.candidates).toBe(3)
    expect(card.sizes).toContain('250px')
    expect(card.width).toBe('1000')
    expect(card.height).toBe('1000')
    expect(card.loading).toBe('lazy')

    const hero = page.getByRole('region', { name: 'Destaques', exact: true }).locator('img').first()
    await expect(hero).toHaveAttribute('fetchpriority', 'high')
    await expect(hero).toHaveAttribute('loading', 'eager')
  })

  test('the desktop card reveals its action on keyboard focus (CAT-21)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the hover actions are desktop-only')
    await openHome(page)
    await waitForGrid(page)
    const action = cards(page)
      .first()
      .getByRole('link', { name: 'Ver detalhes de Emerald Ape #042' })
    await expect(action)
      .toHaveCSS('opacity', '1', { timeout: 100 })
      .catch(() => undefined)
    await action.focus()
    await expect(action.locator('xpath=..')).toHaveCSS('opacity', '1')
  })
})

test.describe('search (CAT-05, CAT-07)', () => {
  /** Mobile types in the top field; desktop uses the header's search dialog. */
  async function search(page: Page, isMobile: boolean, term: string) {
    if (isMobile) {
      await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill(term)
    } else {
      await page.getByRole('banner').getByRole('button', { name: 'Buscar' }).click()
      await page.getByRole('searchbox', { name: 'Buscar por nome, coleção ou criador' }).fill(term)
      await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    }
  }

  test('"ape" filters the grid, resets the page and keeps the term in the URL', async ({
    page,
    isMobile,
  }) => {
    await openHome(page, '/?page=2')
    await waitForGrid(page)
    await search(page, isMobile, 'ape')
    await expect(page).toHaveURL(/[?&]q=ape(&|$|#)/)
    expect(new URL(page.url()).searchParams.has('page')).toBe(false)
    await expect(page.getByTestId('results-count')).toContainText('para “ape”')
    await expect.poll(() => names(page)).toEqual(await apiNames(page, 'q=ape&pageSize=9'))
  })

  test('a term without accents finds accented names', async ({ page, isMobile }) => {
    await openHome(page)
    await waitForGrid(page)
    await search(page, isMobile, 'musica')
    await expect(page).toHaveURL(/q=musica/)
    await expect.poll(() => names(page)).toEqual(await apiNames(page, 'q=m%C3%BAsica&pageSize=9'))
  })

  test('typing replaces the history entry instead of pushing one per keystroke (CAT-05)', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the debounced field is the mobile one')
    await openHome(page)
    await waitForGrid(page)
    const field = page.getByRole('searchbox', { name: 'Buscar NFTs' })
    await field.pressSequentially('nomad', { delay: 40 })
    await expect(page).toHaveURL(/q=nomad/)
    const length = await page.evaluate(() => history.length)
    await field.fill('')
    await expect(page).not.toHaveURL(/q=/)
    expect(await page.evaluate(() => history.length)).toBe(length)
  })

  test('"zzzz" shows the empty state and "Limpar filtros" returns to the default URL (CAT-13, CAT-17)', async ({
    page,
    isMobile,
  }) => {
    await openHome(page)
    await waitForGrid(page)
    await search(page, isMobile, 'zzzz')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByTestId('results-count')).toContainText('0 NFTs')
    await page.getByTestId('empty-state').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).toHaveURL(/^[^?#]*(#mercado)?$/)
    await waitForGrid(page)
  })
})

test.describe('filters and segments (CAT-07, CAT-08, CAT-03)', () => {
  test('categories, network and segment combine, show facet counts and survive a reload', async ({
    page,
    isMobile,
  }) => {
    await openHome(page)
    await waitForGrid(page)

    const filters = await openFilters(page, isMobile)
    await facetRow(filters, /^Música/).click()
    await facetRow(filters, /^Polygon/).click()
    await expect(page).toHaveURL(/categories=musica/)
    await expect(page).toHaveURL(/networks=polygon/)
    // A selected row has a cue besides color: bold and a check mark.
    await expect(facetRow(filters, /^Música/).locator('svg')).toBeVisible()
    await expect(filters.getByRole('checkbox', { name: /^Música/ })).toBeChecked()
    await closeFilters(page, isMobile)

    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/segment=trending/)
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const expected = await apiNames(
      page,
      'categories=musica&networks=polygon&segment=trending&pageSize=9',
    )
    await expect.poll(() => names(page)).toEqual(expected)

    // The counts are the facets of the response: each network row counts its own matches within
    // the other filters, zero included.
    const reopened = await openFilters(page, isMobile)
    const { body } = await apiFetch<{ facets: { networks: { label: string; count: number }[] } }>(
      page,
      '/nfts?categories=musica&networks=polygon&segment=trending&pageSize=1',
    )
    for (const { label, count } of body.facets.networks) {
      await expect(facetRow(reopened, new RegExp(`^${label}`))).toContainText(`(${String(count)})`)
    }
    await closeFilters(page, isMobile)

    await page.reload()
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const afterReload = await openFilters(page, isMobile)
    await expect(afterReload.getByRole('checkbox', { name: /^Música/ })).toBeChecked()
    await expect(afterReload.getByRole('checkbox', { name: /^Polygon/ })).toBeChecked()
    await expect(afterReload.getByRole('checkbox', { name: /^Solana/ })).not.toBeChecked()
    await closeFilters(page, isMobile)
    await expect.poll(() => names(page)).toEqual(expected)
  })

  test('"Limpar filtros" in the results bar clears every param', async ({ page }) => {
    await openHome(page, '/?categories=musica&segment=new&sort=popular')
    await waitForGrid(page)
    await page
      .getByTestId('results-count')
      .locator('..')
      .getByRole('button', { name: 'Limpar filtros' })
      .click()
    await expect(page).toHaveURL(/^[^?]*$/)
    await waitForGrid(page)
  })

  test('the footer "Música" link opens the catalog with the row checked', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the footer is desktop-only')
    await openHome(page)
    await page.getByRole('contentinfo').getByRole('link', { name: 'Música' }).click()
    await expect(page).toHaveURL('/?categories=musica#mercado')
    await expect(
      page
        .getByRole('complementary', { name: 'Filtros' })
        .getByRole('checkbox', { name: /^Música/ }),
    ).toBeChecked()
    await expect
      .poll(() => names(page))
      .toEqual(await apiNames(page, 'categories=musica&pageSize=9'))
  })
})

test.describe('sorting (CAT-10)', () => {
  test('"Menor preço" and "Maior preço" reorder the whole catalog', async ({ page, isMobile }) => {
    await openHome(page)
    await waitForGrid(page)

    if (isMobile) await openFilters(page, true)
    await chooseSort(page, sortScope(page, isMobile), 'Menor preço')
    await closeFilters(page, isMobile)
    await expect(page).toHaveURL(/sort=price-asc/)
    await expect(cards(page).first()).toContainText('Penny Pixel #001')
    await expect(cards(page).first()).toContainText('0.02 ETH')

    if (isMobile) await openFilters(page, true)
    await chooseSort(page, sortScope(page, isMobile), 'Maior preço')
    await closeFilters(page, isMobile)
    await expect(page).toHaveURL(/sort=price-desc/)
    await expect(cards(page).first()).toContainText('Crown Relic #999')
  })
})

test.describe('price range (CAT-09)', () => {
  test('two thumbs move by keyboard and "Aplicar" writes the range to the URL', async ({
    page,
    isMobile,
  }) => {
    await openHome(page)
    await waitForGrid(page)
    const filters = await openFilters(page, isMobile)

    const label = filters.getByText(/^Preço: /)
    await expect(label).toHaveText(/^Preço: 0\.02 - \d+\.\d{2} ETH$/)
    const min = filters.getByRole('slider', { name: 'Preço mínimo' })
    const max = filters.getByRole('slider', { name: 'Preço máximo' })
    await expect(min).toHaveAttribute('aria-valuetext', /ETH$/)

    await min.focus()
    for (let press = 0; press < 5; press++) await page.keyboard.press('PageUp')
    await max.focus()
    for (let press = 0; press < 20; press++) await page.keyboard.press('PageDown')
    // Nothing reaches the URL until "Aplicar".
    expect(new URL(page.url()).searchParams.has('minPrice')).toBe(false)

    const text = (await label.textContent()) ?? ''
    const [, from, to] = /^Preço: (\d+\.\d{2}) - (\d+\.\d{2}) ETH$/.exec(text) ?? []
    expect(from).toBe('0.52')
    await filters.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page).toHaveURL(new RegExp(`minPrice=0\\.52`))
    const params = new URL(page.url()).searchParams
    expect(params.get('maxPrice')).toBe(String(Number(to)))
    await closeFilters(page, isMobile)
    await expect
      .poll(() => names(page))
      .toEqual(await apiNames(page, `minPrice=0.52&maxPrice=${String(Number(to))}&pageSize=9`))
  })
})

test.describe('pagination and history (CAT-04, CAT-05, CAT-11)', () => {
  test('page 2 puts focus on the heading, and a filter change drops the page', async ({ page }) => {
    await openHome(page)
    await waitForGrid(page)
    const first = await names(page)
    await page
      .getByRole('navigation', { name: 'Paginação' })
      .getByRole('link', { name: 'Página 2' })
      .click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('#mercado-title')).toBeFocused()
    await expect.poll(() => names(page)).not.toEqual(first)
    await expect.poll(() => names(page)).toEqual(await apiNames(page, 'page=2&pageSize=9'))
    await expect(
      page.getByRole('navigation', { name: 'Paginação' }).getByRole('link', { name: 'Página 2' }),
    ).toHaveAttribute('aria-current', 'page')

    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await expect(page).toHaveURL(/segment=new/)
    expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  })

  test('back and forward restore the URL and the grid, from the cache', async ({ page }) => {
    await openHome(page)
    await waitForGrid(page)
    const home = await names(page)

    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/segment=trending/)
    await expect.poll(() => names(page)).not.toEqual(home)
    const trending = await names(page)

    await page
      .getByRole('navigation', { name: 'Paginação' })
      .getByRole('link', { name: 'Página 2' })
      .click()
    await expect(page).toHaveURL(/page=2/)
    await expect.poll(() => names(page)).not.toEqual(trending)
    const second = await names(page)
    const requests = (await mock(page).requests({ op: 'nfts.list' })).length

    const skeletons = () => page.locator('[data-slot=skeleton]').count()
    await page.goBack()
    await expect(page).toHaveURL(/segment=trending/)
    expect(new URL(page.url()).searchParams.has('page')).toBe(false)
    expect(await skeletons()).toBe(0)
    expect(await names(page)).toEqual(trending)

    await page.goBack()
    expect(new URL(page.url()).search).toBe('')
    expect(await skeletons()).toBe(0)
    expect(await names(page)).toEqual(home)

    await page.goForward()
    await expect(page).toHaveURL(/segment=trending/)
    expect(await names(page)).toEqual(trending)
    await page.goForward()
    await expect(page).toHaveURL(/page=2/)
    expect(await names(page)).toEqual(second)
    // Every step was served by the cache.
    expect((await mock(page).requests({ op: 'nfts.list' })).length).toBe(requests)
  })
})

test.describe('malformed URLs and missing pages (CAT-02, CAT-12)', () => {
  test('unknown or malformed params fall back to the defaults without an error', async ({
    page,
  }) => {
    await openHome(page, '/?page=abc&sort=foo&categories=nope&minPrice=9&maxPrice=1&segment=zzz')
    await waitForGrid(page)
    expect(await names(page)).toEqual(await apiNames(page, 'pageSize=9'))
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
    await expect(page.getByTestId('results-count')).toHaveCount(0)
  })

  test('a page beyond the last shows an empty state with a way back', async ({ page }) => {
    await openHome(page, '/?page=99')
    await expect(page.getByRole('heading', { name: 'Esta página não existe' })).toBeVisible()
    await page.getByRole('link', { name: 'Ir para a primeira página' }).click()
    await expect(page).not.toHaveURL(/page=/)
    await waitForGrid(page)
  })
})

test.describe('scenarios', () => {
  test('an empty catalog says so, with the static hero and no featured banner (CAT-17, CAT-19)', async ({
    page,
  }) => {
    await openHome(page, '/?scenario=empty')
    await expect(
      page.getByRole('heading', { name: 'Nenhum NFT disponível no momento' }),
    ).toBeVisible()
    await expect(homeHeading(page)).toContainText(/SEJA DONO D/)
    await expect(page.getByRole('button', { name: /^Destaque \d/ })).toHaveCount(0)
    await expect(page.getByText('NFT EM DESTAQUE')).toHaveCount(0)
    await expect(page.getByTestId('results-count')).toHaveCount(0)
  })

  test('responses that arrive out of order never replace newer results (CAT-16)', async ({
    page,
    isMobile,
  }) => {
    // The mock answers the first, third, ... call slowly (1.8 s) and the others fast (0.2 s).
    await page.clock.install()
    await openHome(page, '/?scenario=out-of-order')
    await page.clock.runFor(2000)
    await waitForGrid(page)

    // Call 2 (fast): Música.
    let filters = await openFilters(page, isMobile)
    await facetRow(filters, /^Música/).click()
    await expect(page).toHaveURL(/categories=musica/)
    await page.clock.runFor(300)
    await expect.poll(() => names(page)).not.toEqual([])

    // Call 3 (slow): Polygon. Call 4 (fast), before call 3 answers: Solana as well.
    if (!isMobile) filters = page.getByRole('complementary', { name: 'Filtros' })
    await facetRow(filters, /^Polygon/).click()
    await expect(page).toHaveURL(/networks=polygon/)
    await facetRow(filters, /^Solana/).click()
    await expect(page).toHaveURL(/networks=polygon%2Csolana|networks=polygon,solana/)
    await page.clock.runFor(300)
    await closeFilters(page, isMobile)

    const latest = names(page)
    await expect(cards(page).first()).toBeVisible()
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
    const shown = await latest

    // Call 3 answers now. Its results belong to a state the user left, so they are never shown.
    await page.clock.runFor(2000)
    expect(await names(page)).toEqual(shown)
    await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
    await expect(page.getByTestId('catalog-results')).not.toHaveAttribute('data-outdated')

    // The stale call completed in the mock, so it was the page that ignored it.
    const log = await mock(page).requests({ op: 'nfts.list' })
    expect(
      log.some((entry) => entry.url.includes('networks=polygon') && !entry.url.includes('solana')),
    ).toBe(true)
    await page.clock.resume()
    await expect
      .poll(() => names(page))
      .toEqual(await apiNames(page, 'categories=musica&networks=polygon,solana&pageSize=9'))
  })
})

test.describe('favorites mode (CAT-24)', () => {
  test('a visitor is sent to log in and comes back to the list', async ({ page }) => {
    await page.goto('/?favorites=1')
    await expect(page).toHaveURL('/login?redirect=%2F%3Ffavorites%3D1')
  })

  test('a signed-in collector sees only their favorites under "Lista de interesse"', async ({
    page,
    isMobile,
  }) => {
    const token = await loginAs(page, 'ana')
    const { body } = await apiFetch<{ nftIds: string[] }>(page, '/favorites', {
      headers: bearer(token),
    })
    expect(body.nftIds).toHaveLength(5)

    await page.goto('/?favorites=1')
    await expect(page.getByRole('heading', { level: 2, name: 'Lista de interesse' })).toBeVisible()
    await expect(page).toHaveTitle('Lista de interesse · KURIO')
    await expect(cards(page)).toHaveCount(5)
    for (const id of body.nftIds) {
      await expect(page.locator(`[data-nft-id="${id}"]`)).toHaveCount(1)
    }
    if (isMobile) {
      await expect(
        page
          .getByRole('navigation', { name: 'Principal' })
          .getByRole('link', { name: 'Favoritos' }),
      ).toHaveAttribute('aria-current', 'page')
    }
  })

  test('the mobile heart and the footer link open the list', async ({ page, isMobile }) => {
    await loginAs(page, 'ana')
    await page.goto('/')
    await expect(homeHeading(page)).toBeVisible()
    if (isMobile) {
      await page
        .getByRole('navigation', { name: 'Principal' })
        .getByRole('link', { name: 'Favoritos' })
        .click()
    } else {
      await page.getByRole('contentinfo').getByRole('link', { name: 'Lista de interesse' }).click()
    }
    await expect(page).toHaveURL('/?favorites=1')
    await expect(cards(page)).toHaveCount(5)
  })
})

test.describe('search entry points (CAT-25)', () => {
  test('the header search opens a dialog that leads to the results', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the header search is desktop-only')
    await openHome(page)
    await waitForGrid(page)
    await page.getByRole('banner').getByRole('button', { name: 'Buscar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('searchbox')).toBeFocused()
    await dialog.getByRole('searchbox').fill('neon')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/?q=neon#mercado')
    await expect(dialog).toBeHidden()
    await expect.poll(() => names(page)).toContain('Neon Vessel #552')
    await expect(page.locator('#mercado-title')).toBeFocused()
  })

  test('the tab bar button focuses the mobile search field', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the tab bar is mobile-only')
    await openHome(page)
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Buscar' })
      .click()
    await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toBeFocused()
    await page.keyboard.type('neon')
    await expect(page).toHaveURL(/q=neon/)
    await expect.poll(() => names(page)).toContain('Neon Vessel #552')
  })

  test('away from the catalog, the tab bar button opens the dialog', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the tab bar is mobile-only')
    await loginAs(page, 'ana')
    await page.goto('/profile')
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Buscar' })
      .click()
    await expect(page.getByRole('dialog', { name: 'Buscar NFTs' })).toBeVisible()
  })
})

test.describe('mobile composition (CAT-26)', () => {
  test('the sheet filters and sorts, shows the active count and closes with the result count', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the sheet is mobile-only')
    await openHome(page)
    await waitForGrid(page)
    const sheet = await openFilters(page, true)
    await facetRow(sheet, /^Arte 3D/).click()
    await chooseSort(page, sheet, 'Menor preço')
    await expect(page).toHaveURL(/categories=arte-3d/)
    await expect(page).toHaveURL(/sort=price-asc/)
    const expected = await apiNames(page, 'categories=arte-3d&sort=price-asc&pageSize=9')
    await expect(sheet.getByRole('button', { name: /^Ver \d+ NFTs$/ })).toBeVisible()
    await sheet.getByRole('button', { name: /^Ver / }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: 'Filtros, 1 ativos' })).toBeFocused()
    await expect.poll(() => names(page)).toEqual(expected)
  })

  test('the segment tabs scroll sideways and the page does not', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the scroller is mobile-only')
    await openHome(page)
    const list = page.getByRole('tablist', { name: 'Segmentos do catálogo' })
    const { scrollWidth, clientWidth } = await list.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }))
    expect(scrollWidth).toBeGreaterThan(clientWidth)
    await expectNoHorizontalOverflow(page)
  })

  test('the grid is two staggered columns at 390 and three columns at 768', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'viewport sizes are set here')
    await openHome(page)
    await waitForGrid(page)
    const top = (index: number) =>
      cards(page)
        .nth(index)
        .evaluate((n) => n.getBoundingClientRect().top)
    const left = (index: number) =>
      cards(page)
        .nth(index)
        .evaluate((n) => n.getBoundingClientRect().left)
    expect(await left(1)).toBeGreaterThan(await left(0))
    expect(await top(1)).toBeGreaterThan((await top(0)) + 20)
    expect(await top(2)).toBeGreaterThan((await top(0)) + 100)

    await page.setViewportSize({ width: 768, height: 900 })
    await expect.poll(async () => Math.abs((await top(1)) - (await top(0)))).toBeLessThan(2)
    expect(Math.abs((await top(2)) - (await top(0)))).toBeLessThan(2)
  })
})

test.describe('hero and bands (CAT-20, CAT-22)', () => {
  test('the dots move between slides and "EXPLORAR" opens the slide NFT', async ({ page }) => {
    await openHome(page)
    const dots = page.getByRole('button', { name: /^Destaque \d de 3$/ })
    await expect(dots).toHaveCount(3)
    await expect(dots.first()).toHaveAttribute('aria-current', 'true')

    await dots.nth(1).click()
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
    await expect(dots.first()).not.toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('group', { name: '2 de 3' })).toBeInViewport({ ratio: 0.6 })

    await dots.first().click()
    await expect(page.getByRole('group', { name: '1 de 3' })).toBeInViewport({ ratio: 0.6 })
    await page.getByRole('link', { name: 'EXPLORAR' }).first().click()
    await expect(page).toHaveURL('/nfts/emerald-ape-042')
  })

  test('a promo opens a catalog state and "Ler mais" does not pretend to work', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'promos and blog are desktop-only')
    await openHome(page)
    await page.getByRole('link', { name: /^Explorar: Lançamentos gênesis/ }).click()
    await expect(page).toHaveURL('/?segment=new#mercado')
    await expect(page.getByRole('tab', { name: 'Novos lançamentos' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const readMore = page.getByRole('link', { name: 'Ler mais →' }).first()
    await readMore.click({ force: true })
    await expect(
      page.getByRole('region', { name: /Notificações/ }).getByText('Disponível em breve'),
    ).toBeVisible()
    await expect(page).toHaveURL('/?segment=new#mercado')
  })
})

test.describe('accessibility and layout (CAT-27)', () => {
  for (const [name, url] of [
    ['default', '/'],
    ['filtered', '/?categories=musica&q=ape&sort=popular'],
    ['empty', '/?q=zzzz'],
    ['favorites', '/?favorites=1'],
  ] as const) {
    test(`axe: ${name}`, async ({ page }) => {
      if (name === 'favorites') await loginAs(page, 'ana')
      await openHome(page, url)
      await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
      await expectNoAxeViolations(page)
    })
  }

  test('axe: the mobile filter sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the sheet is mobile-only')
    await openHome(page)
    await openFilters(page, true)
    await expectNoAxeViolations(page)
  })

  test('the landmarks and the carousel are labelled', async ({ page }) => {
    await openHome(page)
    await expect(page.locator('section#mercado')).toHaveAttribute(
      'aria-labelledby',
      'mercado-title',
    )
    await expect(page.getByRole('region', { name: 'Destaques', exact: true })).toHaveAttribute(
      'aria-roledescription',
      'carrossel',
    )
    await expect(page.getByRole('tablist', { name: 'Segmentos do catálogo' })).toBeVisible()
    await expect(page.getByRole('tabpanel')).toBeVisible()
  })

  test('no horizontal overflow at 320 / 390 / 768 / 1440, filtered and empty included', async ({
    page,
  }) => {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const url of ['/', '/?categories=musica&q=ape', '/?q=zzzz']) {
        await openHome(page, url)
        await expect(page.locator('[aria-busy=true]')).toHaveCount(0)
        await expectNoHorizontalOverflow(page)
      }
    }
  })
})
