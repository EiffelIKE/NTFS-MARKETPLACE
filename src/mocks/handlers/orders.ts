import {
  CreateOrderBody,
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY,
  OrderListQuery,
  type OperationId,
} from '@/contracts'

import { toOrder, toOrderSummary } from '../domain/mappers'
import {
  checkIdempotency,
  createOrder,
  fireCheckoutTrigger,
  revalidate,
  validateWallet,
} from '../domain/orders'
import { HttpError } from '../lib/http-error'
import { created, ok, op, type AnyOp } from './pipeline'

export const orderOps = {
  'orders.create': op({
    body: CreateOrderBody,
    handle({ runtime, config, request, body, user }) {
      const key = request.headers.get(IDEMPOTENCY_HEADER)
      if (!key || !IDEMPOTENCY_KEY.test(key)) {
        throw new HttpError('VALIDATION_FAILED', {
          fields: {
            [IDEMPOTENCY_HEADER]: ['Envie um Idempotency-Key de 8 a 64 letras, números ou hífen.'],
          },
        })
      }
      const { id: userId } = user()

      // Steps 2–5 commit on their own: the scenario trigger must stick even when step 6 then
      // rejects the order, otherwise the change it makes would be rolled back with it.
      const replay = runtime.store.write((tx) => {
        const existing = checkIdempotency(tx.state, userId, key, body)
        if (existing) return existing
        validateWallet(tx.state, userId, body)
        fireCheckoutTrigger(tx, userId, config)
        return null
      })
      if (replay) return ok(toOrder(replay))

      // Steps 6–8 are atomic: either the order exists with its reservations, or nothing changed.
      const order = runtime.store.write((tx) =>
        createOrder(tx, userId, key, body, revalidate(tx.state, userId, body, tx.now), config),
      )
      runtime.settlement.arm()
      return created(toOrder(order))
    },
  }),

  'orders.get': op({
    handle({ runtime, params, user }) {
      const { id } = user()
      const order = runtime.store.read((state) => state.orders[params.orderId ?? ''])
      if (!order) throw new HttpError('NOT_FOUND', { details: { resource: 'order' } })
      if (order.userId !== id) throw new HttpError('FORBIDDEN')
      return ok(toOrder(order))
    },
  }),

  'orders.list': op({
    query: OrderListQuery,
    handle({ runtime, query, user }) {
      const { id } = user()
      const items = runtime.store.read((state) =>
        Object.values(state.orders)
          .filter(
            (order) => order.userId === id && (!query.status || order.status === query.status),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
          .map(toOrderSummary),
      )
      return ok({ items })
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
