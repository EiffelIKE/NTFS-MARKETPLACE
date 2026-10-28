import { AxiosError, AxiosHeaders, CanceledError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { ApiError, isApiError, isRetryable, toApiError } from './errors'

function httpError(status: number, data: unknown = { message: 'x' }) {
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } satisfies AxiosResponse
  return new AxiosError('fail', 'ERR_BAD_RESPONSE', undefined, {}, response)
}

describe('toApiError', () => {
  it('maps cancellations', () => {
    expect(toApiError(new CanceledError()).kind).toBe('cancelled')
    expect(toApiError(new AxiosError('x', 'ERR_CANCELED')).kind).toBe('cancelled')
  })

  it('maps timeouts', () => {
    expect(toApiError(new AxiosError('x', 'ECONNABORTED', undefined, {})).kind).toBe('timeout')
    expect(toApiError(new AxiosError('x', 'ETIMEDOUT', undefined, {})).kind).toBe('timeout')
  })

  it('maps responses to http with status and raw body', () => {
    const error = toApiError(httpError(422, { code: 'INVALID' }))
    expect(error).toMatchObject({ kind: 'http', status: 422, data: { code: 'INVALID' } })
  })

  it('maps a request without response to network', () => {
    expect(toApiError(new AxiosError('x', 'ERR_NETWORK', undefined, {})).kind).toBe('network')
  })

  it('maps anything else to unknown and keeps the message', () => {
    const error = toApiError(new Error('boom'))
    expect(error).toMatchObject({ kind: 'unknown', message: 'boom', status: undefined })
    expect(toApiError('nope').kind).toBe('unknown')
  })

  it('returns an ApiError unchanged', () => {
    const original = new ApiError('http', 'x', { status: 500 })
    expect(toApiError(original)).toBe(original)
  })
})

describe('isRetryable', () => {
  it.each([408, 429, 500, 502, 503])('retries HTTP %i', (status) => {
    expect(isRetryable(httpError(status))).toBe(true)
  })

  it.each([400, 401, 403, 404, 409, 422])('does not retry HTTP %i', (status) => {
    expect(isRetryable(httpError(status))).toBe(false)
  })

  it('retries network and timeout failures', () => {
    expect(isRetryable(new AxiosError('x', 'ERR_NETWORK', undefined, {}))).toBe(true)
    expect(isRetryable(new AxiosError('x', 'ECONNABORTED', undefined, {}))).toBe(true)
  })

  it('does not retry cancellations or unknown errors', () => {
    expect(isRetryable(new CanceledError())).toBe(false)
    expect(isRetryable(new Error('boom'))).toBe(false)
  })
})

describe('error envelope', () => {
  const envelope = (code: string, extra: Record<string, unknown> = {}) => ({
    error: { code, message: 'Mensagem do servidor.', ...extra },
  })

  it('reads code, message and fields from a valid envelope', () => {
    const error = toApiError(
      httpError(
        422,
        envelope('VALIDATION_FAILED', { fields: { 'collector.email': ['E-mail inválido.'] } }),
      ),
    )
    expect(error).toMatchObject({
      kind: 'http',
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Mensagem do servidor.',
      fields: { 'collector.email': ['E-mail inválido.'] },
    })
  })

  it('validates and keeps the details of codes that carry them', () => {
    const error = toApiError(
      httpError(409, envelope('ORDER_PENDING', { details: { orderId: 'ord_000001' } })),
    )
    expect(isApiError(error, 'ORDER_PENDING')).toBe(true)
    if (isApiError(error, 'ORDER_PENDING')) expect(error.details.orderId).toBe('ord_000001')
  })

  it('turns a code whose details do not match into UNKNOWN', () => {
    const error = toApiError(httpError(409, envelope('ORDER_PENDING', { details: { id: 1 } })))
    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'UNKNOWN' })
    expect(error.details).toBeUndefined()
  })

  it.each([undefined, null, 'oops', { message: 'x' }, envelope('NOT_A_CODE')])(
    'turns %j into UNKNOWN with a generic pt-BR message',
    (body) => {
      const error = toApiError(httpError(500, body))
      expect(error.code).toBe('UNKNOWN')
      expect(error.message).toMatch(/Tente novamente/)
    },
  )

  it('carries pt-BR messages for the transport kinds', () => {
    expect(toApiError(new AxiosError('x', 'ERR_NETWORK', undefined, {})).message).toMatch(/conexão/)
    expect(toApiError(new AxiosError('x', 'ECONNABORTED', undefined, {})).message).toMatch(
      /demorou/,
    )
  })
})

describe('isApiError', () => {
  const error = new ApiError('http', 'x', { status: 404, code: 'NOT_FOUND' })

  it('narrows to ApiError and to a code', () => {
    expect(isApiError(error)).toBe(true)
    expect(isApiError(error, 'NOT_FOUND')).toBe(true)
    expect(isApiError(error, 'FORBIDDEN')).toBe(false)
  })

  it('is false for anything that is not an ApiError', () => {
    expect(isApiError(new Error('x'))).toBe(false)
    expect(isApiError({ code: 'NOT_FOUND' }, 'NOT_FOUND')).toBe(false)
    expect(isApiError(undefined)).toBe(false)
  })

  it('withOperation returns a copy that keeps everything else', () => {
    const tagged = error.withOperation('nfts.get')
    expect(tagged).not.toBe(error)
    expect(tagged).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'NOT_FOUND',
      operation: 'nfts.get',
    })
    expect(error.operation).toBeUndefined()
  })
})
