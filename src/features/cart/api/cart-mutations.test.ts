import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cartApi } from '@/api'
import { as, rejection, serveMockApi } from '@/api/contract-kit'
import type { Cart } from '@/contracts'
import type { SessionController } from '@/features/auth/model/session'

import { clearGuestCartId, getGuestCartId } from '../model/guest-cart-id'
import { addCartItemOptions } from './cart-mutations'
import { cartKeys } from './cart-keys'

const mock = serveMockApi()

const guest = { kind: 'guest' } as const
const live: Pick<SessionController, 'epoch' | 'isCurrent' | 'owner'> = {
  epoch: () => 0,
  isCurrent: () => true,
  owner: () => guest,
}

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

const add = (client: QueryClient, body: Parameters<typeof cartApi.addItem>[0], session = live) =>
  new MutationObserver(client, addCartItemOptions(client, session)).mutate(body)

describe('addCartItemOptions (DET-16, DET-19)', () => {
  it("a guest's first add returns a guest cart id, stores it, and the cart is readable with it", async () => {
    const client = new QueryClient()
    const cart = await add(client, { nftId: 'emerald-ape-042', editionId: 'open', quantity: 2 })

    expect(cart.id).toMatch(/^g_/)
    expect(getGuestCartId()).toBe(cart.id)
    expect(client.getQueryData<Cart>(cartKeys.detail(guest))?.itemCount).toBe(2)

    // What the HTTP interceptor does with the stored id on the next request.
    as(undefined, getGuestCartId() ?? '')
    expect(await cartApi.get()).toMatchObject({ id: cart.id, itemCount: 2 })
  })

  it('a refused add leaves the cart cache and the stored id untouched', async () => {
    const client = new QueryClient()
    const error = await rejection(() =>
      add(client, { nftId: 'obsidian-mask-007', editionId: 'unique', quantity: 1 }),
    )

    expect(error.code).toBe('EDITION_UNAVAILABLE')
    expect(client.getQueryData(cartKeys.detail(guest))).toBeUndefined()
    expect(getGuestCartId()).toBeNull()
  })

  it('drops a result that arrives after the session changed', async () => {
    const client = new QueryClient()
    let epoch = 0
    const session = { ...live, epoch: () => epoch, isCurrent: (value: number) => value === epoch }

    const run = add(client, { nftId: 'emerald-ape-042', editionId: 'open', quantity: 1 }, session)
    epoch += 1
    await run

    expect(client.getQueryData(cartKeys.detail(guest))).toBeUndefined()
    expect(getGuestCartId()).toBeNull()
    expect(mock.control.requests({ op: 'cart.addItem' })).toHaveLength(1)
  })
})
