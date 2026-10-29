import { afterAll, beforeAll, beforeEach, vi } from 'vitest'

import { authApi } from '@/api'
import { OPERATIONS, type OperationId } from '@/contracts'
import { http } from '@/lib/http/client'
import { ApiError } from '@/lib/http/errors'
import { CREDENTIALS, type CredentialName } from '@/mocks/fixtures/credentials'
import { createMockServer, type MockServer } from '@/mocks/node'

// Shared setup for the contract tests (spec 02 §13): every operation runs through the real `api/*`
// function and the real Axios client, against the same handlers the browser worker uses.

let token: string | undefined
let guestCartId: string | undefined

/** Stands in for spec 04's interceptor: bearer or guest header, never both. */
function installAuthHeaders() {
  const id = http.interceptors.request.use((config) => {
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    else if (guestCartId) config.headers.set('X-Guest-Cart-Id', guestCartId)
    return config
  })
  return () => {
    http.interceptors.request.eject(id)
  }
}

/** Acts as `name`, a raw token, or a guest cart. No arguments act as an anonymous guest. */
export function as(next?: string, guest?: string): void {
  token = next
  guestCartId = guest
}

/** Logs in with a fixture user and returns the token (it does not switch to it). */
export async function loginAs(name: CredentialName): Promise<string> {
  const { email, password } = CREDENTIALS[name]
  const previous = [token, guestCartId] as const
  as()
  try {
    return (await authApi.login({ email, password })).token
  } finally {
    as(...previous)
  }
}

/** Switches the acting user to a fixture user and returns the token. */
export async function actAs(name: CredentialName): Promise<string> {
  const next = await loginAs(name)
  as(next)
  return next
}

/** Runs `fn` and returns the `ApiError` it rejects with; fails if it does not reject. */
export async function rejection(fn: () => Promise<unknown>): Promise<ApiError> {
  try {
    await fn()
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Expected the call to reject')
}

/** Last logged request of an operation, to check method and path against the contract table. */
export function lastRequest(mock: MockServer, op: OperationId) {
  const entries = mock.control.requests({ op })
  return entries[entries.length - 1]
}

/** Registers the server lifecycle and a fresh seed for every test. */
export function serveMockApi(): MockServer {
  const mock = createMockServer()
  let removeHeaders: (() => void) | undefined
  beforeAll(() => {
    mock.server.listen({ onUnhandledRequest: 'error' })
    removeHeaders = installAuthHeaders()
  })
  beforeEach(() => {
    mock.runtime.useScenario('default')
    // No simulated latency unless a test asks for it: tests with real timers stay fast.
    mock.control.configure({ latency: { kind: 'none' } })
    mock.control.clearRequests()
    as()
  })
  afterAll(() => {
    mock.runtime.settlement.stop()
    removeHeaders?.()
    mock.server.close()
  })
  return mock
}

export { OPERATIONS }

/**
 * Fake `setTimeout` and `Date` for latency, Axios timeouts and settlement. The clock also ticks
 * with real time (`shouldAdvanceTime`), because MSW's interceptors schedule their own 0 ms timers.
 */
export function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true })
}
