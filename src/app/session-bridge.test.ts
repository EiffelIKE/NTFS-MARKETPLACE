import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSessionController } from '@/features/auth/model/session'
import { createSessionStorage } from '@/features/auth/model/session-storage'
import type { SessionPayload } from '@/contracts'

import { installSessionBridge } from './session-bridge'

const notify = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/components/feedback', () => ({ notify }))

const NOW = Date.parse('2026-10-28T12:00:00.000Z')
const user = (id: string) => ({
  id,
  username: id,
  displayName: id,
  email: `${id}@x.test`,
  avatarUrl: null,
})
const payload = (id: string, token: string): SessionPayload => ({
  token,
  expiresAt: new Date(NOW + 3_600_000).toISOString(),
  user: user(id),
})

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => {
      data.clear()
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

function setup(location = { pathname: '/', href: '/' }, protectedPaths: string[] = []) {
  const calls: string[] = []
  const session = createSessionController({
    storage: createSessionStorage(() => memoryStorage()),
    verify: () =>
      Promise.resolve({ expiresAt: new Date(NOW + 1000).toISOString(), user: user('x') }),
    now: () => NOW,
  })
  const queryClient = {
    cancelQueries: vi.fn(() => {
      calls.push('cancel')
      return Promise.resolve()
    }),
    clear: vi.fn(() => {
      calls.push('clear')
    }),
  }
  const realtime = {
    setSession: vi.fn((s: { key: string; token: string | null }) => {
      calls.push(`realtime:${s.key}`)
    }),
  }
  const router = {
    state: { location },
    navigate: vi.fn(() => Promise.resolve()),
    invalidate: vi.fn(() => Promise.resolve()),
    getMatchedRoutes: (pathname: string) => [
      protectedPaths.includes(pathname)
        ? [{ options: { staticData: { requiresAuth: true } } }]
        : [],
      {},
      {},
    ],
  }
  // Only the interceptor registry is used here; the header behavior has its own tests (auth.test.ts).
  const http = {
    interceptors: {
      request: { use: () => 0, eject: () => undefined },
      response: { use: () => 0, eject: () => undefined },
    },
  }
  installSessionBridge({
    session,
    queryClient,
    router: router as never,
    realtime,
    http: http as never,
  })
  return { session, queryClient, realtime, router, calls }
}

beforeEach(() => {
  notify.info.mockClear()
})

describe('identity changes (AUTH-17)', () => {
  it('cancels, clears and resets the socket, in that order', async () => {
    const h = setup()
    await h.session.ready
    h.calls.length = 0
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    expect(h.calls).toEqual(['cancel', 'clear', 'realtime:user:usr_ana'])
  })

  it('a user switch replaces the socket identity and clears again', async () => {
    const h = setup()
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.calls.length = 0
    await h.session.signIn(payload('usr_bruno', 'tok_b'), 'login')
    expect(h.calls).toEqual(['cancel', 'clear', 'realtime:user:usr_bruno'])
    expect(h.realtime.setSession).toHaveBeenLastCalledWith({
      key: 'user:usr_bruno',
      token: 'tok_b',
    })
  })

  it('sign-out goes back to the guest socket', async () => {
    const h = setup()
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.session.signOut('logout')
    expect(h.realtime.setSession).toHaveBeenLastCalledWith({ key: 'guest', token: null })
  })

  it('the restore sets the first socket identity (replaces spec 03 default)', async () => {
    const h = setup()
    await h.session.ready
    await Promise.resolve()
    expect(h.realtime.setSession).toHaveBeenCalledWith({ key: 'guest', token: null })
  })

  it('a sign-in neither navigates nor invalidates: the form navigates after the tasks', async () => {
    const h = setup()
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    expect(h.router.navigate).not.toHaveBeenCalled()
    expect(h.router.invalidate).not.toHaveBeenCalled()
  })
})

describe('expiry (AUTH-14, AUTH-15)', () => {
  it('on a protected route: back to login with the current location and the reason', async () => {
    const h = setup({ pathname: '/profile', href: '/profile?x=1' }, ['/profile'])
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.session.expire('tok_a')
    expect(h.router.navigate).toHaveBeenCalledWith({
      to: '/login',
      search: { redirect: '/profile?x=1', reason: 'expired' },
      replace: true,
    })
    expect(notify.info).not.toHaveBeenCalled()
  })

  it('on a public route: stays, shows the toast with an "Entrar" action', async () => {
    const h = setup({ pathname: '/', href: '/?q=ape' })
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.session.expire('tok_a')
    expect(h.router.navigate).not.toHaveBeenCalled()
    expect(notify.info).toHaveBeenCalledOnce()
    const [message, options] = notify.info.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ]
    expect(message).toBe('Sua sessão expirou. Entre novamente para continuar.')
    expect(options.action.label).toBe('Entrar')
    options.action.onClick()
    expect(h.router.navigate).toHaveBeenCalledWith({
      to: '/login',
      search: { redirect: '/?q=ape' },
      replace: true,
    })
  })

  it('a guard that is already redirecting gets no toast and no second navigation', async () => {
    const h = setup()
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.session.expire('tok_a', { redirecting: true })
    expect(notify.info).not.toHaveBeenCalled()
    expect(h.router.navigate).not.toHaveBeenCalled()
    // The private data is cleared all the same.
    expect(h.queryClient.clear).toHaveBeenCalledTimes(2)
  })

  it('concurrent 401s notify once', async () => {
    const h = setup()
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.session.expire('tok_a')
    h.session.expire('tok_a')
    expect(notify.info).toHaveBeenCalledOnce()
  })
})

describe('logout and other tabs (AUTH-16, AUTH-18)', () => {
  it('logout leaves a protected route for home, and just refreshes a public one', async () => {
    const protectedRoute = setup({ pathname: '/wallets', href: '/wallets' }, ['/wallets'])
    await protectedRoute.session.ready
    await protectedRoute.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    protectedRoute.session.signOut('logout')
    expect(protectedRoute.router.navigate).toHaveBeenCalledWith({ to: '/', replace: true })

    const publicRoute = setup()
    await publicRoute.session.ready
    await publicRoute.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    publicRoute.session.signOut('logout')
    expect(publicRoute.router.navigate).not.toHaveBeenCalled()
    expect(publicRoute.router.invalidate).toHaveBeenCalledOnce()
  })

  it('a sign-out in another tab says so and, on a protected route, goes to login', async () => {
    const h = setup({ pathname: '/profile', href: '/profile' }, ['/profile'])
    await h.session.ready
    await h.session.signIn(payload('usr_ana', 'tok_a'), 'login')
    h.session.signOut('other-tab')
    expect(notify.info).toHaveBeenCalledWith(
      'Sua sessão foi encerrada em outra aba.',
      expect.anything(),
    )
    expect(h.router.navigate).toHaveBeenCalledWith({
      to: '/login',
      search: { redirect: '/profile' },
      replace: true,
    })
  })
})
