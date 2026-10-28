import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { NftSummary } from '@/contracts'

import { applyEvent, cachedVersion } from './appliers'
import { nftEvent, orderEvent } from './event-kit'

const summary = (id: string, version: number, price = '1.19'): NftSummary =>
  ({
    id,
    name: id,
    price,
    previousPrice: '1.50',
    available: true,
    version,
  }) as unknown as NftSummary

const detail = (id: string, version: number) => ({
  ...summary(id, version),
  reviews: [],
  editions: [
    { id: 'limited-10', label: '1/10', supply: 10, available: 3, maxPerOrder: 3 },
    { id: 'open', label: 'ABERTA', supply: null, available: null, maxPerOrder: 10 },
  ],
})

function setup() {
  const queryClient = new QueryClient()
  const id = 'emerald-ape-042'
  queryClient.setQueryData(['nfts', 'detail', id], detail(id, 1))
  queryClient.setQueryData(['nfts', 'list', { page: 1 }], {
    items: [summary('sage-nomad-009', 1, '2.00'), summary(id, 1)],
    page: 1,
    totalItems: 2,
  })
  queryClient.setQueryData(['nfts', 'related', id], { items: [summary(id, 1)] })
  return { queryClient, id }
}

describe('applyEvent: nft.updated', () => {
  it('patches a detail, a list and a related list for the same NFT (RT-13)', () => {
    const { queryClient, id } = setup()
    applyEvent(queryClient, nftEvent(2, '1.29', { available: false, previousPrice: '1.19' }))

    const patched = queryClient.getQueryData<ReturnType<typeof detail>>(['nfts', 'detail', id])
    expect(patched).toMatchObject({
      price: '1.29',
      previousPrice: '1.19',
      available: false,
      version: 2,
    })
    expect(patched?.editions[0]).toMatchObject({ id: 'limited-10', available: 2, supply: 10 })
    expect(patched?.editions[1]?.available).toBeNull()
    expect(patched?.reviews).toEqual([])

    const list = queryClient.getQueryData<{ items: NftSummary[] }>(['nfts', 'list', { page: 1 }])
    expect(list?.items[1]).toMatchObject({ price: '1.29', version: 2 })
    const related = queryClient.getQueryData<{ items: NftSummary[] }>(['nfts', 'related', id])
    expect(related?.items[0]).toMatchObject({ price: '1.29', version: 2 })
  })

  it('removes previousPrice when the event has none', () => {
    const { queryClient, id } = setup()
    applyEvent(queryClient, nftEvent(2, '1.29'))
    expect(queryClient.getQueryData(['nfts', 'detail', id])).not.toHaveProperty('previousPrice')
  })

  it('never reverts a newer cached version', () => {
    const { queryClient, id } = setup()
    queryClient.setQueryData(['nfts', 'detail', id], detail(id, 5))
    const before = queryClient.getQueryData(['nfts', 'detail', id])
    applyEvent(queryClient, nftEvent(3, '0.50'))
    expect(queryClient.getQueryData(['nfts', 'detail', id])).toBe(before)
  })

  it('patches only the entries that are older', () => {
    const { queryClient, id } = setup()
    queryClient.setQueryData(['nfts', 'detail', id], detail(id, 4))
    applyEvent(queryClient, nftEvent(4, '1.40'))
    expect(queryClient.getQueryData(['nfts', 'detail', id])).toMatchObject({
      version: 4,
      price: '1.19',
    })
    const list = queryClient.getQueryData<{ items: NftSummary[] }>(['nfts', 'list', { page: 1 }])
    expect(list?.items[1]).toMatchObject({ version: 4, price: '1.40' })
  })

  it('keeps the reference of data that is not affected', () => {
    const { queryClient } = setup()
    const before = queryClient.getQueryData(['nfts', 'list', { page: 1 }])
    applyEvent(queryClient, nftEvent(2, '9.99', {}, 'someone-else-001'))
    expect(queryClient.getQueryData(['nfts', 'list', { page: 1 }])).toBe(before)
  })

  it('does not make an entry look freshly fetched', () => {
    const { queryClient, id } = setup()
    const key = ['nfts', 'detail', id]
    const before = queryClient.getQueryState(key)?.dataUpdatedAt
    applyEvent(queryClient, nftEvent(2, '1.29'))
    expect(queryClient.getQueryState(key)?.dataUpdatedAt).toBe(before)
  })

  it('marks lists stale without refetching them', () => {
    const { queryClient } = setup()
    applyEvent(queryClient, nftEvent(2, '1.29'))
    expect(queryClient.getQueryState(['nfts', 'list', { page: 1 }])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['nfts', 'detail', 'emerald-ape-042'])?.isInvalidated).toBe(
      false,
    )
  })
})

describe('applyEvent: order.updated', () => {
  const order = {
    id: 'ord_000002',
    status: 'pending',
    version: 1,
    transaction: null,
    total: '2.40',
  }

  it('patches the cached order and keeps its snapshot fields (RT-14)', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['orders', 'detail', 'ord_000002'], order)
    applyEvent(queryClient, orderEvent(2, 'confirmed'))
    expect(queryClient.getQueryData(['orders', 'detail', 'ord_000002'])).toMatchObject({
      status: 'confirmed',
      version: 2,
      total: '2.40',
      transaction: { hash: '0xabc' },
    })
  })

  it('ignores an older event for the cached order', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['orders', 'detail', 'ord_000002'], {
      ...order,
      version: 3,
      status: 'confirmed',
    })
    applyEvent(queryClient, orderEvent(2, 'declined'))
    expect(queryClient.getQueryData(['orders', 'detail', 'ord_000002'])).toMatchObject({
      status: 'confirmed',
      version: 3,
    })
  })

  it('marks order lists stale but not details', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['orders', 'detail', 'ord_000002'], order)
    queryClient.setQueryData(['orders', 'list', {}], { items: [{ id: 'ord_000002', version: 1 }] })
    applyEvent(queryClient, orderEvent(2, 'confirmed'))
    expect(queryClient.getQueryState(['orders', 'list', {}])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['orders', 'detail', 'ord_000002'])?.isInvalidated).toBe(false)
  })

  it('changes nothing for an order that is not in the cache', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['orders', 'list', {}], { items: [{ id: 'ord_000001', version: 2 }] })
    applyEvent(queryClient, orderEvent(2, 'confirmed', 'ord_000009'))
    expect(queryClient.getQueryData(['orders', 'detail', 'ord_000009'])).toBeUndefined()
    expect(queryClient.getQueryState(['orders', 'list', {}])?.isInvalidated).toBe(false)
  })
})

describe('cachedVersion', () => {
  it('is the highest version among details, lists and related lists', () => {
    const { queryClient, id } = setup()
    expect(cachedVersion(queryClient, { type: 'nft', id })).toBe(1)
    queryClient.setQueryData(['nfts', 'related', id], { items: [summary(id, 7)] })
    expect(cachedVersion(queryClient, { type: 'nft', id })).toBe(7)
  })

  it('is null for resources that are not cached', () => {
    const { queryClient } = setup()
    expect(cachedVersion(queryClient, { type: 'nft', id: 'nobody-000' })).toBeNull()
    expect(cachedVersion(queryClient, { type: 'order', id: 'ord_000002' })).toBeNull()
  })

  it('reads the order from its detail key', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['orders', 'detail', 'ord_000002'], { id: 'ord_000002', version: 4 })
    expect(cachedVersion(queryClient, { type: 'order', id: 'ord_000002' })).toBe(4)
  })
})
