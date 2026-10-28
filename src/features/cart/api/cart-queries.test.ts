import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { as, serveMockApi } from '@/api/contract-kit'
import type { Cart } from '@/contracts'

import { clearGuestCartId, getGuestCartId, setGuestCartId } from '../model/guest-cart-id'
import { cartKeys } from './cart-keys'
import { cartQueryOptions, quoteQueryOptions } from './cart-queries'

serveMockApi()
const guest = { kind: 'guest' } as const

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
})
afterEach(() => {
  clearGuestCartId()
  vi.unstubAllGlobals()
})

describe('cartQueryOptions (CART-02, CART-08)', () => {
  it('drops a stored guest cart id the server no longer knows and shows an empty cart', async () => {
    setGuestCartId('g_9999')
    as(undefined, 'g_9999')
    const cart = await new QueryClient().query(cartQueryOptions(guest))
    expect(cart.id).toBeNull()
    expect(cart.items).toEqual([])
    expect(getGuestCartId()).toBeNull()
  })

  it('keeps the cached cart when a read answers with an older version', async () => {
    as(undefined)
    const client = new QueryClient()
    const newer: Cart = {
      id: null,
      items: [],
      coupon: null,
      itemCount: 0,
      version: 7,
      updatedAt: '2026-10-28T12:00:00.000Z',
    }
    client.setQueryData(cartKeys.detail(guest), newer)
    const cart = await client.query({ ...cartQueryOptions(guest), staleTime: 0 })
    expect(cart.version).toBe(7)
  })
})

describe('quote keys (CART-16)', () => {
  it('a new cart version opens a new quote entry under the cart key', () => {
    const one = quoteQueryOptions(guest, 1).queryKey
    const two = quoteQueryOptions(guest, 2).queryKey
    expect(one).not.toEqual(two)
    expect(one.slice(0, 2)).toEqual(cartKeys.detail(guest))
  })

  it('never carries another owner’s amounts as placeholder data', () => {
    const { placeholderData } = quoteQueryOptions({ kind: 'user', userId: 'usr_bruno' }, 1)
    if (typeof placeholderData !== 'function') throw new Error('expected a function')
    const previous = { id: 'q' } as never
    const fromAna = {
      queryKey: cartKeys.quote({ kind: 'user', userId: 'usr_ana' }, 'ethereum', 1),
    } as never
    const fromBruno = {
      queryKey: cartKeys.quote({ kind: 'user', userId: 'usr_bruno' }, 'ethereum', 1),
    } as never
    expect(placeholderData(previous, fromAna)).toBeUndefined()
    expect(placeholderData(previous, fromBruno)).toBe(previous)
  })
})
