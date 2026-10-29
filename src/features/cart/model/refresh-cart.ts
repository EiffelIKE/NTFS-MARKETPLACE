import type { QueryClient } from '@tanstack/react-query'

import type { Cart } from '@/contracts'

import { cartKeys, type CartOwner } from '../api/cart-keys'

/**
 * Marks the owner's cart (and, through the key prefix, its quote) stale when it holds a line of
 * `nftId` (spec 07 design §7, CART-19; brief §7: a change during navigation reaches the summary).
 * The cart is server-owned, so it is refreshed, never patched. An active observer (the header
 * badge, the cart page) refetches at once; with nobody watching, the next mount does, because an
 * invalidated entry is stale whatever its `staleTime`. Returns whether a cart was affected.
 */
export function refreshCartForNft(
  queryClient: QueryClient,
  owner: CartOwner,
  nftId: string,
): boolean {
  const cached = queryClient.getQueryData<Cart>(cartKeys.detail(owner))
  if (!cached?.items.some((item) => item.nftId === nftId)) return false
  void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
  return true
}
