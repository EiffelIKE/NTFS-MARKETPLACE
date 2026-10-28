import type { SessionInfo, SessionPayload, User } from '@/contracts'
import { isSessionError } from '@/lib/http/auth'
import { isRetryable } from '@/lib/http/errors'

import type { SessionStorage } from './session-storage'

export type SignOutReason = 'logout' | 'expired' | 'other-tab'

export interface AuthenticatedState {
  status: 'authenticated'
  token: string
  expiresAt: string
  user: User
  /** When the server last confirmed the token; `null` after a restore that could not reach it. */
  verifiedAt: number | null
}

export type SessionState =
  /** Only before `ready` resolves. */
  | { status: 'restoring' }
  | { status: 'guest'; lastSignOut: SignOutReason | null }
  | AuthenticatedState

export type Identity = { kind: 'guest' } | { kind: 'user'; userId: string; token: string }

export type IdentityCause = 'login' | 'signup' | SignOutReason

export interface IdentityChange {
  prev: Identity
  next: Identity
  cause: IdentityCause
  /** A route guard is already redirecting, so listeners must not notify or navigate. */
  redirecting: boolean
}

export interface SignedInContext {
  via: 'login' | 'signup' | 'restore'
  userId: string
}

export type SignedInTask = (ctx: SignedInContext) => Promise<void> | void

/** Cart owner as spec 07 keys its queries. */
export type SessionOwner = { kind: 'user'; userId: string } | { kind: 'guest' }

export type EditableUser = Partial<Pick<User, 'displayName' | 'username' | 'email' | 'avatarUrl'>>

export interface SessionController {
  get: () => SessionState
  subscribe: (listener: () => void) => () => void
  /** Resolves once the stored session has been restored (AUTH-08). Never rejects. */
  ready: Promise<void>
  /** Starts the restore. Called once, after the bridge has subscribed. */
  restore: () => Promise<void>
  isAuthenticated: () => boolean
  token: () => string | null
  owner: () => SessionOwner
  epoch: () => number
  isCurrent: (epoch: number) => boolean
  signIn: (payload: SessionPayload, via: 'login' | 'signup') => Promise<void>
  /** Local only; a no-op for a guest, so concurrent calls act once. */
  signOut: (reason: SignOutReason, opts?: { redirecting?: boolean }) => void
  /** AUTH-13: a no-op unless `token` is the current token. */
  expire: (token: string, opts?: { redirecting?: boolean }) => void
  /** The guard check: local expiry, then a server check when the last one is older than 60 s. */
  ensureValid: () => Promise<boolean>
  updateUser: (patch: EditableUser) => void
  onSignedIn: (task: SignedInTask) => () => void
  onIdentityChange: (listener: (change: IdentityChange) => void) => () => void
}

export interface SessionDeps {
  storage: SessionStorage
  /** `auth.session` with the current token (the HTTP interceptor adds the header). */
  verify(): Promise<SessionInfo>
  now?: () => number
  /** Waits between restore attempts; tests pass a fake. */
  restoreRetryDelaysMs?: readonly number[]
}

/** A server check younger than this is trusted at navigation time. */
export const VERIFY_TTL_MS = 60_000
/** Two retries with a short backoff: a stored session must not hold the first render for seconds. */
export const RESTORE_RETRY_DELAYS_MS = [300, 900] as const

const identityOf = (state: SessionState): Identity =>
  state.status === 'authenticated'
    ? { kind: 'user', userId: state.user.id, token: state.token }
    : { kind: 'guest' }

const sameIdentity = (a: Identity, b: Identity) =>
  a.kind === 'guest'
    ? b.kind === 'guest'
    : b.kind === 'user' && a.userId === b.userId && a.token === b.token

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * The session (spec 04 design §3): state, storage, restore, expiry, epoch and cross-tab sync, with
 * no UI and no knowledge of the Query client, the router or the socket. The bridge in `app/`
 * reacts to `onIdentityChange`. `createSessionController` is the testable factory; `instance.ts`
 * holds the singleton.
 */
export function createSessionController(deps: SessionDeps): SessionController {
  const { storage } = deps
  const now = deps.now ?? (() => Date.now())
  const retryDelays = deps.restoreRetryDelaysMs ?? RESTORE_RETRY_DELAYS_MS

  let state: SessionState = { status: 'restoring' }
  let epoch = 0
  /** The stored token while it is being verified, so the check itself carries it. */
  let restoringToken: string | null = null
  let restoreStarted: Promise<void> | null = null
  /** Guard checks in flight: an expiry they trigger is theirs to redirect (AUTH-14). */
  let guardChecks = 0

  const subscribers = new Set<() => void>()
  const identityListeners = new Set<(change: IdentityChange) => void>()
  const tasks = new Set<SignedInTask>()

  let resolveReady: () => void = () => undefined
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  const notify = () => {
    for (const listener of [...subscribers]) listener()
  }

  const payloadOf = (s: SessionState): SessionPayload | null =>
    s.status === 'authenticated' ? { token: s.token, expiresAt: s.expiresAt, user: s.user } : null

  /** Applies `next`; when the identity differs, bumps the epoch and tells the listeners first. */
  const transition = (next: SessionState, cause: IdentityCause, redirecting = false) => {
    const prev = identityOf(state)
    const nextIdentity = identityOf(next)
    state = next
    if (!sameIdentity(prev, nextIdentity)) {
      epoch += 1
      const change: IdentityChange = { prev, next: nextIdentity, cause, redirecting }
      for (const listener of [...identityListeners]) {
        try {
          listener(change)
        } catch (error) {
          console.error('[session] an identity listener failed', error)
        }
      }
    }
    notify()
  }

  const authenticated = (payload: SessionPayload, verifiedAt: number | null): SessionState => ({
    status: 'authenticated',
    token: payload.token,
    expiresAt: payload.expiresAt,
    user: payload.user,
    verifiedAt,
  })

  const runTasks = async (ctx: SignedInContext) => {
    for (const task of [...tasks]) {
      try {
        await task(ctx)
      } catch (error) {
        // A failing task never blocks sign-in; its owner shows its own UI (AUTH-10).
        console.error('[session] a post-sign-in task failed', error)
      }
    }
  }

  const stillSame = (token: string) => state.status === 'authenticated' && state.token === token

  const isExpiredAt = (expiresAt: string) => Date.parse(expiresAt) <= now()

  const verifyWithRetries = async (): Promise<SessionInfo> => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await deps.verify()
      } catch (error) {
        const delay = retryDelays[attempt]
        if (delay === undefined || !isRetryable(error)) throw error
        await wait(delay)
      }
    }
  }

  const doRestore = async () => {
    const stored = storage.read()
    if (!stored) {
      state = { status: 'guest', lastSignOut: null }
      notify()
      resolveReady()
      return
    }
    if (isExpiredAt(stored.expiresAt)) {
      storage.clear()
      state = { status: 'guest', lastSignOut: 'expired' }
      notify()
      resolveReady()
      return
    }

    restoringToken = stored.token
    try {
      const info = await verifyWithRetries()
      const fresh: SessionPayload = { token: stored.token, ...info }
      storage.write(fresh)
      state = authenticated(fresh, now())
    } catch (error) {
      if (isSessionError(error)) {
        storage.clear()
        state = { status: 'guest', lastSignOut: 'expired' }
      } else {
        // Offline or a failing server: keep the session; the next request or guard decides.
        state = authenticated(stored, null)
      }
    } finally {
      restoringToken = null
    }
    notify()
    resolveReady()
    if (state.status === 'authenticated') {
      void runTasks({ via: 'restore', userId: state.user.id })
    }
  }

  const signOut: SessionController['signOut'] = (reason, opts) => {
    if (state.status !== 'authenticated') return
    storage.clear()
    transition({ status: 'guest', lastSignOut: reason }, reason, opts?.redirecting)
  }

  const expire: SessionController['expire'] = (token, opts) => {
    if (state.status !== 'authenticated' || state.token !== token) return
    signOut('expired', { redirecting: (opts?.redirecting ?? false) || guardChecks > 0 })
  }

  const controller: SessionController = {
    get: () => state,
    subscribe(listener) {
      subscribers.add(listener)
      return () => {
        subscribers.delete(listener)
      }
    },
    ready,
    restore() {
      restoreStarted ??= doRestore()
      return restoreStarted
    },
    isAuthenticated: () => state.status === 'authenticated',
    token: () => (state.status === 'authenticated' ? state.token : restoringToken),
    owner: () =>
      state.status === 'authenticated'
        ? { kind: 'user', userId: state.user.id }
        : { kind: 'guest' },
    epoch: () => epoch,
    isCurrent: (value) => value === epoch,

    async signIn(payload, via) {
      storage.write(payload)
      transition(authenticated(payload, now()), via)
      await runTasks({ via, userId: payload.user.id })
    },
    signOut,
    expire,

    async ensureValid() {
      if (state.status !== 'authenticated') return false
      const checked = state
      if (isExpiredAt(checked.expiresAt)) {
        expire(checked.token, { redirecting: true })
        return false
      }
      if (checked.verifiedAt !== null && now() - checked.verifiedAt <= VERIFY_TTL_MS) return true

      guardChecks += 1
      try {
        const info = await deps.verify()
        // The identity may have changed while waiting.
        if (!stillSame(checked.token)) return false
        state = {
          ...state,
          user: info.user,
          expiresAt: info.expiresAt,
          verifiedAt: now(),
        }
        const payload = payloadOf(state)
        if (payload) storage.write(payload)
        notify()
        return true
      } catch (error) {
        if (isSessionError(error)) {
          expire(checked.token, { redirecting: true })
          return false
        }
        // The page's own requests decide when the server cannot be reached.
        return stillSame(checked.token)
      } finally {
        guardChecks -= 1
      }
    },

    updateUser(patch) {
      if (state.status !== 'authenticated') return
      state = { ...state, user: { ...state.user, ...patch } }
      const payload = payloadOf(state)
      if (payload) storage.write(payload)
      notify()
    },

    onSignedIn(task) {
      tasks.add(task)
      return () => {
        tasks.delete(task)
      }
    },
    onIdentityChange(listener) {
      identityListeners.add(listener)
      return () => {
        identityListeners.delete(listener)
      }
    },
  }

  // Cross-tab (AUTH-18): another tab signed in, out or switched user.
  storage.watch((raw) => {
    if (state.status === 'restoring') return
    const current = payloadOf(state)
    if (raw === (current ? storage.serialize(current) : null)) return

    const next = storage.parse(raw)
    if (!next) {
      if (state.status === 'authenticated') {
        // The other tab already removed the value, so only the local state changes.
        transition({ status: 'guest', lastSignOut: 'other-tab' }, 'other-tab')
      }
      return
    }
    if (state.status === 'authenticated' && state.token === next.token) {
      // Same session with fresher details (a profile edit in the other tab).
      state = authenticated(next, state.verifiedAt)
      notify()
      return
    }
    // Another user or token: adopt it without running the post-sign-in tasks (that tab ran them).
    transition(authenticated(next, null), 'other-tab')
  })

  return controller
}
