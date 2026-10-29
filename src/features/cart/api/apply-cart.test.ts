import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { Cart } from '@/contracts'

import { applyCart } from './apply-cart'
import { cartKeys } from './cart-keys'

const owner = { kind: 'user', userId: 'usr_ana' } as const
const cart = (version: number, itemCount = version): Cart => ({
  id: 'cart_usr_ana',
  items: [],
  coupon: null,
  itemCount,
  version,
  updatedAt: '2026-10-28T12:00:00.000Z',
})

describe('applyCart (CART-08)', () => {
  it('writes the first cart, and a newer or equal one', () => {
    const client = new QueryClient()
    expect(applyCart(client, owner, cart(1))).toBe(true)
    expect(applyCart(client, owner, cart(2))).toBe(true)
    expect(applyCart(client, owner, cart(2, 5))).toBe(true)
    expect(client.getQueryData<Cart>(cartKeys.detail(owner))?.itemCount).toBe(5)
  })

  it('drops an older cart, so a slow response never undoes a newer one', () => {
    const client = new QueryClient()
    applyCart(client, owner, cart(3))
    expect(applyCart(client, owner, cart(2))).toBe(false)
    expect(client.getQueryData<Cart>(cartKeys.detail(owner))?.version).toBe(3)
  })

  it('keeps each owner in its own entry', () => {
    const client = new QueryClient()
    applyCart(client, owner, cart(3))
    applyCart(client, { kind: 'guest' }, cart(1))
    expect(client.getQueryData<Cart>(cartKeys.detail({ kind: 'guest' }))?.version).toBe(1)
    expect(client.getQueryData<Cart>(cartKeys.detail(owner))?.version).toBe(3)
  })
})
