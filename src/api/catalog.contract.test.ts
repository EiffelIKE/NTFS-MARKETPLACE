import { describe, expect, it } from 'vitest'

import { catalogApi, favoritesApi, networksApi } from '@/api'
import { OPERATIONS } from '@/contracts'
import { eth } from '@/lib/money'

import { actAs, as, lastRequest, rejection, serveMockApi } from './contract-kit'

const mock = serveMockApi()

describe('nfts.list', () => {
  it('returns the first Figma page by default, with totals, applied parameters and facets', async () => {
    const page = await catalogApi.list()
    expect(page).toMatchObject({ page: 1, pageSize: 9, totalItems: 120, totalPages: 14 })
    expect(page.items.map((item) => item.id).slice(0, 3)).toEqual([
      'emerald-ape-042',
      'sage-nomad-009',
      'neon-vessel-552',
    ])
    expect(page.applied).toEqual({ segment: 'all', sort: 'recent', page: 1, pageSize: 9 })
    expect(page.facets.categories.find((c) => c.id === 'musica')?.count).toBe(33)
    expect(page.facets.networks.map((n) => n.count)).toEqual([50, 33, 37])
    expect(page.facets.price).toEqual({ min: '0.02', max: '12.3' })
    expect(page.items[0]?.image.srcSet).toHaveLength(3)
  })

  it('sends arrays comma-joined and combines filters (AND across, OR within)', async () => {
    const page = await catalogApi.list({
      categories: ['musica', 'arte-3d'],
      networks: ['solana'],
      minPrice: '0.5',
      maxPrice: '2',
      sort: 'price-asc',
      pageSize: 48,
    })
    expect(lastRequest(mock, 'nfts.list')?.url).toContain('categories=musica,arte-3d')
    expect(page.items.length).toBeGreaterThan(0)
    for (const item of page.items) {
      expect(['musica', 'arte-3d']).toContain(item.category)
      expect(item.network).toBe('solana')
      expect(eth.cmp(item.price, '0.5')).toBeGreaterThanOrEqual(0)
      expect(eth.cmp(item.price, '2')).toBeLessThanOrEqual(0)
    }
    const prices = page.items.map((item) => item.price)
    expect(prices).toEqual([...prices].sort((a, b) => eth.cmp(a, b)))
    expect(page.applied.categories).toEqual(['musica', 'arte-3d'])
  })

  it('searches ignoring case and accents', async () => {
    const accented = await catalogApi.list({ q: 'OCULOS' })
    expect(accented.items.map((i) => i.id)).toContain('emerald-ape-042')
    const byName = await catalogApi.list({ q: 'emerald' })
    expect(byName.items.map((i) => i.id)).toContain('emerald-ape-042')
    const byCreator = await catalogApi.list({ q: 'NOVA sato' })
    expect(byCreator.items.length).toBeGreaterThan(0)
    const byAttribute = await catalogApi.list({ q: 'esmeralda' })
    expect(byAttribute.items.map((i) => i.id)).toContain('emerald-ape-042')
  })

  it('filters by segment', async () => {
    expect((await catalogApi.list({ segment: 'new' })).totalItems).toBe(30)
    expect((await catalogApi.list({ segment: 'trending' })).totalItems).toBe(24)
  })

  it('returns no items with the real totals for a page past the last', async () => {
    const page = await catalogApi.list({ page: 99 })
    expect(page).toMatchObject({ items: [], page: 99, totalItems: 120, totalPages: 14 })
  })

  it('answers 422 for invalid parameters', async () => {
    const error = await rejection(() => catalogApi.list({ minPrice: '5', maxPrice: '1' }))
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' })
    expect(error.fields).toHaveProperty('minPrice')
    const wire = await rejection(() => catalogApi.list({ pageSize: 500 }))
    expect(wire.status).toBe(422)
  })

  it('requires a session for favorites-only', async () => {
    expect(await rejection(() => catalogApi.list({ favorites: true }))).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    })
    await actAs('ana')
    const page = await catalogApi.list({ favorites: true })
    expect(page.totalItems).toBe(5)
    expect(page.items.map((i) => i.id)).toContain('emerald-ape-042')
    await actAs('bruno')
    expect((await catalogApi.list({ favorites: true })).totalItems).toBe(0)
  })

  it('is empty in the empty scenario', async () => {
    mock.runtime.useScenario('empty')
    const page = await catalogApi.list()
    expect(page).toMatchObject({ items: [], totalItems: 0, totalPages: 0 })
    expect(page.facets.price).toBeNull()
  })
})

describe('nfts.get, nfts.related and highlights', () => {
  it('returns the Emerald Ape detail', async () => {
    const detail = await catalogApi.get('emerald-ape-042')
    expect(detail).toMatchObject({ name: 'Emerald Ape #042', price: '1.19', version: 1 })
    expect(detail.editions).toHaveLength(4)
    expect(detail.images.length).toBeGreaterThanOrEqual(1)
  })

  it('answers 404 for an unknown id', async () => {
    expect(await rejection(() => catalogApi.get('no-such-nft'))).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      details: { resource: 'nft' },
    })
    expect(await rejection(() => catalogApi.related('no-such-nft'))).toMatchObject({ status: 404 })
  })

  it('returns the five Figma items for the anchor', async () => {
    const { items } = await catalogApi.related('emerald-ape-042')
    expect(items.map((i) => i.name)).toEqual([
      'Cosmic Bloom #118',
      'Violet Nomad #314',
      'Ivory Baron #088',
      'Golden Beat #207',
      'Golden Signal #160',
    ])
    expect(items.map((i) => i.price)).toEqual(['1.29', '1.39', '1.79', '0.99', '0.39'])
  })

  it('returns the hero copy and the featured banner', async () => {
    const highlights = await catalogApi.highlights()
    expect(highlights.hero).toHaveLength(3)
    expect(highlights.hero[0]).toMatchObject({
      eyebrow: 'Bem-vindo à Kurio',
      title: 'SEJA DONO DO FUTURO DA ARTE DIGITAL',
    })
    expect(highlights.featured).toMatchObject({ title: 'NFT EM DESTAQUE' })
  })

  it('serves a version that follows price and availability changes', async () => {
    mock.control.updateNft('emerald-ape-042', { price: '1.25' })
    mock.control.updateNft('emerald-ape-042', { available: { editionId: 'limited-10', value: 0 } })
    const detail = await catalogApi.get('emerald-ape-042')
    expect(detail).toMatchObject({ price: '1.25', version: 3 })
    expect(detail.editions.find((e) => e.id === 'limited-10')?.available).toBe(0)
    expect((await catalogApi.list()).items[0]).toMatchObject({ price: '1.25', version: 3 })
  })
})

describe('favorites', () => {
  it('lists the favorites of the session user only', async () => {
    await actAs('ana')
    expect((await favoritesApi.list()).nftIds).toContain('emerald-ape-042')
    await actAs('carla')
    expect((await favoritesApi.list()).nftIds).toEqual(['cosmic-bloom-118', 'crown-relic-999'])
    await actAs('bruno')
    expect((await favoritesApi.list()).nftIds).toEqual([])
  })

  it('adds and removes idempotently', async () => {
    await actAs('bruno')
    await favoritesApi.add('penny-pixel-001')
    await favoritesApi.add('penny-pixel-001')
    expect((await favoritesApi.list()).nftIds).toEqual(['penny-pixel-001'])
    await favoritesApi.remove('penny-pixel-001')
    await favoritesApi.remove('penny-pixel-001')
    expect((await favoritesApi.list()).nftIds).toEqual([])
    // Another user is untouched.
    await actAs('ana')
    expect((await favoritesApi.list()).nftIds).toContain('penny-pixel-001')
  })

  it('answers 404 for an unknown NFT and 401 without a session', async () => {
    await actAs('ana')
    expect(await rejection(() => favoritesApi.add('no-such-nft'))).toMatchObject({ status: 404 })
    as()
    for (const call of [
      () => favoritesApi.list(),
      () => favoritesApi.add('emerald-ape-042'),
      () => favoritesApi.remove('emerald-ape-042'),
    ]) {
      expect(await rejection(call)).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    }
  })
})

describe('networks.list', () => {
  it('returns the three payment networks with their fixed fees', async () => {
    const { items } = await networksApi.list()
    expect(items.map((n) => [n.id, n.fee, n.walletFamily])).toEqual([
      ['ethereum', '0.016', 'evm'],
      ['polygon', '0.002', 'evm'],
      ['solana', '0.001', 'solana'],
    ])
    expect(items[0]?.explorerTxUrl).toMatch(/\/tx\/$/)
  })
})

describe('contract table', () => {
  it('matches the method and path the endpoint functions send', async () => {
    await catalogApi.get('emerald-ape-042')
    await catalogApi.highlights()
    await networksApi.list()
    for (const op of ['nfts.get', 'highlights.get', 'networks.list'] as const) {
      const entry = lastRequest(mock, op)
      expect(entry?.method).toBe(OPERATIONS[op].method)
    }
    expect(lastRequest(mock, 'nfts.get')?.url).toBe('/api/nfts/emerald-ape-042')
  })

  it('answers a path outside the contract with a 404 envelope', async () => {
    const response = await fetch('http://api.test/api/does-not-exist')
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })
})
