import {
  useMutation,
  useQueryClient,
  type MutationOptions,
  type QueryClient,
} from '@tanstack/react-query'

import { cartApi } from '@/api'
import type { AddCartItemBody, Cart, UpdateCartItemBody } from '@/contracts'
import { session as appSession } from '@/features/auth/model/instance'
import type { SessionController } from '@/features/auth/model/session'
import type { ApiError } from '@/lib/http/errors'

import { getGuestCartId, setGuestCartId } from '../model/guest-cart-id'
import { applyCart } from './apply-cart'
import { cartKeys, type CartOwner } from './cart-keys'

type Guard = Pick<SessionController, 'epoch' | 'isCurrent' | 'owner'>

interface WriteContext {
  epoch: number
  owner: CartOwner
}

/**
 * Every cart mutation answers with the whole cart, and the cache changes only on success, from
 * that response (spec 07 design §3, §5): a failure leaves the cart and the header count as they
 * were. A result that arrives after the session changed (sign-out, user switch) belongs to nobody
 * and is dropped (spec 04 epoch guard). A cart read that started before the write must not land on
 * top of it, so reads are cancelled first. Options factories, so the logic runs under a plain
 * `MutationObserver` in tests.
 */
function cartWriteOptions<TVariables>(
  queryClient: QueryClient,
  key: string,
  mutationFn: (variables: TVariables) => Promise<Cart>,
  session: Guard,
): MutationOptions<Cart, ApiError, TVariables, WriteContext> {
  return {
    mutationKey: ['cart', key],
    mutationFn,
    onMutate: () => ({ epoch: session.epoch(), owner: session.owner() }),
    onSuccess: async (cart, _variables, context) => {
      if (!session.isCurrent(context.epoch)) return
      await queryClient.cancelQueries({ queryKey: cartKeys.detail(context.owner), exact: true })
      applyCart(queryClient, context.owner, cart)
      // A guest's write may create the cart (or replace one a reset made unknown): its id is what
      // identifies the guest from now on.
      if (context.owner.kind === 'guest' && cart.id && cart.id !== getGuestCartId()) {
        setGuestCartId(cart.id)
      }
    },
  }
}

/** `cart.addItem` (DET-15 – DET-19). */
export function addCartItemOptions(queryClient: QueryClient, session: Guard = appSession) {
  return cartWriteOptions(
    queryClient,
    'add',
    (body: AddCartItemBody) => cartApi.addItem(body),
    session,
  )
}

export interface UpdateCartItemVariables {
  itemId: string
  body: UpdateCartItemBody
}

/** `cart.updateItem`: a quantity, or the acknowledgement of a new price (CART-08, CART-20). */
export function updateCartItemOptions(queryClient: QueryClient, session: Guard = appSession) {
  return cartWriteOptions(
    queryClient,
    'update',
    ({ itemId, body }: UpdateCartItemVariables) => cartApi.updateItem(itemId, body),
    session,
  )
}

/** `cart.removeItem`: the line goes away only after the API confirms (CART-10). */
export function removeCartItemOptions(queryClient: QueryClient, session: Guard = appSession) {
  return cartWriteOptions(
    queryClient,
    'remove',
    (itemId: string) => cartApi.removeItem(itemId),
    session,
  )
}

/** `cart.applyCoupon` (CART-12, CART-13). */
export function applyCouponOptions(queryClient: QueryClient, session: Guard = appSession) {
  return cartWriteOptions(
    queryClient,
    'coupon',
    (code: string) => cartApi.applyCoupon(code),
    session,
  )
}

/** `cart.removeCoupon`. */
export function removeCouponOptions(queryClient: QueryClient, session: Guard = appSession) {
  return cartWriteOptions(queryClient, 'coupon-remove', () => cartApi.removeCoupon(), session)
}

export function useAddCartItem() {
  const queryClient = useQueryClient()
  return useMutation(addCartItemOptions(queryClient))
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient()
  return useMutation(updateCartItemOptions(queryClient))
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  return useMutation(removeCartItemOptions(queryClient))
}

export function useApplyCoupon() {
  const queryClient = useQueryClient()
  return useMutation(applyCouponOptions(queryClient))
}

export function useRemoveCoupon() {
  const queryClient = useQueryClient()
  return useMutation(removeCouponOptions(queryClient))
}
