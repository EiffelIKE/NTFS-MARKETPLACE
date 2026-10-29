// Boot recovery for the in-browser mock API (spec 13, "Post-deploy fix: SW boot recovery").
//
// The mock API lives in a Service Worker, and a Service Worker can be taken away from a page at any
// moment: Lighthouse and DevTools "Clear site data" unregister it, a registration can be aborted
// while it is in flight, a worker can sit in `installing` or turn `redundant`, and a page can lose
// its controller. MSW waits for all of that with no timeout, so the shell-first gate
// (`backend-ready.ts`) never resolved and every request stayed pending. Everything here is bounded
// and dependency-free (no msw import), so the entry chunk and the error screen can use it.

/** Where the mock worker is served from (`public/mockServiceWorker.js`). */
export const MOCK_WORKER_URL = '/mockServiceWorker.js'

/** `worker.start()` normally takes well under a second; a cold, throttled mobile run, a few. */
export const BOOT_TIMEOUT_MS = 15_000
/** One interception probe. */
export const PING_TIMEOUT_MS = 3_000
/** Between two automatic reloads of the same tab. */
export const RELOAD_WINDOW_MS = 30_000
/** After asking for a reload, how long to wait for the page to leave before reporting the failure. */
export const RELOAD_GRACE_MS = 5_000

export const RELOAD_GUARD_KEY = 'kurio.mock.recovery'
/** Between two watchdog reloads of the same tab (see `browserResync`). */
export const RESYNC_WINDOW_MS = 10_000
export const RESYNC_GUARD_KEY = 'kurio.mock.resync'

export type MockFailureCode = 'timeout' | 'unreachable' | 'start-failed' | 'lost'

/** A mock boot failure the error screen can describe. Messages are user-facing (pt-BR). */
export class MockBootError extends Error {
  readonly code: MockFailureCode

  constructor(code: MockFailureCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MockBootError'
    this.code = code
  }
}

export function timeoutError(ms: number): MockBootError {
  return new MockBootError(
    'timeout',
    `O service worker da API simulada não respondeu em ${String(Math.round(ms / 1000))} s.`,
  )
}

export function unreachableError(): MockBootError {
  return new MockBootError(
    'unreachable',
    'O service worker foi iniciado, mas não está interceptando as requisições da página.',
  )
}

export function lostError(): MockBootError {
  return new MockBootError('lost', 'O service worker da API simulada deixou de controlar a página.')
}

/** Keeps the original reason (MSW's text) and tags it, so the screen still shows what failed. */
export function toBootError(error: unknown): MockBootError {
  if (error instanceof MockBootError) return error
  const reason = error instanceof Error ? error.message : String(error)
  return new MockBootError('start-failed', reason, { cause: error })
}

/** Rejects with `onTimeout()` when `work` has not settled after `ms`. The timer never outlives it. */
export function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(onTimeout())
    }, ms)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

// --- Reload guard: at most one automatic reload per tab per window, so recovery can never loop. ---

/** `raw` is the timestamp stored by the previous automatic reload, or `null`. */
export function canAutoReload(raw: string | null, now: number, windowMs = RELOAD_WINDOW_MS) {
  if (raw === null) return true
  const at = Number(raw)
  // An unreadable value or a clock that went backwards must not block recovery for good.
  if (!Number.isFinite(at) || at > now) return true
  return now - at >= windowMs
}

export interface GuardStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** True, and records the reload, when this tab may reload now. Storage that throws means no reload. */
export function claimAutoReload(
  storage: GuardStorage,
  now: number,
  key = RELOAD_GUARD_KEY,
  windowMs = RELOAD_WINDOW_MS,
): boolean {
  try {
    if (!canAutoReload(storage.getItem(key), now, windowMs)) return false
    storage.setItem(key, String(now))
    return true
  } catch {
    return false
  }
}

export function releaseAutoReload(storage: GuardStorage): void {
  try {
    storage.removeItem(RELOAD_GUARD_KEY)
  } catch {
    // nothing to release
  }
}

// --- Service Worker registrations ---

type RegistrationLike = Pick<ServiceWorkerRegistration, 'unregister' | 'active' | 'waiting'> & {
  installing: ServiceWorker | null
}

export interface WorkerContainerLike {
  controller: ServiceWorker | null
  getRegistrations(): Promise<readonly RegistrationLike[]>
}

/** `undefined` outside a browser, and in one without Service Workers (insecure origin). */
function browserWorkerContainer(): ServiceWorkerContainer | undefined {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined
  return navigator.serviceWorker
}

function isMockRegistration(registration: RegistrationLike): boolean {
  const worker = registration.active ?? registration.waiting ?? registration.installing
  // A registration whose workers are all gone is stale too.
  if (worker === null) return true
  try {
    return new URL(worker.scriptURL).pathname === MOCK_WORKER_URL
  } catch {
    return false
  }
}

/** Unregisters every mock worker registration of the origin; resolves with how many were removed. */
export async function unregisterMockWorkers(
  container: WorkerContainerLike | undefined = browserWorkerContainer(),
  timeoutMs = 3_000,
): Promise<number> {
  if (container === undefined) return 0
  try {
    return await withTimeout(
      container.getRegistrations().then(async (registrations) => {
        const stale = registrations.filter(isMockRegistration)
        await Promise.all(stale.map((registration) => registration.unregister()))
        return stale.length
      }),
      timeoutMs,
      () => timeoutError(timeoutMs),
    )
  } catch {
    return 0
  }
}

/**
 * A mock registration exists but this page is not controlled by it: a hard reload, or a worker the
 * browser dropped. MSW would `location.reload()` and carry on (and loop if the controller never
 * comes), so the boot removes the registration and registers a fresh one in this very load.
 */
export async function hasOrphanedRegistration(
  container: WorkerContainerLike | undefined = browserWorkerContainer(),
  timeoutMs = 3_000,
): Promise<boolean> {
  if (container === undefined) return false
  if (container.controller !== null) return false
  try {
    const registrations = await withTimeout(container.getRegistrations(), timeoutMs, () =>
      timeoutError(timeoutMs),
    )
    return registrations.some(isMockRegistration)
  } catch {
    return false
  }
}

// --- Interception probe ---

/** The response header the mock health handler sets; a real network answer never carries it. */
export const MOCK_HEALTH_HEADER = 'x-kurio-mock'

/**
 * Asks the worker for its health endpoint. Without a controlling worker the request reaches the
 * network (the SPA rewrite answers HTML), which has no marker header: that is how "started but not
 * intercepting" is told apart from a working mock.
 */
export async function pingMock(
  url: string,
  options: {
    attempts?: number
    timeoutMs?: number
    fetcher?: (input: string, init: RequestInit) => Promise<Pick<Response, 'headers'>>
  } = {},
): Promise<boolean> {
  const { attempts = 2, timeoutMs = PING_TIMEOUT_MS } = options
  // The shared Axios instance would wait on the very gate this probe helps to settle.
  // eslint-disable-next-line no-restricted-globals
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init))
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    try {
      const response = await fetcher(url, { cache: 'no-store', signal: controller.signal })
      if (response.headers.get(MOCK_HEALTH_HEADER) === '1') return true
    } catch {
      // aborted or offline: try again
    } finally {
      clearTimeout(timer)
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

// --- The recovery policy ---

export interface RecoveryDeps {
  /** Records an automatic reload; false when this tab already reloaded within the window. */
  claim(): boolean
  /** Removes the stale registrations, so the next load registers a clean worker. */
  cleanup(): Promise<unknown>
  reload(): void
}

/** Self-heal once: clean up and reload, or give up (the caller shows the error screen). */
export async function recoverOnce(deps: RecoveryDeps): Promise<'reloading' | 'gave-up'> {
  if (!deps.claim()) return 'gave-up'
  await deps.cleanup().catch(() => undefined)
  deps.reload()
  return 'reloading'
}

export interface BootDeps {
  /** `worker.start()` plus whatever else makes the mock ready. */
  start(): Promise<void>
  ping(): Promise<boolean>
  recover(): Promise<'reloading' | 'gave-up'>
  timeoutMs?: number
  graceMs?: number
}

/**
 * Starts the mock with a deadline, checks it really intercepts, and on failure recovers once. It
 * always settles: resolves when the mock works, rejects when it cannot be made to work (including
 * when a reload was requested but the page did not leave).
 */
export async function bootWithRecovery(deps: BootDeps): Promise<void> {
  const { timeoutMs = BOOT_TIMEOUT_MS, graceMs = RELOAD_GRACE_MS } = deps
  try {
    await withTimeout(deps.start(), timeoutMs, () => timeoutError(timeoutMs))
    if (!(await deps.ping())) throw unreachableError()
  } catch (error) {
    const failure = toBootError(error)
    if ((await deps.recover()) === 'reloading') {
      await new Promise((resolve) => setTimeout(resolve, graceMs))
    }
    throw failure
  }
}

// --- Browser wiring ---

function browserGuardStorage(): GuardStorage | null {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

/** The recovery used at boot: cleanup, then one guarded reload. */
export function browserRecovery(): Promise<'reloading' | 'gave-up'> {
  const storage = browserGuardStorage()
  return recoverOnce({
    claim: () => storage !== null && claimAutoReload(storage, Date.now()),
    cleanup: () => unregisterMockWorkers(),
    reload: () => {
      globalThis.location.reload()
    },
  })
}

/**
 * The watchdog's recovery: one guarded reload, and the registration is left alone. The usual cause
 * is another tab: Lighthouse clears the origin's workers, the load it audits registers a fresh one,
 * and `clients.claim()` hands every open tab to it. MSW only answers a tab that activated itself
 * with the worker controlling it, so this tab's requests now pass through to the network. A reload
 * activates it with that worker. Unregistering it instead would break the tabs that already use
 * it, and their own recovery would then break this one, back and forth.
 */
export function browserResync(): Promise<'reloading' | 'gave-up'> {
  const storage = browserGuardStorage()
  return recoverOnce({
    claim: () =>
      storage !== null && claimAutoReload(storage, Date.now(), RESYNC_GUARD_KEY, RESYNC_WINDOW_MS),
    cleanup: () => Promise.resolve(),
    reload: () => {
      globalThis.location.reload()
    },
  })
}

/**
 * The "Recarregar página" button: a manual retry always goes ahead and requests a fresh worker.
 * Spend the automatic reload too: if the browser still blocks workers, return to the error screen
 * instead of following this explicit retry with another automatic reload.
 */
export async function resetMockWorkerAndReload(): Promise<void> {
  const storage = browserGuardStorage()
  if (storage !== null) {
    releaseAutoReload(storage)
    claimAutoReload(storage, Date.now())
  }
  await unregisterMockWorkers()
  globalThis.location.reload()
}

/**
 * Keeps checking, once the mock is up, that the worker still answers: Lighthouse or "Clear site
 * data" can take it away from a page that is already open, and every later request would then reach
 * a server that does not exist. The check runs when the tab comes back, not on a timer.
 */
export function watchMockWorker(options: {
  ping(): Promise<boolean>
  onLost(error: MockBootError): void
}): void {
  const container = browserWorkerContainer()
  if (container === undefined) return
  let checking = false
  const check = () => {
    if (checking) return
    checking = true
    void options
      .ping()
      .then(async (alive) => {
        if (alive) return
        if ((await browserResync()) === 'gave-up') options.onLost(lostError())
      })
      .finally(() => {
        checking = false
      })
  }
  container.addEventListener('controllerchange', check)
  globalThis.addEventListener('focus', check)
  // Back/forward cache restore: the page comes back without running its boot again.
  globalThis.addEventListener('pageshow', (event) => {
    if (event.persisted) check()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}
