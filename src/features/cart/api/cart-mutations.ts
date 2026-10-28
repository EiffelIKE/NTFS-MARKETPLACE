import {
  useMutation,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query'

import { cartApi } from '@/api'
import type { AddCartItemBody, Cart } from '@/contracts'
import { session as appSession } from '@/features/auth/model/instance'
import type { SessionController } from '@/features/auth/model/session'
import type { ApiError } from '@/lib/http/errors'

import { getGuestCartId, setGuestCartId } from '../model/guest-cart-id'
import { applyCart } from './apply-cart'
import { cartKeys, type CartOwner } from './cart-keys'

type Guard = Pick<SessionController, 'epoch' | 'isCurrent' | 'owner'>

interface AddContext {
  epoch: number
  owner: CartOwner
}

/**
 * `cart.addItem` (DET-15 – DET-19). The cart cache changes only on success, from the response:
 * a failure leaves the cart and the header count as they were. A result that arrives after the
 * session changed (sign-out, user switch) belongs to nobody and is dropped (spec 04 epoch guard).
 * An options factory, so the logic runs under a plain `MutationObserver` in tests.
 */
export function addCartItemOptions(
  queryClient: QueryClient,
  session: Guard = appSession,
): MutationOptions<Cart, ApiError, AddCartItemBody, AddContext> {
  return {
    mutationKey: ['cart', 'add'],
    mutationFn: (body) => cartApi.addItem(body),
    onMutate: () => ({ epoch: session.epoch(), owner: session.owner() }),
    onSuccess: async (cart, _body, context) => {
      if (!session.isCurrent(context.epoch)) return
      // A cart read that started before this write must not land on top of it.
      await queryClient.cancelQueries({ queryKey: cartKeys.detail(context.owner) })
      applyCart(queryClient, context.owner, cart)
      // A guest's add may create the cart (or replace one a reset made unknown): its id is what
      // identifies the guest from now on.
      if (context.owner.kind === 'guest' && cart.id && cart.id !== getGuestCartId()) {
        setGuestCartId(cart.id)
      }
    },
  }
}

export function useAddCartItem() {
  const queryClient = useQueryClient()
  return useMutation(addCartItemOptions(queryClient))
}
