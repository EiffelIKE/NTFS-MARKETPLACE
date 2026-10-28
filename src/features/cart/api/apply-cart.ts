import type { QueryClient } from '@tanstack/react-query'

import type { Cart } from '@/contracts'

import { cartKeys, type CartOwner } from './cart-keys'

/**
 * Writes a cart the server returned into the owner's entry (spec 07 design §3, CART-08). A cart
 * older than the cached one is dropped, so a slow response never undoes a newer one. Returns
 * whether it was written. Mutations never invalidate the cart: they write what the API answers.
 */
export function applyCart(queryClient: QueryClient, owner: CartOwner, next: Cart): boolean {
  const key = cartKeys.detail(owner)
  const cached = queryClient.getQueryData<Cart>(key)
  if (cached && next.version < cached.version) return false
  queryClient.setQueryData(key, next)
  return true
}
