import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as React from 'react'

import type { Cart, CreateOrderBody, Order } from '@/contracts'
import { cartKeys, type CartOwner } from '@/features/cart/api/cart-keys'
import { useCartOwner } from '@/features/cart/model/use-cart'
import { session } from '@/features/auth/model/instance'
import { useAccountUserId } from '@/features/account/model/use-account'
import { orderKeys } from '@/features/orders/api/order-queries'

import { attemptStore, prepareAttempt } from '../model/attempt-store'
import { draftStore } from '../model/draft-store'
import { placeOrder, type PlaceOutcome } from './place-order'

/** An order exists: follow it from the cache, forget the draft, refresh the pending gate. */
export function recordOrder(queryClient: QueryClient, userId: string, order: Order) {
  queryClient.setQueryData(orderKeys.detail(order.id), order)
  draftStore.clear(userId)
  void queryClient.invalidateQueries({ queryKey: orderKeys.pending() })
}

/**
 * What the cache should hold after an outcome that carries data (spec 09 design §6): the API's
 * quote replaces the reviewed one, and an availability refusal makes the cart look again.
 */
export function applyOutcome(
  queryClient: QueryClient,
  owner: CartOwner,
  userId: string,
  outcome: PlaceOutcome,
) {
  switch (outcome.kind) {
    case 'created':
      recordOrder(queryClient, userId, outcome.order)
      return
    case 'tracking':
      void queryClient.invalidateQueries({ queryKey: orderKeys.pending() })
      return
    case 'quote-changed': {
      const cart = queryClient.getQueryData<Cart>(cartKeys.detail(owner))
      if (cart) {
        queryClient.setQueryData(
          cartKeys.quote(owner, outcome.quote.network, cart.version),
          outcome.quote,
        )
      }
      void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
      return
    }
    case 'unavailable':
      void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
      return
    default:
      return
  }
}

/**
 * `orders.create` for the review's "Confirmar pagamento" (CHK-23 – CHK-28). `submit` answers with
 * the outcome and never throws. A second call while one is in flight is refused in the same tick,
 * before React has re-rendered the disabled button, so repeated clicks send one request (CHK-24).
 * The attempt (key and body) is stored before the request, and the same body reuses its key.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const userId = useAccountUserId()
  const inFlight = React.useRef(false)

  const mutation = useMutation({
    mutationKey: ['orders', 'create'],
    mutationFn: async (body: CreateOrderBody): Promise<PlaceOutcome> => {
      if (userId === undefined) return { kind: 'session' }
      const attempt = prepareAttempt(attemptStore.read(userId), userId, body)
      return placeOrder(attempt)
    },
    onMutate: () => ({ epoch: session.epoch() }),
    onSuccess: (outcome, _body, context) => {
      // A result for a user who has signed out belongs to nobody (spec 04 epoch guard).
      if (userId === undefined || !session.isCurrent(context.epoch)) return
      applyOutcome(queryClient, owner, userId, outcome)
    },
  })

  const submit = async (body: CreateOrderBody): Promise<PlaceOutcome | { kind: 'busy' }> => {
    if (inFlight.current) return { kind: 'busy' }
    inFlight.current = true
    try {
      return await mutation.mutateAsync(body)
    } finally {
      inFlight.current = false
    }
  }

  return { submit, isPending: mutation.isPending }
}
