import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { actAs, serveMockApi, useFakeClock } from '@/api/contract-kit'
import type { FavoriteIds } from '@/contracts'
import type { SessionController } from '@/features/auth/model/session'

import { currentFavorite, withPendingIntents } from './favorites-cache'
import { favoritesKeys } from './keys'
import { FAVORITE_ERROR, favoriteMutationOptions } from './use-toggle-favorite'

const notify = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/components/feedback', () => ({ notify }))

const mock = serveMockApi()

const NFT = 'cosmic-bloom-118'
const current: Pick<SessionController, 'epoch' | 'isCurrent' | 'owner'> = {
  epoch: () => 0,
  isCurrent: () => true,
  owner: () => ({ kind: 'user', userId: 'usr_ana' }),
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
  client.setQueryData(favoritesKeys.list('usr_ana'), await favoritesApi.list())
  return client
}

const cached = (client: QueryClient) =>
  client.getQueryData<FavoriteIds>(favoritesKeys.list('usr_ana'))?.nftIds.includes(NFT)
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
    const session = {
      ...current,
      epoch: () => epoch,
      isCurrent: (value: number) => value === epoch,
    }

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

describe('toggles that are still on their way (F1)', () => {
  it('a list read that lands meanwhile keeps them, and the next click flips from the last intent', async () => {
    const client = await signedInClient()
    mock.control.configure({ latency: { kind: 'fixed', ms: 500 } })
    useFakeClock()

    const first = toggle(client, true)
    await vi.advanceTimersByTimeAsync(10)
    expect(currentFavorite(client, 'usr_ana', NFT)).toBe(true)

    // A read that left before the add reached the server comes back without the NFT, and the
    // cache takes it as it is: the heart must not flip back, and a click must still mean "off".
    const stale = {
      nftIds: (
        client.getQueryData<FavoriteIds>(favoritesKeys.list('usr_ana')) ?? { nftIds: [] }
      ).nftIds.filter((id) => id !== NFT),
    }
    expect(withPendingIntents(client, stale).nftIds).toContain(NFT)
    client.setQueryData(favoritesKeys.list('usr_ana'), stale)
    expect(cached(client)).toBe(false)
    expect(currentFavorite(client, 'usr_ana', NFT)).toBe(true)

    // The next toggle is created from that intent and wins: add, then remove.
    const second = toggle(client, !currentFavorite(client, 'usr_ana', NFT))
    await vi.advanceTimersByTimeAsync(10)
    expect(currentFavorite(client, 'usr_ana', NFT)).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.all([first, second])

    expect(server()).toBe(false)
    expect(cached(client)).toBe(false)
    // Settled: the cached list is the truth again.
    expect(currentFavorite(client, 'usr_ana', NFT)).toBe(false)
  })

  it('returns the same list when nothing is pending', async () => {
    const client = await signedInClient()
    const list = { nftIds: ['sage-nomad-009'] }
    expect(withPendingIntents(client, list)).toBe(list)
  })
})

describe('the list belongs to its user (G5)', () => {
  it('a toggle writes only the list of the user who asked, and another user starts empty', async () => {
    const client = await signedInClient()
    const bruno = { ...current, owner: () => ({ kind: 'user', userId: 'usr_bruno' }) as const }
    await toggle(client, true, bruno)
    expect(client.getQueryData<FavoriteIds>(favoritesKeys.list('usr_bruno'))?.nftIds).toEqual([NFT])
    expect(cached(client)).toBe(false) // Ana's list is untouched
    expect(favoritesKeys.list('usr_ana')).not.toEqual(favoritesKeys.list('usr_bruno'))
  })
})
