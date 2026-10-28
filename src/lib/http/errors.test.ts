import { AxiosError, AxiosHeaders, CanceledError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { ApiError, isRetryable, toApiError } from './errors'

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
