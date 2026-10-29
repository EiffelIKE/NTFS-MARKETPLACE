import { afterEach, describe, expect, it, vi } from 'vitest'

import { ordersApi } from '@/api'
import { actAs, serveMockApi, useFakeClock } from '@/api/contract-kit'
import { connectPrimary, orderBody } from '@/api/order-kit'
import type { ApiErrorCode } from '@/contracts'
import { ApiError } from '@/lib/http/errors'
import { must } from '@/lib/test-utils'

import { createAttemptStore, prepareAttempt } from '../model/attempt-store'
import { memoryStorage } from '../model/safe-storage'
import { classifyPlaceError, placeOrder } from './place-order'

const mock = serveMockApi()

afterEach(() => {
  vi.useRealTimers()
})

async function ready() {
  await actAs('ana')
  await connectPrimary()
  const { body } = await orderBody()
  const store = createAttemptStore(memoryStorage())
  const attempt = prepareAttempt(null, 'usr_ana', body)
  return { body, store, attempt }
}

const orderIds = () => Object.keys(mock.control.snapshot().orders)

describe('placeOrder (CHK-23, CHK-26, CHK-27)', () => {
  it('stores the attempt before the request leaves, then its order', async () => {
    const { store, attempt } = await ready()
    let seenBeforeSend: unknown
    const outcome = await placeOrder(attempt, {
      store,
      send: (body, options) => {
        seenBeforeSend = store.read('usr_ana')
        return ordersApi.create(body, options)
      },
    })
    expect(seenBeforeSend).toMatchObject({ key: attempt.key, orderId: null, phase: 'sent' })
    expect(outcome.kind).toBe('created')
    expect(store.read('usr_ana')).toMatchObject({
      orderId: outcome.kind === 'created' ? outcome.order.id : '',
    })
  })

  it('replays the same key and gets the same order, never a second', async () => {
    const { store, attempt } = await ready()
    const first = await placeOrder(attempt, { store })
    const again = await placeOrder(attempt, { store, replay: true })
    expect(first.kind).toBe('created')
    expect(again.kind).toBe('created')
    expect(again.kind === 'created' && again.order.id).toBe(
      first.kind === 'created' && first.order.id,
    )
    expect(orderIds()).toHaveLength(2) // the seeded one and this one
  })

  it('follows the existing order for a new key while one is pending (ORDER_PENDING)', async () => {
    const { store, attempt, body } = await ready()
    const first = await placeOrder(attempt, { store })
    const second = await placeOrder(prepareAttempt(null, 'usr_ana', body), { store })
    expect(second).toEqual({
      kind: 'tracking',
      orderId: first.kind === 'created' ? first.order.id : '',
    })
    expect(orderIds()).toHaveLength(2)
  })

  it('follows the order for the same key and another body (IDEMPOTENCY_CONFLICT)', async () => {
    const { store, attempt, body } = await ready()
    const first = await placeOrder(attempt, { store })
    const changed = { ...attempt, body: { ...body, note: 'outra coisa' } }
    const outcome = await placeOrder(changed, { store })
    expect(outcome).toEqual({
      kind: 'tracking',
      orderId: first.kind === 'created' ? first.order.id : '',
    })
  })

  it('hands back the fresh quote of QUOTE_CHANGED and marks the attempt rejected', async () => {
    const { store, attempt } = await ready()
    mock.control.updateNft('golden-beat-207', { price: '1.09' })
    const outcome = await placeOrder(attempt, { store })
    expect(outcome.kind).toBe('quote-changed')
    expect(outcome.kind === 'quote-changed' && outcome.quote.id).not.toBe(attempt.body.quoteId)
    expect(store.read('usr_ana')?.phase).toBe('rejected')
    expect(orderIds()).toHaveLength(1)
  })

  it('reports INSUFFICIENT_AVAILABILITY with the lines', async () => {
    const { store, attempt } = await ready()
    mock.control.updateNft('emerald-ape-042', { available: { editionId: 'open', value: 0 } })
    const outcome = await placeOrder(attempt, { store })
    expect(outcome).toMatchObject({
      kind: 'unavailable',
      lines: [{ nftId: 'emerald-ape-042', available: 0 }],
    })
  })

  it('reports WALLET_NOT_CONNECTED when the wallet was disconnected', async () => {
    const { store, attempt } = await ready()
    mock.control.disconnectWallet()
    expect((await placeOrder(attempt, { store })).kind).toBe('wallet-disconnected')
  })

  it('treats a timeout as unknown and keeps the attempt recoverable, then replays it', async () => {
    useFakeClock()
    mock.runtime.useScenario('order-timeout')
    mock.control.configure({ latency: { kind: 'none' } })
    const { store, attempt } = await ready()

    const first = placeOrder(attempt, { store })
    await vi.advanceTimersByTimeAsync(10_000)
    expect((await first).kind).toBe('unknown')
    expect(store.read('usr_ana')).toMatchObject({ phase: 'sent', orderId: null, key: attempt.key })
    const created = orderIds().filter((id) => id !== 'ord_000001')
    expect(created).toHaveLength(1)

    const replay = await placeOrder(must(store.read('usr_ana')), { store, replay: true })
    expect(replay.kind === 'created' && replay.order.id).toBe(created[0])
    expect(orderIds()).toHaveLength(2)
  })

  it('leaves the attempt as it was when a replay finds the session gone', async () => {
    const { store, attempt } = await ready()
    store.write(attempt)
    mock.control.expireSessions()
    const outcome = await placeOrder(attempt, { store, replay: true })
    expect(outcome.kind).toBe('session')
    expect(store.read('usr_ana')?.phase).toBe('sent')
  })

  it('marks the attempt rejected when a first send finds the session gone', async () => {
    const { store, attempt } = await ready()
    mock.control.expireSessions()
    expect((await placeOrder(attempt, { store })).kind).toBe('session')
    expect(store.read('usr_ana')?.phase).toBe('rejected')
  })
})

describe('classifyPlaceError', () => {
  const http = (status: number, code?: ApiErrorCode) =>
    new ApiError('http', 'x', { status, ...(code && { code }) })

  it('separates unknown results from definite refusals', () => {
    expect(classifyPlaceError(new ApiError('timeout', 'x')).kind).toBe('unknown')
    expect(classifyPlaceError(new ApiError('network', 'x')).kind).toBe('unknown')
    expect(classifyPlaceError(http(503)).kind).toBe('unknown')
    expect(classifyPlaceError(http(403, 'FORBIDDEN')).kind).toBe('failed')
    expect(classifyPlaceError(http(422, 'VALIDATION_FAILED')).kind).toBe('invalid')
  })
})
