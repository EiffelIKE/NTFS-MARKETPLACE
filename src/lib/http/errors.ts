import axios from 'axios'

import {
  ErrorEnvelope,
  errorDetails,
  type ApiErrorCode,
  type DetailsOf,
  type OperationId,
} from '@/contracts'

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'cancelled' | 'contract' | 'unknown'

interface ApiErrorInit {
  status?: number | undefined
  data?: unknown
  cause?: unknown
  code?: ApiErrorCode | undefined
  fields?: Record<string, string[]> | undefined
  details?: unknown
  operation?: OperationId | undefined
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  /** Raw response body, kept for diagnostics. */
  readonly data: unknown
  /** `http`: the parsed envelope code, or `UNKNOWN` when the body is missing or malformed. */
  readonly code: ApiErrorCode | undefined
  /** Per-field messages, keyed by dotted path. */
  readonly fields: Record<string, string[]> | undefined
  /** Shape per code, see `errorDetails`; `isApiError(e, code)` narrows it. */
  readonly details: unknown
  readonly operation: OperationId | undefined

  constructor(kind: ApiErrorKind, message: string, init: ApiErrorInit = {}) {
    super(message, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = init.status
    this.data = init.data
    this.code = init.code
    this.fields = init.fields
    this.details = init.details
    this.operation = init.operation
  }

  /** Same error tagged with the operation that produced it. */
  withOperation(operation: OperationId): ApiError {
    return new ApiError(this.kind, this.message, {
      status: this.status,
      data: this.data,
      cause: this.cause,
      code: this.code,
      fields: this.fields,
      details: this.details,
      operation,
    })
  }
}

/** Narrows to an `ApiError`, and with `code` also to that code and its typed `details`. */
export function isApiError<C extends ApiErrorCode>(
  e: unknown,
  code?: C,
): e is ApiError & { code: C; details: DetailsOf<C> } {
  return e instanceof ApiError && (code === undefined || e.code === code)
}

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT'])

const KIND_MESSAGES = {
  network: 'Sem conexão com o servidor. Verifique sua internet.',
  timeout: 'A resposta demorou demais. Tente novamente.',
  cancelled: 'Requisição cancelada.',
  contract: 'Resposta inesperada do servidor.',
  unknown: 'Algo deu errado. Tente novamente.',
} as const

const HTTP_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.'

/** Reads the error envelope; anything that is not a valid envelope becomes `UNKNOWN`. */
function fromResponse(status: number, data: unknown, cause: unknown): ApiError {
  const envelope = ErrorEnvelope.safeParse(data)
  if (envelope.success) {
    const { code, message, fields, details } = envelope.data.error
    const schema = errorDetails(code)
    const parsed = schema?.safeParse(details)
    // A code whose details do not match its schema is a broken contract: do not narrow on it.
    if (parsed?.success === false) {
      return new ApiError('http', HTTP_MESSAGE, { status, data, cause, code: 'UNKNOWN' })
    }
    return new ApiError('http', message, {
      status,
      data,
      cause,
      code,
      fields,
      details: parsed?.data,
    })
  }
  return new ApiError('http', HTTP_MESSAGE, { status, data, cause, code: 'UNKNOWN' })
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  if (axios.isCancel(e)) return new ApiError('cancelled', KIND_MESSAGES.cancelled, { cause: e })
  if (axios.isAxiosError(e)) {
    if (e.code === 'ERR_CANCELED') {
      return new ApiError('cancelled', KIND_MESSAGES.cancelled, { cause: e })
    }
    if (e.code !== undefined && TIMEOUT_CODES.has(e.code)) {
      return new ApiError('timeout', KIND_MESSAGES.timeout, { cause: e })
    }
    if (e.response) return fromResponse(e.response.status, e.response.data, e)
    if (e.request !== undefined) return new ApiError('network', KIND_MESSAGES.network, { cause: e })
  }
  const message = e instanceof Error ? e.message : KIND_MESSAGES.unknown
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
    case 'contract':
    case 'unknown':
      return false
  }
}
