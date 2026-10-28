import { session } from '@/features/auth/model/instance'
import { cartKeys } from '@/features/cart/api/cart-keys'
import { getGuestCartId } from '@/features/cart/model/guest-cart-id'
import { createMergeGuestCartTask } from '@/features/cart/model/merge-guest-cart'
import { attemptStore } from '@/features/checkout/model/attempt-store'
import { draftStore } from '@/features/checkout/model/draft-store'
import { orderKeys } from '@/features/orders/api/order-queries'
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
  // user on an explicit sign-out (here or in another tab). An expiry keeps them: the flow resumes.
  session.onIdentityChange((change) => {
    if (change.prev.kind !== 'user') return
    if (change.cause !== 'logout' && change.cause !== 'other-tab') return
    draftStore.clear(change.prev.userId)
    attemptStore.clear(change.prev.userId)
  })

  // A settled order changes the cart (the purchased lines leave it), wherever the user is. Only the
  // terminal events matter: they are rare, and the cart refetches only if somebody watches it.
  realtime.on('order.updated', (event) => {
    if (event.data.status === 'pending') return
    void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    void queryClient.invalidateQueries({ queryKey: orderKeys.lists })
  })
}
