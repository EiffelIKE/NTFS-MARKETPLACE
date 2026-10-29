import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import { ordersApi } from '@/api'
import { actAs, serveMockApi } from '@/api/contract-kit'
import { connectPrimary, orderBody } from '@/api/order-kit'
import type { Order } from '@/contracts'
import { orderKeys } from '@/features/orders/api/order-queries'
import { forgetMissedEvents, noteOrderEvent } from '@/features/orders/model/missed-events'

import { recordOrder } from './use-create-order'

const mock = serveMockApi()

async function pendingOrder(): Promise<Order> {
  mock.control.configure({ payment: { outcome: 'manual' } })
  await actAs('ana')
  await connectPrimary()
  const { body } = await orderBody()
  return ordersApi.create(body, { idempotencyKey: 'attempt-r7' })
}

afterEach(() => {
  forgetMissedEvents()
})

describe('recordOrder (R7)', () => {
  it('writes the order and, with no missed event, asks for nothing more', async () => {
    const order = await pendingOrder()
    const queryClient = new QueryClient()
    recordOrder(queryClient, 'usr_ana', order)
    expect(queryClient.getQueryData(orderKeys.detail(order.id))).toEqual(order)
    expect(queryClient.getQueryState(orderKeys.detail(order.id))?.isInvalidated).toBe(false)
  })

  it('refetches when an event newer than the response arrived before the order was cached', async () => {
    const order = await pendingOrder()
    const queryClient = new QueryClient()
    // The event came first: nothing was cached for the applier to patch.
    noteOrderEvent(queryClient, order.id, order.version + 1)
    recordOrder(queryClient, 'usr_ana', order)
    expect(queryClient.getQueryState(orderKeys.detail(order.id))?.isInvalidated).toBe(true)
  })

  it('does not note an event for an order the cache already holds', async () => {
    const order = await pendingOrder()
    const queryClient = new QueryClient()
    queryClient.setQueryData(orderKeys.detail(order.id), order)
    noteOrderEvent(queryClient, order.id, order.version + 1)
    recordOrder(queryClient, 'usr_ana', order)
    expect(queryClient.getQueryState(orderKeys.detail(order.id))?.isInvalidated).toBe(false)
  })

  it('keeps a newer cached order instead of overwriting it with the response', async () => {
    const order = await pendingOrder()
    const queryClient = new QueryClient()
    const settled: Order = { ...order, status: 'confirmed', version: order.version + 1 }
    queryClient.setQueryData(orderKeys.detail(order.id), settled)
    recordOrder(queryClient, 'usr_ana', order)
    expect(queryClient.getQueryData(orderKeys.detail(order.id))).toEqual(settled)
  })
})
