import {
  IDEMPOTENCY_HEADER,
  Order,
  OrderList,
  type CreateOrderBody,
  type OrderStatus,
} from '@/contracts'

import { path, request, type ReadOptions } from './request'

export const ordersApi = {
  /** Replaying the same key and body returns the same order; a different body is a conflict. */
  create: (body: CreateOrderBody, { idempotencyKey }: { idempotencyKey: string }) =>
    request({
      id: 'orders.create',
      method: 'POST',
      url: '/orders',
      data: body,
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      response: Order,
    }),
  get: (orderId: string, opts: ReadOptions = {}) =>
    request({
      id: 'orders.get',
      method: 'GET',
      url: `/orders/${path(orderId)}`,
      response: Order,
      ...opts,
    }),
  list: (filter: { status?: OrderStatus } = {}, opts: ReadOptions = {}) =>
    request({
      id: 'orders.list',
      method: 'GET',
      url: '/orders',
      params: filter.status ? { status: filter.status } : {},
      response: OrderList,
      ...opts,
    }),
}
