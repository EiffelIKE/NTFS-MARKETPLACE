import { session } from '@/features/auth/model/instance'
import { cartKeys } from '@/features/cart/api/cart-keys'
import { getGuestCartId } from '@/features/cart/model/guest-cart-id'
import { createMergeGuestCartTask } from '@/features/cart/model/merge-guest-cart'
import { refreshCartForNft } from '@/features/cart/model/refresh-cart'
import { attemptStore, forgetSettledAttempt } from '@/features/checkout/model/attempt-store'
import { purgeCheckoutData } from '@/features/checkout/model/checkout-privacy'
import { draftStore } from '@/features/checkout/model/draft-store'
import { orderKeys } from '@/features/orders/api/order-queries'
import { forgetMissedEvents, noteOrderEvent } from '@/features/orders/model/missed-events'
import { http } from '@/lib/http/client'
import { realtime } from '@/lib/realtime'

import { queryClient } from './query-client'
import { router } from './router'
import { installSessionBridge } from './session-bridge'

let booted = false

/**
 * Wires the session to everything else (spec 04) and starts its restore. `main.tsx` calls it once,
 * after the mock worker is ready: the restore makes a request, and a request sent before the
 * worker starts would miss the mock API.
 */
export function bootApp() {
  if (booted) return
  booted = true
  installSessionBridge({ session, queryClient, router, realtime, http, getGuestCartId })
  // Spec 07: the guest's cart joins the user's after every sign-in, and again on a restore when a
  // previous merge could not finish.
  session.onSignedIn(createMergeGuestCartTask({ queryClient, session }))

  // Spec 09: a checkout draft and a pending attempt hold personal data, so they leave with the
  // user on an explicit sign-out (here or in another tab). An expiry keeps them, so the same user
  // resumes; a login as somebody else removes the previous user's (R8).
  session.onIdentityChange((change) => {
    purgeCheckoutData(change, { draft: draftStore, attempt: attemptStore })
    forgetMissedEvents()
  })

  // A price or stock change reaches the cart wherever the user is (R1, brief §7), not only while
  // the cart page is mounted. `known` too (R4): a catalog refetch that got ahead of the event
  // updated the NFT caches, never the cart.
  realtime.on(
    'nft.updated',
    (event) => {
      refreshCartForNft(queryClient, session.owner(), event.resource.id)
    },
    { known: true },
  )

  // A settled order changes the cart (the purchased lines leave it), wherever the user is. Only the
  // terminal events matter: they are rare, and the cart refetches only if somebody watches it.
  realtime.on('order.updated', (event) => {
    // An event ahead of the `orders.create` response is remembered for `recordOrder` (R7).
    noteOrderEvent(queryClient, event.resource.id, event.version)
    if (event.data.status === 'pending') return
    void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
    // A confirmed order ends its attempt: the next purchase must not be sent back to it (R3). A
    // refusal keeps it, so checkout can still say the payment was refused (CHK-32).
    if (event.data.status !== 'confirmed') return
    const state = session.get()
    if (state.status === 'authenticated') {
      forgetSettledAttempt(attemptStore, state.user.id, {
        id: event.resource.id,
        status: event.data.status,
      })
    }
  })
}
