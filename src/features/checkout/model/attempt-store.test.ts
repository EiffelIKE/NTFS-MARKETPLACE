import { describe, expect, it } from 'vitest'

import type { CreateOrderBody } from '@/contracts'
import { collectorFor } from '@/api/order-kit'
import { ANA_PRIMARY_ADDRESS } from '@/mocks/fixtures/users'

import {
  attemptKey,
  canonicalJson,
  createAttemptStore,
  prepareAttempt,
  type CheckoutAttempt,
} from './attempt-store'
import { memoryStorage } from './safe-storage'

const body: CreateOrderBody = {
  quoteId: 'quo_1',
  walletId: 'wal_000001',
  provider: 'metamask',
  network: 'ethereum',
  collector: collectorFor(ANA_PRIMARY_ADDRESS),
}

let n = 0
const deps = { newKey: () => `key-${String(++n).padStart(4, '0')}`, now: () => 1_000 }

describe('canonicalJson', () => {
  it('ignores key order and undefined values', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: undefined } })).toBe(
      canonicalJson({ a: { d: 2 }, b: 1 }),
    )
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }))
  })
})

describe('prepareAttempt (CHK-23)', () => {
  it('starts with a new key and no order', () => {
    const attempt = prepareAttempt(null, 'usr_ana', body, deps)
    expect(attempt).toMatchObject({
      userId: 'usr_ana',
      orderId: null,
      phase: 'sent',
      createdAt: 1_000,
    })
    expect(attempt.key).toMatch(/^key-/)
  })

  it('reuses the key for the same content, whatever the key order', () => {
    const first = prepareAttempt(null, 'usr_ana', body, deps)
    const shuffled = JSON.parse(JSON.stringify(body)) as CreateOrderBody
    const again = prepareAttempt(
      first,
      'usr_ana',
      { ...shuffled, collector: { ...shuffled.collector } },
      deps,
    )
    expect(again.key).toBe(first.key)
  })

  it('uses a new key whenever the body changes', () => {
    const first = prepareAttempt(null, 'usr_ana', body, deps)
    const other = prepareAttempt(first, 'usr_ana', { ...body, quoteId: 'quo_2' }, deps)
    expect(other.key).not.toBe(first.key)
    expect(other.orderId).toBeNull()
  })

  it('keeps an attempt that already knows its order, even for another body', () => {
    const known: CheckoutAttempt = {
      ...prepareAttempt(null, 'usr_ana', body, deps),
      orderId: 'ord_9',
    }
    expect(prepareAttempt(known, 'usr_ana', { ...body, quoteId: 'quo_2' }, deps)).toBe(known)
  })

  it("never reuses another user's attempt", () => {
    const first = prepareAttempt(null, 'usr_ana', body, deps)
    expect(prepareAttempt(first, 'usr_bruno', body, deps).key).not.toBe(first.key)
  })
})

describe('attempt store (CHK-26)', () => {
  it('round-trips an attempt per user', () => {
    const store = createAttemptStore(memoryStorage())
    const attempt = prepareAttempt(null, 'usr_ana', body, deps)
    store.write(attempt)
    expect(store.read('usr_ana')).toEqual(attempt)
    expect(store.read('usr_bruno')).toBeNull()
    store.clear('usr_ana')
    expect(store.read('usr_ana')).toBeNull()
  })

  it('drops an entry that does not parse', () => {
    const area = memoryStorage()
    area.set(attemptKey('usr_ana'), '{not json')
    const store = createAttemptStore(area)
    expect(store.read('usr_ana')).toBeNull()
    expect(area.get(attemptKey('usr_ana'))).toBeNull()
  })

  it("does not read an attempt stored under another user's key", () => {
    const area = memoryStorage()
    const store = createAttemptStore(area)
    store.write(prepareAttempt(null, 'usr_bruno', body, deps))
    area.set(attemptKey('usr_ana'), area.get(attemptKey('usr_bruno')) ?? '')
    expect(store.read('usr_ana')).toBeNull()
  })
})
