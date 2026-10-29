import { useQuery } from '@tanstack/react-query'

import { useSession } from '@/features/auth/model/use-session'

import type { Cart } from '@/contracts'
import { cartQueryOptions, quoteQueryOptions } from '../api/cart-queries'
import type { CartOwner } from '../api/cart-keys'

/** The cart owner for the current session; re-renders on sign-in and sign-out. */
export function useCartOwner(): CartOwner {
  const state = useSession()
  return state.status === 'authenticated'
    ? { kind: 'user', userId: state.user.id }
    : { kind: 'guest' }
}

/** The owner's cart, or `undefined` while it loads (or while the session is being restored). */
export function useCart() {
  const owner = useCartOwner()
  const state = useSession()
  return useQuery({ ...cartQueryOptions(owner), enabled: state.status !== 'restoring' })
}

/** Units in the cart, for the header and the tab bar badges (DET-19). */
export function useCartCount(): number {
  const owner = useCartOwner()
  const state = useSession()
  const { data } = useQuery({
    ...cartQueryOptions(owner),
    enabled: state.status !== 'restoring',
    select: (cart) => cart.itemCount,
  })
  return data ?? 0
}

/**
 * The summary's quote for the cart on screen (CART-15, CART-16). It is read only when the cart has
 * lines. While the data belongs to an earlier cart version (`isPlaceholderData`) or a refetch is in
 * flight, the summary dims the amounts and keeps the checkout button off.
 */
export function useQuote(cart: Cart | undefined) {
  const owner = useCartOwner()
  return useQuery({
    ...quoteQueryOptions(owner, cart?.version ?? 0),
    enabled: cart !== undefined && cart.items.length > 0,
  })
}
