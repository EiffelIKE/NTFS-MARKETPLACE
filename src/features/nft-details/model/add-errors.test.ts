import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/http/errors'

import {
  ADD_FAILED_MESSAGE,
  CART_FULL_MESSAGE,
  SOLD_OUT_MESSAGE,
  describeAddError,
} from './add-errors'

const target = { nftId: 'emerald-ape-042', editionId: 'limited-10', inCart: 0 } as const

const http = (status: number, code: ApiError['code'], details?: unknown) =>
  new ApiError('http', 'x', { status, code, details })

describe('describeAddError (DET-18)', () => {
  it('EDITION_UNAVAILABLE asks for a refetch and says the edition sold out', () => {
    expect(describeAddError(http(409, 'EDITION_UNAVAILABLE', {}), target)).toEqual({
      kind: 'sold-out',
      message: SOLD_OUT_MESSAGE,
    })
  })

  it('INSUFFICIENT_AVAILABILITY computes what remains from the line limit and the cart', () => {
    const error = http(409, 'INSUFFICIENT_AVAILABILITY', {
      lines: [{ nftId: 'emerald-ape-042', editionId: 'limited-10', requested: 3, available: 2 }],
    })
    expect(describeAddError(error, target)).toEqual({
      kind: 'limit',
      message: 'Restam apenas 2 unidades desta edição.',
      remaining: 2,
    })
    expect(describeAddError(error, { ...target, inCart: 1 })).toEqual({
      kind: 'limit',
      message: 'Resta apenas 1 unidade desta edição.',
      remaining: 1,
    })
    expect(describeAddError(error, { ...target, inCart: 2 })).toEqual({
      kind: 'limit',
      message: CART_FULL_MESSAGE,
      remaining: 0,
    })
  })

  it('NOT_FOUND leads to the 404 view and a session error leaves the message to spec 04', () => {
    expect(describeAddError(http(404, 'NOT_FOUND', { resource: 'nft' }), target)).toEqual({
      kind: 'not-found',
    })
    expect(describeAddError(http(401, 'SESSION_EXPIRED'), target)).toEqual({ kind: 'session' })
  })

  it('anything else is a retryable failure', () => {
    expect(describeAddError(http(500, 'INTERNAL'), target)).toEqual({
      kind: 'failed',
      message: ADD_FAILED_MESSAGE,
    })
    expect(describeAddError(new ApiError('network', 'offline'), target).kind).toBe('failed')
  })
})
