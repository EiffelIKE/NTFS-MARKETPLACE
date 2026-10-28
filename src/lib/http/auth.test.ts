import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { installAuthInterceptors, isSessionError, type AuthProviders } from './auth'
import { ApiError, toApiError } from './errors'

interface Reply {
  status: number
  code?: string
}

/** An instance with spec 00's error mapping, an adapter that records requests, and ours on top. */
function setup(
  reply: Reply = { status: 200 },
  providers: Partial<AuthProviders> = {},
  onSend?: () => void,
) {
  const seen: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = (config) => {
    seen.push(config)
    onSend?.()
    const response = {
      status: reply.status,
      statusText: '',
      headers: {},
      config,
      data: reply.code ? { error: { code: reply.code, message: 'x' } } : {},
    }
    if (reply.status < 400) return Promise.resolve(response)
    return Promise.reject(new AxiosError('fail', 'ERR_BAD_REQUEST', config, {}, response))
  }
  const http: AxiosInstance = axios.create({ adapter })
  http.interceptors.response.use(
    (r) => r,
    (e: unknown) => Promise.reject(toApiError(e)),
  )
  const onUnauthorized = vi.fn()
  const all: AuthProviders = {
    getToken: () => null,
    getGuestCartId: () => null,
    onUnauthorized,
    ...providers,
  }
  installAuthInterceptors(http, all)
  return { http, seen, onUnauthorized }
}

const header = (config: InternalAxiosRequestConfig | undefined, name: string) =>
  config?.headers.get(name) ?? null

describe('auth headers', () => {
  it('sends the bearer token and never the guest cart id (AUTH-09)', async () => {
    const { http, seen } = setup(
      { status: 200 },
      { getToken: () => 'tok_1', getGuestCartId: () => 'guest_1' },
    )
    await http.get('/x', { headers: { 'X-Guest-Cart-Id': 'stale' } })
    expect(header(seen[0], 'Authorization')).toBe('Bearer tok_1')
    expect(header(seen[0], 'X-Guest-Cart-Id')).toBeNull()
  })

  it('sends the guest cart id only without a token', async () => {
    const { http, seen } = setup({ status: 200 }, { getGuestCartId: () => 'guest_1' })
    await http.get('/x')
    expect(header(seen[0], 'Authorization')).toBeNull()
    expect(header(seen[0], 'X-Guest-Cart-Id')).toBe('guest_1')
  })

  it('sends neither header for a plain guest', async () => {
    const { http, seen } = setup()
    await http.get('/x')
    expect(header(seen[0], 'Authorization')).toBeNull()
    expect(header(seen[0], 'X-Guest-Cart-Id')).toBeNull()
  })

  it('reads the token at request time, so a new session is used at once', async () => {
    let token: string | null = 'tok_a'
    const { http, seen } = setup({ status: 200 }, { getToken: () => token })
    await http.get('/x')
    token = 'tok_b'
    await http.get('/x')
    expect(seen.map((c) => header(c, 'Authorization'))).toEqual(['Bearer tok_a', 'Bearer tok_b'])
  })
})

describe('401 handling (AUTH-13)', () => {
  it.each(['SESSION_EXPIRED', 'UNAUTHENTICATED'])(
    '%s with the sent token calls onUnauthorized once and rethrows',
    async (code) => {
      const { http, onUnauthorized } = setup({ status: 401, code }, { getToken: () => 'tok_1' })
      const failure = await http.get('/x').catch((e: unknown) => e)
      expect(failure).toBeInstanceOf(ApiError)
      expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith('tok_1')
    },
  )

  it('ignores INVALID_CREDENTIALS (a wrong password is not an expiry)', async () => {
    const { http, onUnauthorized } = setup(
      { status: 401, code: 'INVALID_CREDENTIALS' },
      { getToken: () => 'tok_1' },
    )
    await expect(http.post('/auth/login')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('ignores a 401 for a request that carried no token', async () => {
    const { http, onUnauthorized } = setup({ status: 401, code: 'UNAUTHENTICATED' })
    await expect(http.get('/x')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('reports the token the request carried, not the current one', async () => {
    let token: string | null = 'tok_old'
    // The identity changes while the request is in flight.
    const { http, onUnauthorized } = setup(
      { status: 401, code: 'SESSION_EXPIRED' },
      { getToken: () => token },
      () => {
        token = 'tok_new'
      },
    )
    await http.get('/x').catch(() => undefined)
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith('tok_old')
  })

  it('does not call it for other statuses', async () => {
    const { http, onUnauthorized } = setup(
      { status: 403, code: 'FORBIDDEN' },
      { getToken: () => 'tok_1' },
    )
    await expect(http.get('/x')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('isSessionError', () => {
  it('matches only the two session codes on a 401', () => {
    const make = (status: number, code: string) =>
      new ApiError('http', 'x', { status, code: code as never })
    expect(isSessionError(make(401, 'SESSION_EXPIRED'))).toBe(true)
    expect(isSessionError(make(401, 'UNAUTHENTICATED'))).toBe(true)
    expect(isSessionError(make(401, 'INVALID_CREDENTIALS'))).toBe(false)
    expect(isSessionError(make(403, 'FORBIDDEN'))).toBe(false)
    expect(isSessionError(new Error('x'))).toBe(false)
  })
})
