import { session } from '@/features/auth/model/instance'
import { getGuestCartId } from '@/features/cart/model/guest-cart-id'
import { createMergeGuestCartTask } from '@/features/cart/model/merge-guest-cart'
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
}
