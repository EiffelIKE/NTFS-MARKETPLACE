import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cartApi } from '@/api'
import { actAs, as, serveMockApi } from '@/api/contract-kit'
import type { Cart } from '@/contracts'

import { cartKeys } from '../api/cart-keys'
import { clearGuestCartId, getGuestCartId, setGuestCartId } from './guest-cart-id'
import { createMergeGuestCartTask, MERGE_TITLE } from './merge-guest-cart'

const mock = serveMockApi()
const owner = { kind: 'user', userId: 'usr_ana' } as const
const context = { via: 'login', userId: 'usr_ana' } as const

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => {
      data.clear()
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})
afterEach(() => {
  clearGuestCartId()
  vi.unstubAllGlobals()
})

const live = { epoch: () => 0, isCurrent: () => true }

describe('merge guest cart (CART-04)', () => {
  it('does nothing without a stored guest cart id', async () => {
    const merge = vi.fn()
    const task = createMergeGuestCartTask({ queryClient: new QueryClient(), session: live, merge })
    await task(context)
    expect(merge).not.toHaveBeenCalled()
  })

  it('merges once, clears the id, writes the user cart and reports adjusted lines in one toast', async () => {
    const queryClient = new QueryClient()
    // The guest wants ten of an open edition while Ana holds one: the line is capped.
    as(undefined)
    const guest = await cartApi.addItem({
      nftId: 'emerald-ape-042',
      editionId: 'open',
      quantity: 10,
    })
    expect(guest.id).toMatch(/^g_/)
    setGuestCartId(guest.id ?? '')
    await actAs('ana')

    const report = vi.fn()
    const task = createMergeGuestCartTask({ queryClient, session: live, report })
    await Promise.all([task(context), task(context)])

    expect(mock.control.requests({ op: 'cart.merge' })).toHaveLength(1)
    expect(getGuestCartId()).toBeNull()
    const cart = queryClient.getQueryData<Cart>(cartKeys.detail(owner))
    expect(cart?.items.find((item) => item.nftId === 'emerald-ape-042')?.quantity).toBe(10)
    expect(report).toHaveBeenCalledOnce()
    const [title, lines] = report.mock.calls[0] as [string, string[]]
    expect(title).toBe(MERGE_TITLE)
    expect(lines).toEqual([
      expect.stringMatching(/^Emerald Ape #042 \(.+\): quantidade ajustada para 10$/),
    ])
  })

  it('a merge with no adjustments shows no toast', async () => {
    const queryClient = new QueryClient()
    as(undefined)
    const guest = await cartApi.addItem({
      nftId: 'penny-pixel-001',
      editionId: 'open',
      quantity: 1,
    })
    setGuestCartId(guest.id ?? '')
    await actAs('bruno')
    const report = vi.fn()
    await createMergeGuestCartTask({ queryClient, session: live, report })({
      via: 'login',
      userId: 'usr_bruno',
    })
    expect(report).not.toHaveBeenCalled()
    expect(
      queryClient.getQueryData<Cart>(cartKeys.detail({ kind: 'user', userId: 'usr_bruno' }))
        ?.itemCount,
    ).toBe(1)
  })

  it('names a line that was not added by asking the catalog', async () => {
    const queryClient = new QueryClient()
    as(undefined)
    const guest = await cartApi.addItem({
      nftId: 'violet-nomad-314',
      editionId: 'limited-50',
      quantity: 1,
    })
    setGuestCartId(guest.id ?? '')
    // The last unit sells out before the guest signs in.
    mock.control.updateNft('violet-nomad-314', { available: { editionId: 'limited-50', value: 0 } })
    await actAs('bruno')
    const report = vi.fn()
    await createMergeGuestCartTask({ queryClient, session: live, report })({
      via: 'login',
      userId: 'usr_bruno',
    })
    const [, lines] = report.mock.calls[0] as [string, string[]]
    expect(lines).toEqual([
      expect.stringMatching(/^Violet Nomad #314 \(.+\): indisponível, não foi adicionado$/),
    ])
  })

  it('keeps the id when the merge fails, so the next session start retries', async () => {
    setGuestCartId('g_0001')
    const merge = vi.fn().mockRejectedValue(new Error('503'))
    const queryClient = new QueryClient()
    const reportFailure = vi.fn()
    const task = createMergeGuestCartTask({ queryClient, session: live, merge, reportFailure })
    await task(context)
    expect(getGuestCartId()).toBe('g_0001')
    expect(queryClient.getQueryData(cartKeys.detail(owner))).toBeUndefined()
    await task(context)
    expect(merge).toHaveBeenCalledTimes(2)
  })

  it('says so when the merge fails, and its retry runs the merge again (R5)', async () => {
    setGuestCartId('g_0001')
    const cart: Cart = {
      id: 'cart_usr_ana',
      items: [],
      coupon: null,
      itemCount: 0,
      version: 2,
      updatedAt: '2026-10-28T12:00:00.000Z',
    }
    const merge = vi
      .fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue({ cart, adjustments: [] })
    const queryClient = new QueryClient()
    const reportFailure = vi.fn<(retry: () => void) => void>()
    const task = createMergeGuestCartTask({ queryClient, session: live, merge, reportFailure })
    await task(context)
    expect(reportFailure).toHaveBeenCalledOnce()

    reportFailure.mock.calls[0]?.[0]()
    await vi.waitFor(() => {
      expect(getGuestCartId()).toBeNull()
    })
    expect(merge).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(cartKeys.detail(owner))).toEqual(cart)
  })

  it('stays silent for a session error and for a session that has since changed', async () => {
    setGuestCartId('g_0001')
    const reportFailure = vi.fn()
    const merge = vi.fn().mockRejectedValue(new Error('503'))
    await createMergeGuestCartTask({
      queryClient: new QueryClient(),
      session: { epoch: () => 0, isCurrent: () => false },
      merge,
      reportFailure,
    })(context)
    expect(reportFailure).not.toHaveBeenCalled()
  })

  it('drops the result when the session changed meanwhile, but still forgets the merged guest cart', async () => {
    setGuestCartId('g_0001')
    const queryClient = new QueryClient()
    const cart: Cart = {
      id: 'cart_usr_ana',
      items: [],
      coupon: null,
      itemCount: 0,
      version: 2,
      updatedAt: '2026-10-28T12:00:00.000Z',
    }
    const task = createMergeGuestCartTask({
      queryClient,
      session: { epoch: () => 0, isCurrent: () => false },
      merge: () => Promise.resolve({ cart, adjustments: [] }),
    })
    await task(context)
    expect(getGuestCartId()).toBeNull()
    expect(queryClient.getQueryData(cartKeys.detail(owner))).toBeUndefined()
  })
})
