import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { ordersApi } from '@/api'
import { actAs, serveMockApi } from '@/api/contract-kit'
import { connectPrimary, orderBody } from '@/api/order-kit'
import type { Order } from '@/contracts'

import { orderKeys, orderQueryOptions } from './order-queries'
import { ORDER_POLL_MS, orderPollInterval, orderTrackingOptions } from './use-order-status'

const mock = serveMockApi()

async function pendingOrder(): Promise<Order> {
  mock.control.configure({ payment: { outcome: 'manual' } })
  await actAs('ana')
  await connectPrimary()
  const { body } = await orderBody()
  return ordersApi.create(body, { idempotencyKey: 'attempt-0001' })
}

describe('orderPollInterval (CHK-29, CHK-33)', () => {
  it('polls only while the order is pending', () => {
    expect(orderPollInterval(undefined)).toBe(false)
    expect(orderPollInterval({ status: 'pending' })).toBe(ORDER_POLL_MS)
    expect(orderPollInterval({ status: 'confirmed' })).toBe(false)
    expect(orderPollInterval({ status: 'declined' })).toBe(false)
  })
})

describe('order tracking', () => {
  it('hands the pending-only poll to the query', async () => {
    // Query ignores `refetchInterval` outside a browser (`isServer`), so the interval is checked
    // through the option the hook passes; the live 5 s poll is covered by `realtime-resilience.spec`.
    const order = await pendingOrder()
    const { refetchInterval } = orderTrackingOptions(order.id)
    const state = (data: Order | undefined) => ({ state: { data } })
    expect(refetchInterval(state(order))).toBe(ORDER_POLL_MS)
    expect(refetchInterval(state({ ...order, status: 'confirmed' }))).toBe(false)
    expect(refetchInterval(state(undefined))).toBe(false)
  })

  it('does not let an older response revert a settled order (CHK-33)', async () => {
    const order = await pendingOrder()
    const client = new QueryClient()
    // The event applier already wrote a newer, settled version into the cache.
    const settled: Order = { ...order, status: 'confirmed', version: order.version + 3 }
    client.setQueryData(orderKeys.detail(order.id), settled)

    // The server still answers with the pending version 1 (a poll that was in flight).
    const result = await client.query({ ...orderQueryOptions(order.id), staleTime: 0 })
    expect(result.status).toBe('confirmed')
    expect(client.getQueryData<Order>(orderKeys.detail(order.id))?.version).toBe(settled.version)
  })

  it('takes a newer response over the cache', async () => {
    const order = await pendingOrder()
    const client = new QueryClient()
    client.setQueryData(orderKeys.detail(order.id), order)
    mock.control.settleOrder(order.id, 'declined')
    const result = await client.query({ ...orderQueryOptions(order.id), staleTime: 0 })
    expect(result.status).toBe('declined')
    expect(result.declineReason).not.toBeNull()
  })
})
