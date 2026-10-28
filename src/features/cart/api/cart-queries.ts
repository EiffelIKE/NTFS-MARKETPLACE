import { queryOptions } from '@tanstack/react-query'

import { cartApi } from '@/api'

import { cartKeys, type CartOwner } from './cart-keys'

/** The owner's cart. Guests without a cart get `{ id: null, items: [] }` from the API. */
export const cartQueryOptions = (owner: CartOwner) =>
  queryOptions({
    queryKey: cartKeys.detail(owner),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    staleTime: 30_000,
  })
