import { describe, expect, it } from 'vitest'

import { nftEvent, orderEvent } from './event-kit'
import { SEEN_LIMIT, createGuard } from './guard'

describe('createGuard', () => {
  it('accepts a first event and a newer one', () => {
    const guard = createGuard()
    expect(guard.admit(nftEvent(2, '1.20'), null)).toBe('accepted')
    expect(guard.admit(nftEvent(3, '1.30'), null)).toBe('accepted')
  })

  it('drops a redelivery by id, before looking at versions (RT-11)', () => {
    const guard = createGuard()
    const event = nftEvent(2, '1.20')
    guard.admit(event, null)
    expect(guard.admit(event, null)).toBe('duplicate')
  })

  it('drops an event not newer than the last one applied for that resource (RT-12)', () => {
    const guard = createGuard()
    guard.admit(nftEvent(5, '1.50'), null)
    expect(guard.admit(nftEvent(4, '1.40'), null)).toBe('stale')
    // Same version with another id would also be stale.
    expect(
      guard.admit({ ...nftEvent(5, '1.49'), id: 'evt_nft.updated_emerald-ape-042_5b' }, null),
    ).toBe('stale')
  })

  it('tracks versions per resource, and NFTs apart from orders', () => {
    const guard = createGuard()
    guard.admit(nftEvent(5, '1.50'), null)
    expect(guard.admit(nftEvent(1, '2.00', {}, 'sage-nomad-009'), null)).toBe('accepted')
    expect(guard.admit(orderEvent(1, 'pending', 'emerald-ape-042'), null)).toBe('accepted')
  })

  it('reports `known` when the cache already holds that version or a newer one', () => {
    const guard = createGuard()
    expect(guard.admit(nftEvent(4, '1.40'), 5)).toBe('known')
    expect(guard.admit(nftEvent(5, '1.50'), 5)).toBe('known')
    expect(guard.admit(nftEvent(6, '1.60'), 5)).toBe('accepted')
  })

  it('still remembers a `known` event, so its redelivery is a duplicate', () => {
    const guard = createGuard()
    const event = nftEvent(4, '1.40')
    guard.admit(event, 5)
    expect(guard.admit(event, 5)).toBe('duplicate')
  })

  it('forgets everything on reset', () => {
    const guard = createGuard()
    const event = nftEvent(5, '1.50')
    guard.admit(event, null)
    guard.reset()
    expect(guard.admit(event, null)).toBe('accepted')
    expect(guard.admit(nftEvent(2, '1.20'), null)).toBe('stale')
  })

  it('evicts the oldest id past the limit but keeps the version floor', () => {
    const guard = createGuard(3)
    const first = nftEvent(1, '1.10')
    for (let v = 1; v <= 4; v += 1) guard.admit(nftEvent(v, `1.${String(v)}0`), null)
    // v1's id was evicted, yet v1 is still not newer than v4.
    expect(guard.admit(first, null)).toBe('stale')
    expect(SEEN_LIMIT).toBe(1000)
  })
})
