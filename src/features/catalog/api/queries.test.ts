import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { serveMockApi, useFakeClock } from '@/api/contract-kit'

import { catalogKeys } from './keys'
import { isAppliedQuery, nftListQuery } from './queries'
import { catalogSearch, toListQuery } from '../model/search'

const mock = serveMockApi()

afterEach(() => {
  vi.useRealTimers()
  mock.server.resetHandlers()
})

const asc = toListQuery({ sort: 'price-asc' })
const desc = toListQuery({ sort: 'price-desc' })

describe('nftListQuery (CAT-06, CAT-16)', () => {
  it('gives each URL state its own cache entry', () => {
    expect(nftListQuery(asc).queryKey).toEqual(catalogKeys.list(asc))
    expect(nftListQuery(asc).queryKey).not.toEqual(nftListQuery(desc).queryKey)
    // The URL schema canonicalizes the list, so two spellings of one state share an entry.
    const key = (categories: string) =>
      nftListQuery(toListQuery(catalogSearch.parse({ categories }))).queryKey
    expect(key('musica,arte-3d')).toEqual(key('arte-3d,musica'))
  })

  it('aborts the request of a state the user left, and the next state resolves with its own data', async () => {
    mock.control.configure({ latency: { kind: 'fixed', ms: 1000 } })
    useFakeClock()
    const client = new QueryClient()
    const left = client.query(nftListQuery(asc)).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(50)
    // What TanStack does when the observer of `asc` goes away.
    await client.cancelQueries({ queryKey: nftListQuery(asc).queryKey })
    const next = client.query(nftListQuery(desc))
    await vi.advanceTimersByTimeAsync(1100)

    expect(await left).toBeInstanceOf(Error)
    const response = await next
    expect(response.applied.sort).toBe('price-desc')
    expect(isAppliedQuery(desc, response)).toBe(true)
    const log = mock.control.requests({ op: 'nfts.list' })
    expect(log.map((entry) => entry.status)).toEqual(['aborted', 200])
  })

  it('keeps a late response in its own entry, so the newer state is never overwritten', async () => {
    // The first call answers after 1.8 s, the second after 0.2 s.
    mock.control.configure({ outOfOrder: { ops: ['nfts.list'], slowMs: 1800, fastMs: 200 } })
    useFakeClock()
    const client = new QueryClient()
    const first = client.query(nftListQuery(asc))
    const second = client.query(nftListQuery(desc))
    await vi.advanceTimersByTimeAsync(300)
    expect((await second).applied.sort).toBe('price-desc')
    expect(client.getQueryData(nftListQuery(asc).queryKey)).toBeUndefined()

    await vi.advanceTimersByTimeAsync(2000)
    expect((await first).applied.sort).toBe('price-asc')
    // Each response is in the entry of the state it answers.
    expect(client.getQueryData(nftListQuery(desc).queryKey)?.applied.sort).toBe('price-desc')
    expect(client.getQueryData(nftListQuery(asc).queryKey)?.applied.sort).toBe('price-asc')
  })
})

describe('isAppliedQuery', () => {
  it('compares what the server echoed with what was asked', async () => {
    const response = await new QueryClient().query(nftListQuery(asc))
    expect(isAppliedQuery(asc, response)).toBe(true)
    expect(isAppliedQuery(desc, response)).toBe(false)
    expect(isAppliedQuery(toListQuery({ q: 'ape' }), response)).toBe(false)
  })
})
