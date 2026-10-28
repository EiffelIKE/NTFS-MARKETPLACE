import axios from 'axios'

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'cancelled' | 'unknown'

interface ApiErrorInit {
  status?: number | undefined
  data?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  /** Raw response body; spec 02 parses it into the error envelope. */
  readonly data: unknown

  constructor(kind: ApiErrorKind, message: string, init: ApiErrorInit = {}) {
    super(message, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = init.status
    this.data = init.data
  }
}

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT'])

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  if (axios.isCancel(e)) return new ApiError('cancelled', 'Request cancelled', { cause: e })
  if (axios.isAxiosError(e)) {
    if (e.code === 'ERR_CANCELED') {
      return new ApiError('cancelled', 'Request cancelled', { cause: e })
    }
    if (e.code !== undefined && TIMEOUT_CODES.has(e.code)) {
      return new ApiError('timeout', 'Request timed out', { cause: e })
    }
    if (e.response) {
      return new ApiError('http', `Request failed with status ${String(e.response.status)}`, {
        status: e.response.status,
        data: e.response.data,
        cause: e,
      })
    }
    if (e.request !== undefined) return new ApiError('network', 'Network error', { cause: e })
  }
  const message = e instanceof Error ? e.message : 'Unknown error'
  return new ApiError('unknown', message, { cause: e })
}

/** Only transient failures are worth retrying: network, timeout, 408, 429 and 5xx. */
export function isRetryable(e: unknown): boolean {
  const error = toApiError(e)
  switch (error.kind) {
    case 'network':
    case 'timeout':
      return true
    case 'http':
      return error.status === 408 || error.status === 429 || (error.status ?? 0) >= 500
    case 'cancelled':
    case 'unknown':
      return false
  }
}
