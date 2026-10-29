import { redirect, type AnyRouter } from '@tanstack/react-router'

import type { AuthSearch } from './auth-search'
import type { SessionController } from './session'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** The route needs a session; `closeTarget` and the bridge read it (spec 04). */
    requiresAuth?: boolean
  }
}

interface GuardContext {
  context: { session: Pick<SessionController, 'ensureValid' | 'get'> }
  location: { href: string }
}

/**
 * `beforeLoad` for checkout, orders, profile and wallets (AUTH-11, AUTH-13). A visitor, or a
 * session that no longer holds, goes to `/login?redirect=<where they were going>`; an expired one
 * adds `reason=expired` so the login page can say why (AUTH-14).
 */
export async function requireAuth({ context, location }: GuardContext): Promise<void> {
  if (await context.session.ensureValid()) return
  const state = context.session.get()
  const expired = state.status === 'guest' && state.lastSignOut === 'expired'
  throw redirect({
    to: '/login',
    search: { redirect: location.href, ...(expired && { reason: 'expired' as const }) },
    replace: true,
  })
}

/** `beforeLoad` for `/login` and `/signup` (AUTH-12): a signed-in user goes where they were headed. */
export function redirectIfAuthenticated({
  context,
  search,
}: {
  context: { session: Pick<SessionController, 'isAuthenticated'> }
  search: AuthSearch
}): void {
  if (context.session.isAuthenticated()) {
    throw redirect({ href: search.redirect ?? '/', replace: true })
  }
}

/** Whether a path (no search or hash) matches a route that needs a session. */
export function pathRequiresAuth(router: AnyRouter, pathname: string): boolean {
  const [matchedRoutes, , foundRoute] = router.getMatchedRoutes(pathname)
  return foundRoute !== undefined && matchedRoutes.some((r) => r.options.staticData?.requiresAuth)
}

/** Where the panel's × goes (AUTH-19): the redirect when it is public, otherwise home. */
export function closeTarget(
  isProtected: (pathname: string) => boolean,
  redirectHref: string | undefined,
): string {
  if (!redirectHref) return '/'
  const pathname = redirectHref.split(/[?#]/, 1)[0] ?? '/'
  return isProtected(pathname) ? '/' : redirectHref
}
