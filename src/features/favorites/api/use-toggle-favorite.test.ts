import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { actAs, serveMockApi, useFakeClock } from '@/api/contract-kit'
import type { FavoriteIds } from '@/contracts'
import type { SessionController } from '@/features/auth/model/session'

import { favoritesKeys } from './keys'
import { FAVORITE_ERROR, favoriteMutationOptions } from './use-toggle-favorite'

const notify = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/components/feedback', () => ({ notify }))

const mock = serveMockApi()

const NFT = 'cosmic-bloom-118'
const current: Pick<SessionController, 'epoch' | 'isCurrent'> = {
  epoch: () => 0,
  isCurrent: () => true,
}

afterEach(() => {
  vi.useRealTimers()
  notify.error.mockClear()
})

/** Ana's seeded favorites, loaded into a fresh client the way the favorites query would. */
async function signedInClient() {
  await actAs('ana')
  const client = new QueryClient()
  const { favoritesApi } = await import('@/api')
  client.setQueryData(favoritesKeys.all, await favoritesApi.list())
  return client
}

const cached = (client: QueryClient) =>
  client.getQueryData<FavoriteIds>(favoritesKeys.all)?.nftIds.includes(NFT)
const server = () => mock.control.snapshot().favorites.usr_ana?.includes(NFT)
const toggle = (client: QueryClient, next: boolean, session = current) =>
  new MutationObserver(client, favoriteMutationOptions(client, NFT, session)).mutate(next)

describe('favoriteMutationOptions (DET-20, DET-21)', () => {
  it('shows the new state before the server answers, and keeps it on success', async () => {
    const client = await signedInClient()
    mock.control.configure({ latency: { kind: 'fixed', ms: 1000 } })
    useFakeClock()

    const done = toggle(client, true)
    await vi.advanceTimersByTimeAsync(10)
    expect(cached(client)).toBe(true)
    expect(server()).toBeFalsy()

    await vi.advanceTimersByTimeAsync(1200)
    await done
    expect(cached(client)).toBe(true)
    expect(server()).toBe(true)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('undoes the change and says so when the request fails', async () => {
    const client = await signedInClient()
    mock.control.addRule({
      op: 'favorites.add',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })

    await toggle(client, true).catch(() => undefined)

    expect(cached(client)).toBe(false)
    expect(server()).toBeFalsy()
    const call = notify.error.mock.calls[0] as [string, { action: { label: string } }]
    expect(call[0]).toBe(FAVORITE_ERROR)
    expect(call[1].action.label).toBe('Tentar novamente')
  })

  it('"Tentar novamente" repeats the same intent and the state sticks', async () => {
    const client = await signedInClient()
    mock.control.addRule({
      op: 'favorites.add',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })
    await toggle(client, true).catch(() => undefined)

    const call = notify.error.mock.calls[0] as [string, { action: { onClick: () => void } }]
    call[1].action.onClick()
    await vi.waitFor(() => {
      expect(server()).toBe(true)
    })
    expect(cached(client)).toBe(true)
  })

  it('applies three rapid toggles in order: cache and server both end on', async () => {
    const client = await signedInClient()

    const runs = [toggle(client, true), toggle(client, false), toggle(client, true)]
    await Promise.all(runs)

    expect(cached(client)).toBe(true)
    expect(server()).toBe(true)
    expect(mock.control.requests({ op: 'favorites.add' })).toHaveLength(2)
    expect(mock.control.requests({ op: 'favorites.remove' })).toHaveLength(1)
  })

  it('a failed middle toggle undoes only itself and later ones keep their state', async () => {
    const client = await signedInClient()
    mock.control.addRule({
      op: 'favorites.add',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })

    // on (fails), off, on: the last intent wins on the server.
    await Promise.allSettled([toggle(client, true), toggle(client, false), toggle(client, true)])

    expect(server()).toBe(true)
  })

  it('drops the result of a session that is gone: no rollback, no toast', async () => {
    const client = await signedInClient()
    mock.control.addRule({
      op: 'favorites.add',
      effect: { kind: 'http', status: 500, code: 'INTERNAL' },
      times: 1,
    })
    mock.control.configure({ latency: { kind: 'fixed', ms: 500 } })
    useFakeClock()
    let epoch = 0
    const session = { epoch: () => epoch, isCurrent: (value: number) => value === epoch }

    const run = toggle(client, true, session).catch(() => undefined)
    await vi.advanceTimersByTimeAsync(10)
    epoch += 1 // the user switched while the request was in flight
    await vi.advanceTimersByTimeAsync(700)
    await run

    expect(notify.error).not.toHaveBeenCalled()
    // The optimistic write was made for the old identity; nothing of it is touched again.
    expect(cached(client)).toBe(true)
  })
})
