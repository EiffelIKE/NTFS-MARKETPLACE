import { ERROR_DEFAULTS, type WireErrorCode } from '@/contracts'

interface HttpErrorInit {
  message?: string
  fields?: Record<string, string[]>
  details?: unknown
}

/** Thrown by domain rules; the pipeline turns it into the error envelope (spec 02 §8.1). */
export class HttpError extends Error {
  readonly status: number
  readonly code: WireErrorCode
  readonly fields: Record<string, string[]> | undefined
  readonly details: unknown

  constructor(code: WireErrorCode, init: HttpErrorInit = {}) {
    super(init.message ?? ERROR_DEFAULTS[code].message)
    this.name = 'HttpError'
    this.code = code
    this.status = ERROR_DEFAULTS[code].status
    this.fields = init.fields
    this.details = init.details
  }
}

/** A 422 for one field. */
export function fieldError(field: string, message: string): HttpError {
  return new HttpError('VALIDATION_FAILED', { fields: { [field]: [message] } })
}
