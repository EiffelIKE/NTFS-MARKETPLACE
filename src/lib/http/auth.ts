import axios, { type AxiosInstance } from 'axios'

import { AUTHORIZATION_HEADER, GUEST_CART_HEADER } from '@/contracts'

import { toApiError, type ApiError } from './errors'

export interface AuthProviders {
  getToken(): string | null
  /** The guest cart id spec 06/07 stores; `() => null` until it exists. */
  getGuestCartId(): string | null
  /** A request that carried `sentToken` was refused as expired or unauthenticated. */
  onUnauthorized(sentToken: string): void
}

const BEARER = /^Bearer\s+(\S+)$/i

/** The two 401 codes that mean "the session is gone" (login's `INVALID_CREDENTIALS` is not one). */
export function isSessionError(e: unknown): e is ApiError {
  const error = toApiError(e)
  return (
    error.kind === 'http' &&
    error.status === 401 &&
    (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED')
  )
}

/** The bearer token the failed request actually carried, read back from its Axios config. */
function sentToken(error: ApiError): string | null {
  const cause = error.cause
  if (!axios.isAxiosError(cause)) return null
  const header = cause.config?.headers.get(AUTHORIZATION_HEADER)
  return typeof header === 'string' ? (BEARER.exec(header)?.[1] ?? null) : null
}

/**
 * Auth headers and the 401 hook (AUTH-09, AUTH-13), with no feature imports: the session bridge
 * passes the providers. Returns the function that removes both interceptors.
 *
 * The response interceptor must be registered after spec 00's, so it sees an `ApiError`.
 */
export function installAuthInterceptors(http: AxiosInstance, providers: AuthProviders): () => void {
  const request = http.interceptors.request.use((config) => {
    const token = providers.getToken()
    if (token) {
      config.headers.set(AUTHORIZATION_HEADER, `Bearer ${token}`)
      config.headers.delete(GUEST_CART_HEADER)
      return config
    }
    config.headers.delete(AUTHORIZATION_HEADER)
    const guestCartId = providers.getGuestCartId()
    if (guestCartId) config.headers.set(GUEST_CART_HEADER, guestCartId)
    else config.headers.delete(GUEST_CART_HEADER)
    return config
  })

  const response = http.interceptors.response.use(
    (value) => value,
    (error: unknown) => {
      const apiError = toApiError(error)
      if (isSessionError(apiError)) {
        const token = sentToken(apiError)
        if (token) providers.onUnauthorized(token)
      }
      return Promise.reject(apiError)
    },
  )

  return () => {
    http.interceptors.request.eject(request)
    http.interceptors.response.eject(response)
  }
}
