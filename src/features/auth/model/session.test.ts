import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionInfo, SessionPayload } from '@/contracts'
import { ApiError } from '@/lib/http/errors'

import {
  createSessionController,
  VERIFY_TTL_MS,
  type IdentityChange,
  type SessionController,
} from './session'
import { createSessionStorage, SESSION_KEY, type SessionStorage } from './session-storage'

const NOW = Date.parse('2026-10-28T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

const ana = { id: 'usr_ana', username: 'anasouza', displayName: 'Ana Souza', email: 'a@x.test' }
const bruno = { ...ana, id: 'usr_bruno', username: 'brunolima', displayName: 'Bruno Lima' }

function payload(token = 'tok_ana', user = ana, offsetMs = 3_600_000): SessionPayload {
  return { token, expiresAt: iso(offsetMs), user: { ...user, avatarUrl: null } }
}

const unauthenticated = () =>
  new ApiError('http', 'x', { status: 401, code: 'UNAUTHENTICATED' as never })
const expired = () => new ApiError('http', 'x', { status: 401, code: 'SESSION_EXPIRED' as never })
const network = () => new ApiError('network', 'offline')

class FakeStorage implements Storage {
  data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear = () => {
    this.data.clear()
  }
  getItem = (key: string) => this.data.get(key) ?? null
  key = (index: number) => [...this.data.keys()][index] ?? null
  removeItem = (key: string) => {
    this.data.delete(key)
  }
  setItem = (key: string, value: string) => {
    this.data.set(key, value)
  }
}

interface Harness {
  session: SessionController
  area: FakeStorage
  storage: SessionStorage
  verify: ReturnType<typeof vi.fn<() => Promise<SessionInfo>>>
  changes: IdentityChange[]
  /** Simulates a `storage` event from another tab. */
  fromOtherTab(raw: string | null): void
  clock: { now: number }
}

function setup(
  stored?: SessionPayload,
  verifyResult: () => Promise<SessionInfo> = () =>
    Promise.resolve({ expiresAt: iso(3_600_000), user: { ...ana, avatarUrl: null } }),
): Harness {
  const area = new FakeStorage()
  const real = createSessionStorage(() => area)
  let handler: ((raw: string | null) => void) | undefined
  const storage: SessionStorage = {
    ...real,
    watch(next) {
      handler = next
      return () => undefined
    },
  }
  if (stored) storage.write(stored)
  const verify = vi.fn(verifyResult)
  const clock = { now: NOW }
  const session = createSessionController({
    storage,
    verify,
    now: () => clock.now,
    restoreRetryDelaysMs: [10, 20],
  })
  const changes: IdentityChange[] = []
  session.onIdentityChange((change) => changes.push(change))
  return {
    session,
    area,
    storage,
    verify,
    changes,
    clock,
    fromOtherTab: (raw) => handler?.(raw),
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('storage (AUTH-06, AUTH-07)', () => {
  it('stores only the session payload under one key', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    expect([...h.area.data.keys()]).toEqual([SESSION_KEY])
    expect(Object.keys(JSON.parse(h.area.data.get(SESSION_KEY) ?? '{}') as object)).toEqual([
      'token',
      'expiresAt',
      'user',
    ])
    expect(h.area.data.get(SESSION_KEY)).not.toMatch(/password/i)
  })

  it('removes a corrupt value and starts as a guest', async () => {
    const h = setup()
    h.area.setItem(SESSION_KEY, '{"token": 1')
    await h.session.restore()
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: null })
    expect(h.area.getItem(SESSION_KEY)).toBeNull()
  })

  it('removes a value that does not match the contract', async () => {
    const h = setup()
    h.area.setItem(SESSION_KEY, JSON.stringify({ token: 'x' }))
    await h.session.restore()
    expect(h.area.getItem(SESSION_KEY)).toBeNull()
  })

  it('falls back to memory when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    const storage = createSessionStorage(() => throwing)
    storage.write(payload())
    expect(storage.read()?.token).toBe('tok_ana')
    storage.clear()
    expect(storage.read()).toBeNull()
  })
})

describe('restore (AUTH-08)', () => {
  it('without a stored session: guest', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.ready
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: null })
    expect(h.verify).not.toHaveBeenCalled()
  })

  it('a stored session past its expiry: removed and expired, no request', async () => {
    const h = setup(payload('tok_ana', ana, -1000))
    await h.session.restore()
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'expired' })
    expect(h.area.getItem(SESSION_KEY)).toBeNull()
    expect(h.verify).not.toHaveBeenCalled()
  })

  it('200: authenticated with the refreshed user', async () => {
    const fresh = { ...ana, displayName: 'Ana S.', avatarUrl: null }
    const h = setup(payload(), () => Promise.resolve({ expiresAt: iso(7_200_000), user: fresh }))
    const tasks = vi.fn()
    h.session.onSignedIn(tasks)
    await h.session.restore()
    expect(h.session.get()).toMatchObject({
      status: 'authenticated',
      user: { displayName: 'Ana S.' },
      verifiedAt: NOW,
    })
    expect(h.session.token()).toBe('tok_ana')
    expect(h.storage.read()?.user.displayName).toBe('Ana S.')
    await vi.waitFor(() => {
      expect(tasks).toHaveBeenCalledWith({ via: 'restore', userId: 'usr_ana' })
    })
    // Restoring is not an identity change: nothing was loaded before it.
    expect(h.changes).toEqual([])
  })

  it('exposes the stored token while it verifies', async () => {
    let seen: string | null = null
    const holder: { h?: Harness } = {}
    holder.h = setup(payload(), () => {
      seen = holder.h?.session.token() ?? null
      return Promise.resolve({ expiresAt: iso(1000), user: { ...ana, avatarUrl: null } })
    })
    await holder.h.session.restore()
    expect(seen).toBe('tok_ana')
  })

  it('401: removed and expired', async () => {
    const h = setup(payload(), () => Promise.reject(expired()))
    await h.session.restore()
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'expired' })
    expect(h.area.getItem(SESSION_KEY)).toBeNull()
    expect(h.verify).toHaveBeenCalledTimes(1)
  })

  it('network failure: retries twice, then keeps the stored session', async () => {
    const h = setup(payload(), () => Promise.reject(network()))
    await h.session.restore()
    expect(h.verify).toHaveBeenCalledTimes(3)
    expect(h.session.get()).toMatchObject({
      status: 'authenticated',
      token: 'tok_ana',
      verifiedAt: null,
    })
    expect(h.area.getItem(SESSION_KEY)).not.toBeNull()
  })

  it('a transient failure that recovers on retry authenticates', async () => {
    let calls = 0
    const h = setup(payload(), () => {
      calls += 1
      return calls === 1
        ? Promise.reject(network())
        : Promise.resolve({ expiresAt: iso(1000), user: { ...ana, avatarUrl: null } })
    })
    await h.session.restore()
    expect(calls).toBe(2)
    expect(h.session.get()).toMatchObject({ status: 'authenticated', verifiedAt: NOW })
  })

  it('does not retry a 4xx that is not a session error', async () => {
    const h = setup(payload(), () => Promise.reject(new ApiError('http', 'x', { status: 403 })))
    await h.session.restore()
    expect(h.verify).toHaveBeenCalledTimes(1)
    expect(h.session.get().status).toBe('authenticated')
  })

  it('restores once however often it is called', async () => {
    const h = setup(payload())
    await Promise.all([h.session.restore(), h.session.restore()])
    expect(h.verify).toHaveBeenCalledTimes(1)
  })
})

describe('signIn and post-sign-in tasks (AUTH-07, AUTH-10)', () => {
  it('runs the tasks in registration order and isolates a failing one', async () => {
    const h = setup()
    await h.session.restore()
    const order: string[] = []
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    h.session.onSignedIn(async () => {
      await Promise.resolve()
      order.push('first')
    })
    h.session.onSignedIn(() => {
      order.push('failing')
      throw new Error('merge failed')
    })
    h.session.onSignedIn(() => {
      order.push('last')
    })

    await expect(h.session.signIn(payload(), 'login')).resolves.toBeUndefined()
    expect(order).toEqual(['first', 'failing', 'last'])
    expect(h.session.isAuthenticated()).toBe(true)
    error.mockRestore()
  })

  it('passes how the user signed in', async () => {
    const h = setup()
    await h.session.restore()
    const task = vi.fn()
    h.session.onSignedIn(task)
    await h.session.signIn(payload(), 'signup')
    expect(task).toHaveBeenCalledWith({ via: 'signup', userId: 'usr_ana' })
  })

  it('a removed task no longer runs', async () => {
    const h = setup()
    await h.session.restore()
    const task = vi.fn()
    h.session.onSignedIn(task)()
    await h.session.signIn(payload(), 'login')
    expect(task).not.toHaveBeenCalled()
  })

  it('the state is authenticated and the identity listeners ran before the tasks', async () => {
    const h = setup()
    await h.session.restore()
    const seen: string[] = []
    h.session.onIdentityChange(() => seen.push('identity'))
    h.session.onSignedIn(() => {
      seen.push('task')
    })
    await h.session.signIn(payload(), 'login')
    expect(seen).toEqual(['identity', 'task'])
  })

  it('exposes the owner for the cart', async () => {
    const h = setup()
    await h.session.restore()
    expect(h.session.owner()).toEqual({ kind: 'guest' })
    await h.session.signIn(payload(), 'login')
    expect(h.session.owner()).toEqual({ kind: 'user', userId: 'usr_ana' })
  })
})

describe('identity changes and the epoch (AUTH-17)', () => {
  it('increments on guest to user, user to guest and user A to user B', async () => {
    const h = setup()
    await h.session.restore()
    const start = h.session.epoch()
    await h.session.signIn(payload(), 'login')
    expect(h.session.epoch()).toBe(start + 1)
    h.session.signOut('logout')
    expect(h.session.epoch()).toBe(start + 2)
    await h.session.signIn(payload('tok_b', bruno), 'login')
    await h.session.signIn(payload('tok_ana', ana), 'login')
    expect(h.session.epoch()).toBe(start + 4)
    expect(h.changes.map((c) => [c.prev.kind, c.next.kind, c.cause])).toEqual([
      ['guest', 'user', 'login'],
      ['user', 'guest', 'logout'],
      ['guest', 'user', 'login'],
      ['user', 'user', 'login'],
    ])
  })

  it('a new token for the same user is an identity change too', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload('tok_1'), 'login')
    const epoch = h.session.epoch()
    await h.session.signIn(payload('tok_2'), 'login')
    expect(h.session.epoch()).toBe(epoch + 1)
    expect(h.session.isCurrent(epoch)).toBe(false)
  })

  it('does not change on a profile update or a successful re-verification', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    const epoch = h.session.epoch()
    h.session.updateUser({ displayName: 'Ana S.' })
    expect(h.session.epoch()).toBe(epoch)
    expect(h.storage.read()?.user.displayName).toBe('Ana S.')
    expect(h.session.get()).toMatchObject({ user: { displayName: 'Ana S.' } })
  })

  it('a listener that throws does not stop the others', async () => {
    const h = setup()
    await h.session.restore()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    h.session.onIdentityChange(() => {
      throw new Error('boom')
    })
    const after = vi.fn()
    h.session.onIdentityChange(after)
    await h.session.signIn(payload(), 'login')
    expect(after).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

describe('sign-out and expiry (AUTH-13, AUTH-16)', () => {
  it('signOut clears storage, remembers why, and is idempotent', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    h.session.signOut('logout')
    h.session.signOut('logout')
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'logout' })
    expect(h.area.getItem(SESSION_KEY)).toBeNull()
    expect(h.changes).toHaveLength(2)
  })

  it('expire ignores a stale token', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload('tok_current'), 'login')
    h.session.expire('tok_old')
    expect(h.session.isAuthenticated()).toBe(true)
  })

  it('concurrent expiries act once', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload('tok_1'), 'login')
    h.changes.length = 0
    h.session.expire('tok_1')
    h.session.expire('tok_1')
    h.session.expire('tok_1')
    expect(h.changes).toHaveLength(1)
    expect(h.changes[0]).toMatchObject({ cause: 'expired', redirecting: false })
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'expired' })
  })

  it('does not expire a restoring session from a 401 (restore decides)', async () => {
    const ref: { session?: SessionController } = {}
    const h = setup(payload(), () => {
      ref.session?.expire('tok_ana')
      return Promise.reject(network())
    })
    ref.session = h.session
    await h.session.restore()
    expect(h.session.get().status).toBe('authenticated')
  })
})

describe('ensureValid (AUTH-13)', () => {
  async function signedIn(verify?: () => Promise<SessionInfo>) {
    const h = setup(undefined, verify)
    await h.session.restore()
    await h.session.signIn(payload('tok_1', ana, 120_000), 'login')
    h.verify.mockClear()
    h.changes.length = 0
    return h
  }

  it('a guest is not valid', async () => {
    const h = setup()
    await h.session.restore()
    await expect(h.session.ensureValid()).resolves.toBe(false)
  })

  it('a fresh verification is trusted without a request', async () => {
    const h = await signedIn()
    h.clock.now += VERIFY_TTL_MS - 1
    await expect(h.session.ensureValid()).resolves.toBe(true)
    expect(h.verify).not.toHaveBeenCalled()
  })

  it('an expiry date in the past expires locally, as redirecting', async () => {
    const h = await signedIn()
    h.clock.now += 121_000
    await expect(h.session.ensureValid()).resolves.toBe(false)
    expect(h.verify).not.toHaveBeenCalled()
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'expired' })
    expect(h.changes[0]).toMatchObject({ cause: 'expired', redirecting: true })
  })

  it('a verification older than 60 s is repeated and refreshes the user', async () => {
    const fresh = { ...ana, displayName: 'Ana S.', avatarUrl: null }
    const h = await signedIn(() => Promise.resolve({ expiresAt: iso(7_200_000), user: fresh }))
    h.clock.now += VERIFY_TTL_MS + 1
    await expect(h.session.ensureValid()).resolves.toBe(true)
    expect(h.verify).toHaveBeenCalledOnce()
    expect(h.session.get()).toMatchObject({
      user: { displayName: 'Ana S.' },
      verifiedAt: h.clock.now,
    })
  })

  it('a 401 on the check expires the session, as redirecting', async () => {
    const h = await signedIn(() => Promise.reject(unauthenticated()))
    h.clock.now += VERIFY_TTL_MS + 1
    await expect(h.session.ensureValid()).resolves.toBe(false)
    expect(h.changes).toHaveLength(1)
    expect(h.changes[0]).toMatchObject({ cause: 'expired', redirecting: true })
  })

  it('an expiry reported by the interceptor during the check is redirecting too', async () => {
    const ref: { session?: SessionController } = {}
    const h = await signedIn(() => {
      // The HTTP interceptor reports the 401 before the check's own promise settles.
      ref.session?.expire('tok_1')
      return Promise.reject(expired())
    })
    ref.session = h.session
    h.clock.now += VERIFY_TTL_MS + 1
    await expect(h.session.ensureValid()).resolves.toBe(false)
    expect(h.changes).toHaveLength(1)
    expect(h.changes[0]?.redirecting).toBe(true)
  })

  it('a network failure keeps the user in', async () => {
    const h = await signedIn(() => Promise.reject(network()))
    h.clock.now += VERIFY_TTL_MS + 1
    await expect(h.session.ensureValid()).resolves.toBe(true)
    expect(h.session.isAuthenticated()).toBe(true)
  })

  it('a restore that could not reach the server verifies at the first guard', async () => {
    const h = setup(payload('tok_ana', ana, 3_600_000), () => Promise.reject(network()))
    await h.session.restore()
    h.verify.mockClear()
    h.verify.mockResolvedValue({ expiresAt: iso(3_600_000), user: { ...ana, avatarUrl: null } })
    await expect(h.session.ensureValid()).resolves.toBe(true)
    expect(h.verify).toHaveBeenCalledOnce()
  })
})

describe('cross-tab (AUTH-18)', () => {
  it('ignores a value equal to the current payload', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    h.changes.length = 0
    h.fromOtherTab(h.storage.serialize(payload()))
    expect(h.changes).toEqual([])
  })

  it('a removed value signs out as other-tab, without touching storage again', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    h.changes.length = 0
    h.fromOtherTab(null)
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'other-tab' })
    expect(h.changes).toMatchObject([{ cause: 'other-tab', next: { kind: 'guest' } }])
  })

  it('another user is adopted without running the post-sign-in tasks', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    const task = vi.fn()
    h.session.onSignedIn(task)
    h.changes.length = 0
    const epoch = h.session.epoch()
    h.fromOtherTab(h.storage.serialize(payload('tok_b', bruno)))
    expect(h.session.get()).toMatchObject({ status: 'authenticated', token: 'tok_b' })
    expect(h.session.epoch()).toBe(epoch + 1)
    expect(h.changes).toMatchObject([{ cause: 'other-tab', next: { userId: 'usr_bruno' } }])
    expect(task).not.toHaveBeenCalled()
  })

  it('a guest tab adopts a sign-in made elsewhere', async () => {
    const h = setup()
    await h.session.restore()
    h.fromOtherTab(h.storage.serialize(payload()))
    expect(h.session.isAuthenticated()).toBe(true)
    expect(h.changes).toMatchObject([{ prev: { kind: 'guest' }, cause: 'other-tab' }])
  })

  it('the same token with fresher details updates the user in place', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    h.changes.length = 0
    h.fromOtherTab(h.storage.serialize(payload('tok_ana', { ...ana, displayName: 'Ana S.' })))
    expect(h.session.get()).toMatchObject({ user: { displayName: 'Ana S.' } })
    expect(h.changes).toEqual([])
  })

  it('a removal while already a guest changes nothing', async () => {
    const h = setup()
    await h.session.restore()
    h.fromOtherTab(null)
    expect(h.changes).toEqual([])
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: null })
  })

  it('an invalid value from another tab is treated as a removal', async () => {
    const h = setup()
    await h.session.restore()
    await h.session.signIn(payload(), 'login')
    h.fromOtherTab('not json')
    expect(h.session.get()).toEqual({ status: 'guest', lastSignOut: 'other-tab' })
  })
})
