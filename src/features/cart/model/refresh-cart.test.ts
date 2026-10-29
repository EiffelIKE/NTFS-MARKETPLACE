import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { Cart } from '@/contracts'

import { cartKeys } from '../api/cart-keys'
import { refreshCartForNft } from './refresh-cart'

const ana = { kind: 'user', userId: 'usr_ana' } as const
const cart = {
  id: 'cart_1',
  version: 3,
  items: [{ nftId: 'golden-beat-207' }],
} as unknown as Cart

function setup() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(cartKeys.detail(ana), cart)
  queryClient.setQueryData(cartKeys.quote(ana, 'ethereum', 3), { total: '1' })
  return queryClient
}

describe('refreshCartForNft (R1, CART-19)', () => {
  it('marks the cart and its quote stale when the cart holds the NFT, though nobody watches it', () => {
    const queryClient = setup()
    expect(refreshCartForNft(queryClient, ana, 'golden-beat-207')).toBe(true)
    expect(queryClient.getQueryState(cartKeys.detail(ana))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(cartKeys.quote(ana, 'ethereum', 3))?.isInvalidated).toBe(true)
  })

  it('leaves the cart alone for an NFT it does not hold, or when nothing is cached', () => {
    const queryClient = setup()
    expect(refreshCartForNft(queryClient, ana, 'emerald-ape-042')).toBe(false)
    expect(queryClient.getQueryState(cartKeys.detail(ana))?.isInvalidated).toBe(false)
    expect(refreshCartForNft(new QueryClient(), ana, 'golden-beat-207')).toBe(false)
  })

  it("never touches another owner's cart", () => {
    const queryClient = setup()
    expect(refreshCartForNft(queryClient, { kind: 'guest' }, 'golden-beat-207')).toBe(false)
    expect(queryClient.getQueryState(cartKeys.detail(ana))?.isInvalidated).toBe(false)
  })
})
