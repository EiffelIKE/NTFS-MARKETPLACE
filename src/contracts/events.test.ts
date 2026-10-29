import { describe, expect, expectTypeOf, it } from 'vitest'

import { RealtimeEvent, eventId, resourceKey, type EventOf } from './events'

const nft = {
  id: 'evt_nft.updated_emerald-ape-042_4',
  type: 'nft.updated',
  resource: { type: 'nft', id: 'emerald-ape-042' },
  version: 4,
  occurredAt: '2026-10-28T12:00:00.000Z',
  data: {
    price: '1.29',
    previousPrice: '1.20',
    available: true,
    editions: [{ id: 'open', available: null }],
  },
}

const order = {
  id: 'evt_order.updated_ord_000002_2',
  type: 'order.updated',
  resource: { type: 'order', id: 'ord_000002' },
  version: 2,
  occurredAt: '2026-10-28T12:00:00.000Z',
  data: {
    status: 'confirmed',
    transaction: { hash: '0xabc', explorerUrl: 'https://x.example/tx/0xabc', explorerName: 'X' },
    declineReason: null,
    settledAt: '2026-10-28T12:00:00.000Z',
    updatedAt: '2026-10-28T12:00:00.000Z',
  },
}

describe('RealtimeEvent', () => {
  it('parses both event types', () => {
    expect(RealtimeEvent.parse(nft).type).toBe('nft.updated')
    expect(RealtimeEvent.parse(order).type).toBe('order.updated')
  })

  it('accepts a missing previousPrice (the NFT has none)', () => {
    const data = { price: '1.29', available: true, editions: [] }
    expect(RealtimeEvent.safeParse({ ...nft, data }).success).toBe(true)
  })

  it('rejects a numeric price: ETH amounts are decimal strings', () => {
    expect(RealtimeEvent.safeParse({ ...nft, data: { ...nft.data, price: 1.29 } }).success).toBe(
      false,
    )
  })

  it('rejects an unknown type, a bad id and a resource of the wrong kind', () => {
    expect(RealtimeEvent.safeParse({ ...nft, type: 'nft.deleted' }).success).toBe(false)
    expect(RealtimeEvent.safeParse({ ...nft, id: 'not-an-event-id' }).success).toBe(false)
    expect(
      RealtimeEvent.safeParse({ ...nft, resource: { type: 'order', id: 'ord_000001' } }).success,
    ).toBe(false)
  })

  it('rejects a version below 1 and a fractional version', () => {
    expect(RealtimeEvent.safeParse({ ...nft, version: 0 }).success).toBe(false)
    expect(RealtimeEvent.safeParse({ ...nft, version: 1.5 }).success).toBe(false)
  })

  it('rejects a negative edition count', () => {
    const data = { ...nft.data, editions: [{ id: 'limited-10', available: -1 }] }
    expect(RealtimeEvent.safeParse({ ...nft, data }).success).toBe(false)
  })

  it('narrows data by type', () => {
    expectTypeOf<EventOf<'nft.updated'>['data']['price']>().toEqualTypeOf<string>()
    expectTypeOf<EventOf<'order.updated'>['data']['status']>().toEqualTypeOf<
      'pending' | 'confirmed' | 'declined'
    >()
  })
})

describe('eventId', () => {
  it('is derived from type, resource and version, and matches the schema', () => {
    expect(eventId('nft.updated', 'emerald-ape-042', 4)).toBe(nft.id)
    expect(eventId('order.updated', 'ord_000002', 2)).toBe(order.id)
    expect(
      RealtimeEvent.safeParse({ ...order, id: eventId('order.updated', 'ord_000002', 2) }).success,
    ).toBe(true)
  })

  it('differs by version, so a new change has a new id', () => {
    expect(eventId('nft.updated', 'a-b-c', 1)).not.toBe(eventId('nft.updated', 'a-b-c', 2))
  })
})

describe('resourceKey', () => {
  it('separates NFTs from orders that share an id shape', () => {
    expect(resourceKey({ type: 'nft', id: 'x-y-z' })).toBe('nft:x-y-z')
    expect(resourceKey({ type: 'order', id: 'ord_1' })).toBe('order:ord_1')
  })
})
