import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { catalogApi } from '@/api'
import { isApiError } from '@/lib/http/errors'
import { env } from '@/lib/env'

import { rejection, useFakeClock, serveMockApi } from './contract-kit'

const mock = serveMockApi()
const apiUrl = (path: string) => `${env.VITE_API_BASE_URL}${path}`

afterEach(() => {
  vi.useRealTimers()
  mock.server.resetHandlers()
})

describe('abort (FND-16)', () => {
  it('turns an AbortController abort into an ApiError of kind cancelled', async () => {
    mock.control.configure({ latency: { kind: 'fixed', ms: 5000 } })
    useFakeClock()
    const controller = new AbortController()
    const pending = rejection(() => catalogApi.list({}, { signal: controller.signal }))
    await vi.advanceTimersByTimeAsync(50)
    controller.abort()
    expect(await pending).toMatchObject({ kind: 'cancelled', operation: 'nfts.list' })
  })

  it('lets TanStack cancel a query and the mock logs the request as aborted', async () => {
    mock.control.configure({ latency: { kind: 'fixed', ms: 5000 } })
    useFakeClock()
    const client = new QueryClient()
    const pending = client
      .query({
        queryKey: ['nfts'],
        queryFn: ({ signal }) => catalogApi.list({}, { signal }),
      })
      .catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(50)
    await client.cancelQueries()
    const result = await pending
    expect(result).toBeInstanceOf(Error)
    await vi.advanceTimersByTimeAsync(10)
    expect(mock.control.requests({ op: 'nfts.list' }).at(-1)?.status).toBe('aborted')
  })
})

describe('contract guard (API-04)', () => {
  it('rejects a response that does not match the schema with an ApiError of kind contract', async () => {
    mock.server.use(
      http.get(apiUrl('/nfts/:nftId'), () =>
        HttpResponse.json({ id: 'emerald-ape-042', price: 12.3 }),
      ),
    )
    const error = await rejection(() => catalogApi.get('emerald-ape-042'))
    expect(error).toMatchObject({ kind: 'contract', operation: 'nfts.get' })
    expect(isApiError(error, 'NOT_FOUND')).toBe(false)
  })

  it('turns an error body that is not an envelope into code UNKNOWN', async () => {
    mock.server.use(
      http.get(apiUrl('/highlights'), () => HttpResponse.json({ oops: true }, { status: 500 })),
    )
    const error = await rejection(() => catalogApi.highlights())
    expect(error).toMatchObject({ kind: 'http', status: 500, code: 'UNKNOWN' })
  })
})
