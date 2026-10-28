import type { QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'

import { notify } from '@/components/feedback'
import { EXPIRED_MESSAGE, OTHER_TAB_MESSAGE } from '@/features/auth/model/messages'
import { pathRequiresAuth } from '@/features/auth/model/redirects'
import type { Identity, IdentityChange, SessionController } from '@/features/auth/model/session'
import { installAuthInterceptors } from '@/lib/http/auth'
import type { http as httpClient } from '@/lib/http/client'
import type { RealtimeManager, RealtimeSession } from '@/lib/realtime'

export interface SessionBridgeDeps {
  session: SessionController
  queryClient: Pick<QueryClient, 'cancelQueries' | 'clear'>
  router: Pick<AnyRouter, 'state' | 'navigate' | 'invalidate' | 'getMatchedRoutes'>
  realtime: Pick<RealtimeManager, 'setSession'>
  http: typeof httpClient
  /** The guest cart id (spec 06's store), sent as `X-Guest-Cart-Id` while nobody is signed in. */
  getGuestCartId?: () => string | null
}

const realtimeSession = (identity: Identity): RealtimeSession =>
  identity.kind === 'user'
    ? { key: `user:${identity.userId}`, token: identity.token }
    : { key: 'guest', token: null }

function currentIdentity(session: SessionController): Identity {
  const state = session.get()
  return state.status === 'authenticated'
    ? { kind: 'user', userId: state.user.id, token: state.token }
    : { kind: 'guest' }
}

/**
 * Where the session meets everything else (spec 04 design §5), so features stay decoupled: HTTP
 * headers and the 401 hook, the Query cache, the socket, the router and the toasts. Returns the
 * function that undoes it (tests; the app never calls it).
 */
export function installSessionBridge(deps: SessionBridgeDeps): () => void {
  const { session, queryClient, router, realtime, http } = deps

  const uninstallHttp = installAuthInterceptors(http, {
    getToken: () => session.token(),
    getGuestCartId: deps.getGuestCartId ?? (() => null),
    onUnauthorized: (token) => {
      session.expire(token)
    },
  })

  const login = (search: { redirect: string; reason?: 'expired' }) =>
    router.navigate({ to: '/login', search, replace: true })

  const onChange = (change: IdentityChange) => {
    // AUTH-17: nothing of the previous identity survives. Queries that resolve after `clear()` land
    // in detached entries, and the socket is replaced, so late data and events find no owner.
    void queryClient.cancelQueries()
    queryClient.clear()
    realtime.setSession(realtimeSession(change.next))

    // A route guard is already redirecting, and a sign-in is followed by the form's own navigation
    // after the post-sign-in tasks (AUTH-10).
    if (change.redirecting || change.cause === 'login' || change.cause === 'signup') return

    const here = router.state.location
    const onProtected = pathRequiresAuth(router as AnyRouter, here.pathname)

    if (change.cause === 'logout') {
      if (onProtected) void router.navigate({ to: '/', replace: true })
      else void router.invalidate()
      return
    }

    if (change.next.kind === 'guest') {
      if (change.cause === 'other-tab') notify.info(OTHER_TAB_MESSAGE, { id: 'session-ended' })
      if (onProtected) {
        // AUTH-14: back to login, to return here afterwards.
        void login({
          redirect: here.href,
          ...(change.cause === 'expired' && { reason: 'expired' as const }),
        })
        return
      }
      if (change.cause === 'expired') {
        // AUTH-15: the user keeps the page and gets a way back in.
        notify.info(EXPIRED_MESSAGE, {
          id: 'session-expired',
          action: {
            label: 'Entrar',
            onClick: () => {
              void login({ redirect: router.state.location.href })
            },
          },
        })
      }
    }
    void router.invalidate()
  }
  const offIdentity = session.onIdentityChange(onChange)

  // The restore decides the first identity; the manager waits for it instead of assuming a guest.
  void session.restore().then(() => {
    realtime.setSession(realtimeSession(currentIdentity(session)))
  })

  return () => {
    offIdentity()
    uninstallHttp()
  }
}
