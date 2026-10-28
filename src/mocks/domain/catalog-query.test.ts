import { describe, expect, it } from 'vitest'

import { NftListQuery, type NftListQueryInput } from '@/contracts'
import { eth } from '@/lib/money'
import { must } from '@/lib/test-utils'

import { seed } from '../db/seed'
import { fold, normalizeQuery, queryCatalog, relatedTo } from './catalog-query'

const nfts = Object.values(seed('default').nfts)

const run = (input: NftListQueryInput = {}, favorites: string[] | null = null) =>
  queryCatalog(nfts, NftListQuery.parse(input), favorites ? new Set(favorites) : null)

describe('fold', () => {
  it('lowers case and strips accents', () => {
    expect(fold('Música ÁRTE')).toBe('musica arte')
  })
})

describe('normalizeQuery', () => {
  it('trims, dedupes and drops empty lists', () => {
    const query = NftListQuery.parse({
      q: '  ape ',
      categories: ['musica', 'musica'],
      networks: [],
    })
    expect(normalizeQuery(query)).toEqual({
      q: 'ape',
      categories: ['musica'],
      segment: 'all',
      sort: 'recent',
      page: 1,
      pageSize: 9,
    })
  })

  it('drops a blank search', () => {
    expect(normalizeQuery(NftListQuery.parse({ q: '   ' }))).not.toHaveProperty('q')
  })
})

describe('queryCatalog', () => {
  it('paginates and reports totals', () => {
    const first = run()
    expect(first).toMatchObject({ page: 1, pageSize: 9, totalItems: 120, totalPages: 14 })
    expect(first.items).toHaveLength(9)
    const last = run({ page: 14 })
    expect(last.items).toHaveLength(120 - 13 * 9)
    expect(run({ page: 99 }).items).toEqual([])
  })

  it('searches accent-insensitively and requires every word', () => {
    const accented = { ...must(nfts[0]), id: 'acentuado-001', name: 'Sinfonia Étérea Música' }
    const found = queryCatalog([accented], NftListQuery.parse({ q: 'ETEREA musica' }), null)
    expect(found.items.map((i) => i.id)).toEqual(['acentuado-001'])
    const first = must(nfts[0])
    const both = run({ q: `${first.name} ${first.creator.username}` })
    expect(both.items.map((i) => i.id)).toContain(first.id)
    expect(run({ q: `${first.name} zzzzzz` }).totalItems).toBe(0)
  })

  it('ORs within a dimension and ANDs across dimensions', () => {
    const either = run({ categories: ['musica', 'arte-3d'] }).totalItems
    expect(either).toBe(33 + 19)
    const eth = run({ categories: ['musica', 'arte-3d'], networks: ['solana'] }).totalItems
    expect(eth).toBe(
      nfts.filter(
        (n) => (n.category === 'musica' || n.category === 'arte-3d') && n.network === 'solana',
      ).length,
    )
  })

  it('filters by an inclusive price range', () => {
    const bounded = run({ minPrice: '0.5', maxPrice: '1', pageSize: 48 })
    for (const item of bounded.items) {
      expect(eth.cmp(item.price, '0.5')).toBeGreaterThanOrEqual(0)
      expect(eth.cmp(item.price, '1')).toBeLessThanOrEqual(0)
    }
    expect(bounded.totalItems).toBe(
      nfts.filter((n) => eth.cmp(n.price, '0.5') >= 0 && eth.cmp(n.price, '1') <= 0).length,
    )
  })

  it.each(['price-asc', 'price-desc'] as const)('sorts by %s numerically, ties by id', (sort) => {
    const items = run({ sort, pageSize: 48 }).items
    const sign = sort === 'price-asc' ? 1 : -1
    for (let i = 1; i < items.length; i++) {
      const a = must(items[i - 1])
      const b = must(items[i])
      const order = sign * eth.cmp(a.price, b.price)
      expect(order <= 0, `${a.id} before ${b.id}`).toBe(true)
      if (order === 0) expect(a.id < b.id).toBe(true)
    }
  })

  it('keeps pages stable and disjoint', () => {
    const a = run({ page: 1 }).items.map((i) => i.id)
    const b = run({ page: 2 }).items.map((i) => i.id)
    expect(a.filter((id) => b.includes(id))).toEqual([])
    expect(run({ page: 1 }).items.map((i) => i.id)).toEqual(a)
  })

  it('applies the segments', () => {
    const trending = run({ segment: 'trending', pageSize: 48 })
    expect(trending.totalItems).toBeGreaterThan(0)
    expect(trending.totalItems).toBeLessThan(120)
    expect(run({ segment: 'new', pageSize: 48 }).totalItems).toBeLessThan(120)
  })

  it('filters favorites and yields none without a session', () => {
    const picked = [must(nfts[3]).id, must(nfts[7]).id]
    expect(
      run({ favorites: true }, picked)
        .items.map((i) => i.id)
        .sort(),
    ).toEqual([...picked].sort())
    expect(run({ favorites: true }, null).totalItems).toBe(0)
  })

  it('echoes the applied query', () => {
    expect(run({ q: ' ape ', sort: 'price-asc' }).applied).toMatchObject({
      q: 'ape',
      sort: 'price-asc',
    })
  })
})

describe('facets', () => {
  it('lists every option with counts that ignore their own dimension', () => {
    const result = run({ categories: ['musica'], networks: ['solana'] })
    expect(result.facets.categories).toHaveLength(9)
    expect(result.facets.networks.map((n) => n.id)).toEqual(['ethereum', 'polygon', 'solana'])
    const musicOnSolana = nfts.filter(
      (n) => n.category === 'musica' && n.network === 'solana',
    ).length
    expect(result.totalItems).toBe(musicOnSolana)
    const categoryCount = (id: string) => result.facets.categories.find((c) => c.id === id)?.count
    expect(categoryCount('musica')).toBe(musicOnSolana)
    expect(categoryCount('arte-3d')).toBe(
      nfts.filter((n) => n.category === 'arte-3d' && n.network === 'solana').length,
    )
    const networkCount = (id: string) => result.facets.networks.find((n) => n.id === id)?.count
    expect(networkCount('ethereum')).toBe(
      nfts.filter((n) => n.category === 'musica' && n.network === 'ethereum').length,
    )
  })

  it('reports price bounds over the other filters, and null when nothing matches', () => {
    const all = run().facets.price
    expect(all).toEqual({
      min: nfts.map((n) => n.price).reduce((a, b) => (eth.cmp(a, b) <= 0 ? a : b)),
      max: nfts.map((n) => n.price).reduce((a, b) => (eth.cmp(a, b) >= 0 ? a : b)),
    })
    const narrowed = run({ minPrice: '0.5', maxPrice: '0.6' })
    expect(narrowed.facets.price).toEqual(all)
    expect(run({ q: 'zzzzzzzz' }).facets.price).toBeNull()
  })
})

describe('relatedTo', () => {
  it('returns at most 5 others, same collection first, never the NFT itself', () => {
    for (const nft of nfts.slice(0, 20)) {
      const related = relatedTo(nft, nfts)
      expect(related.length).toBeLessThanOrEqual(5)
      expect(related.map((r) => r.id)).not.toContain(nft.id)
      const flags = related.map((r) => r.collection.id === nft.collection.id)
      expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)))
    }
  })
})
