import { queryOptions } from '@tanstack/react-query'

import { cartApi } from '@/api'
import type { Cart, NetworkId } from '@/contracts'

import { clearGuestCartId, getGuestCartId } from '../model/guest-cart-id'
import { cartKeys, ownerKey, type CartOwner } from './cart-keys'

/** The cart is always quoted for Ethereum; the payment network is chosen at checkout (spec 09). */
export const QUOTE_NETWORK: NetworkId = 'ethereum'

/**
 * The owner's cart. Guests without a cart get `{ id: null, items: [] }` from the API (CART-02: the
 * stored id then points at nothing, so it is dropped). A response older than what is cached (a read
 * that was in flight while a mutation answered) is discarded in favor of the cached cart (CART-08).
 */
export const cartQueryOptions = (owner: CartOwner) =>
  queryOptions({
    queryKey: cartKeys.detail(owner),
    queryFn: async ({ signal, client }): Promise<Cart> => {
      const cart = await cartApi.get({ signal })
      if (owner.kind === 'guest' && cart.id === null && getGuestCartId() !== null) {
        clearGuestCartId()
      }
      const cached = client.getQueryData<Cart>(cartKeys.detail(owner))
      return cached && cart.version < cached.version ? cached : cart
    },
    staleTime: 30_000,
  })

/**
 * The summary's amounts (CART-15, CART-16). Keyed by cart version; the previous amounts stay on
 * screen, marked as outdated, while the next version's quote loads. Checkout (spec 09) asks for the
 * payment network the user chose; the cart screen keeps Ethereum.
 */
export const quoteQueryOptions = (
  owner: CartOwner,
  version: number,
  network: NetworkId = QUOTE_NETWORK,
) =>
  queryOptions({
    queryKey: cartKeys.quote(owner, network, version),
    queryFn: ({ signal }) => cartApi.quote(network, { signal }),
    // Never another owner's amounts: the page stays mounted across a sign-out or a user switch.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === ownerKey(owner) ? previous : undefined,
  })
