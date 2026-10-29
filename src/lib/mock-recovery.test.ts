import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MOCK_HEALTH_HEADER,
  MockBootError,
  RELOAD_GUARD_KEY,
  RELOAD_WINDOW_MS,
  RESYNC_GUARD_KEY,
  RESYNC_WINDOW_MS,
  bootWithRecovery,
  browserResync,
  canAutoReload,
  claimAutoReload,
  hasOrphanedRegistration,
  pingMock,
  recoverOnce,
  releaseAutoReload,
  resetMockWorkerAndReload,
  toBootError,
  unregisterMockWorkers,
  withTimeout,
  type GuardStorage,
  type WorkerContainerLike,
} from './mock-recovery'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function memoryGuard(initial?: string): GuardStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(RELOAD_GUARD_KEY, initial)
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe('withTimeout', () => {
  it('rejects when the work never settles', async () => {
    vi.useFakeTimers()
    const result = withTimeout(new Promise<void>(() => undefined), 1000, () => new Error('late'))
    const assertion = expect(result).rejects.toThrow('late')
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('passes the value and the error of work that settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, () => new Error('late'))).resolves.toBe(7)
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 1000, () => new Error('late')),
    ).rejects.toThrow('boom')
  })

  it('leaves no timer behind once the work settles', async () => {
    vi.useFakeTimers()
    await withTimeout(Promise.resolve(), 1000, () => new Error('late'))
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('reload guard', () => {
  it('allows the first reload and blocks a second one inside the window', () => {
    const storage = memoryGuard()
    expect(claimAutoReload(storage, 1_000)).toBe(true)
    expect(claimAutoReload(storage, 1_000 + RELOAD_WINDOW_MS - 1)).toBe(false)
    expect(claimAutoReload(storage, 1_000 + RELOAD_WINDOW_MS)).toBe(true)
  })

  it('treats an unreadable value or a clock that went backwards as free', () => {
    expect(canAutoReload('garbage', 5_000)).toBe(true)
    expect(canAutoReload('9000', 5_000)).toBe(true)
    expect(canAutoReload(null, 5_000)).toBe(true)
  })

  it('never reloads when the storage throws, so a loop is impossible', () => {
    const broken: GuardStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    expect(claimAutoReload(broken, 1)).toBe(false)
  })

  it('can be released by the manual reload', () => {
    const storage = memoryGuard('1000')
    releaseAutoReload(storage)
    expect(claimAutoReload(storage, 1_001)).toBe(true)
  })
})

describe('manual and watchdog reloads', () => {
  it('the button unregisters the worker, reloads, and spends the automatic reload', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    const storage = memoryGuard('1000')
    const mock = registration('https://app.test/mockServiceWorker.js')
    const reload = vi.fn()
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('navigator', { serviceWorker: container([mock]) })
    vi.stubGlobal('location', { reload })
    await resetMockWorkerAndReload()
    expect(mock.unregister).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
    expect(storage.data.get(RELOAD_GUARD_KEY)).toBe('5000')
    expect(claimAutoReload(storage, 5001)).toBe(false)
  })

  it('the watchdog reloads without unregistering the worker other tabs use', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    // A boot recovery a moment ago does not stop the watchdog: they keep separate guards.
    const storage = memoryGuard('4000')
    const mock = registration('https://app.test/mockServiceWorker.js')
    const reload = vi.fn()
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('navigator', { serviceWorker: container([mock]) })
    vi.stubGlobal('location', { reload })
    await expect(browserResync()).resolves.toBe('reloading')
    expect(mock.unregister).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledOnce()
    expect(storage.data.get(RESYNC_GUARD_KEY)).toBe('5000')
    // Bounded too: a second loss inside the window gives up instead of reloading again.
    vi.setSystemTime(5000 + RESYNC_WINDOW_MS - 1)
    await expect(browserResync()).resolves.toBe('gave-up')
    expect(reload).toHaveBeenCalledOnce()
  })
})

describe('recoverOnce', () => {
  it('cleans up, then reloads, when the guard allows it', async () => {
    const order: string[] = []
    const outcome = await recoverOnce({
      claim: () => true,
      cleanup: () => {
        order.push('cleanup')
        return Promise.resolve()
      },
      reload: () => order.push('reload'),
    })
    expect(outcome).toBe('reloading')
    expect(order).toEqual(['cleanup', 'reload'])
  })

  it('gives up without touching anything when the tab already reloaded', async () => {
    const cleanup = vi.fn(() => Promise.resolve())
    const reload = vi.fn()
    const outcome = await recoverOnce({ claim: () => false, cleanup, reload })
    expect(outcome).toBe('gave-up')
    expect(cleanup).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads even when the cleanup fails', async () => {
    const reload = vi.fn()
    await recoverOnce({ claim: () => true, cleanup: () => Promise.reject(new Error('x')), reload })
    expect(reload).toHaveBeenCalledOnce()
  })
})

describe('bootWithRecovery', () => {
  const deps = (overrides: Partial<Parameters<typeof bootWithRecovery>[0]> = {}) => ({
    start: () => Promise.resolve(),
    ping: () => Promise.resolve(true),
    recover: vi.fn(() => Promise.resolve<'reloading' | 'gave-up'>('gave-up')),
    graceMs: 10,
    ...overrides,
  })

  it('resolves, without recovering, when the worker starts and intercepts', async () => {
    const options = deps()
    await expect(bootWithRecovery(options)).resolves.toBeUndefined()
    expect(options.recover).not.toHaveBeenCalled()
  })

  it('never hangs: a start that does not settle times out and reports it', async () => {
    vi.useFakeTimers()
    const options = deps({ start: () => new Promise<void>(() => undefined), timeoutMs: 500 })
    const result = bootWithRecovery(options)
    const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(500)
    await assertion
    expect(options.recover).toHaveBeenCalledOnce()
  })

  it('reports a registration abort with MSW reason and tries to recover', async () => {
    const reason = '[MSW] Failed to register the Service Worker: Operation has been aborted'
    const options = deps({ start: () => Promise.reject(new Error(reason)) })
    await expect(bootWithRecovery(options)).rejects.toMatchObject({
      code: 'start-failed',
      message: reason,
    })
    expect(options.recover).toHaveBeenCalledOnce()
  })

  it('rejects a worker that started but does not intercept', async () => {
    const options = deps({ ping: () => Promise.resolve(false) })
    await expect(bootWithRecovery(options)).rejects.toMatchObject({ code: 'unreachable' })
    expect(options.recover).toHaveBeenCalledOnce()
  })

  it('still settles when a reload was requested but the page did not leave', async () => {
    vi.useFakeTimers()
    const options = deps({
      start: () => Promise.reject(new Error('aborted')),
      recover: vi.fn(() => Promise.resolve<'reloading' | 'gave-up'>('reloading')),
      graceMs: 2000,
    })
    const result = bootWithRecovery(options)
    const assertion = expect(result).rejects.toBeInstanceOf(MockBootError)
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
  })
})

describe('toBootError', () => {
  it('keeps the reason of any error and passes mock errors through', () => {
    expect(toBootError(new Error('why')).message).toBe('why')
    expect(toBootError('text').message).toBe('text')
    const own = new MockBootError('lost', 'gone')
    expect(toBootError(own)).toBe(own)
  })
})

function registration(scriptURL: string | null) {
  const unregister = vi.fn(() => Promise.resolve(true))
  return {
    unregister,
    active: scriptURL === null ? null : ({ scriptURL } as ServiceWorker),
    waiting: null,
    installing: null,
  }
}

function container(
  registrations: ReturnType<typeof registration>[],
  controller: ServiceWorker | null = null,
): WorkerContainerLike {
  return { controller, getRegistrations: () => Promise.resolve(registrations) }
}

describe('stale registrations', () => {
  it('unregisters mock workers and stale empty registrations, and leaves others alone', async () => {
    const mock = registration('https://app.test/mockServiceWorker.js')
    const empty = registration(null)
    const other = registration('https://app.test/other-sw.js')
    const removed = await unregisterMockWorkers(container([mock, empty, other]))
    expect(removed).toBe(2)
    expect(mock.unregister).toHaveBeenCalledOnce()
    expect(empty.unregister).toHaveBeenCalledOnce()
    expect(other.unregister).not.toHaveBeenCalled()
  })

  it('does not hang when the registrations never come back', async () => {
    vi.useFakeTimers()
    const stuck: WorkerContainerLike = {
      controller: null,
      getRegistrations: () => new Promise(() => undefined),
    }
    const result = unregisterMockWorkers(stuck, 100)
    await vi.advanceTimersByTimeAsync(100)
    await expect(result).resolves.toBe(0)
  })

  it('detects a mock registration that does not control the page', async () => {
    const mock = registration('https://app.test/mockServiceWorker.js')
    expect(await hasOrphanedRegistration(container([mock]))).toBe(true)
    expect(await hasOrphanedRegistration(container([mock], {} as ServiceWorker))).toBe(false)
    expect(await hasOrphanedRegistration(container([]))).toBe(false)
  })
})

describe('pingMock', () => {
  const marked = { headers: new Headers({ [MOCK_HEALTH_HEADER]: '1' }) }

  it('is true when the response carries the marker', async () => {
    expect(await pingMock('/api/__mock/health', { fetcher: () => Promise.resolve(marked) })).toBe(
      true,
    )
  })

  it('is false when the request reached the network (HTML, no marker)', async () => {
    const fetcher = vi.fn(() => Promise.resolve({ headers: new Headers() }))
    expect(await pingMock('/api/__mock/health', { fetcher, attempts: 2 })).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('retries once, so a worker that is a moment late still counts', async () => {
    const fetcher = vi
      .fn<() => Promise<{ headers: Headers }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(marked)
    expect(await pingMock('/x', { fetcher })).toBe(true)
  })

  it('aborts a probe that never answers', async () => {
    vi.useFakeTimers()
    const fetcher = (_url: string, init: RequestInit) =>
      new Promise<never>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })
    const result = pingMock('/x', { fetcher, attempts: 1, timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)
    await expect(result).resolves.toBe(false)
  })
})
