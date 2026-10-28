import { getRouteApi, useLocation, useNavigate } from '@tanstack/react-router'
import * as React from 'react'

import { PageContainer } from '@/components/layout/page-container'
import { useOrderStatus } from '@/features/orders/api/use-order-status'
import { OrderDeclinedPanel } from '@/features/orders/components/order-declined-panel'
import { OrderPendingPanel } from '@/features/orders/components/order-pending-panel'

import { isReceiptOrder, receiptView } from '../model/receipt'
import { ReceiptCard } from './receipt-card'
import { ReceiptSkeleton } from './receipt-states'

const route = getRouteApi('/orders/$orderId')

/**
 * What `/orders/$orderId` shows (RCPT-05 – RCPT-07): the receipt only for a confirmed order, the
 * spec 09 panels for the others. The status is followed with `useOrderStatus`, so a pending order
 * is replaced by its receipt (or its refusal) in place, with no reload.
 */
export function OrderPage() {
  const { orderId } = route.useParams()
  const fromCheckout = useLocation({ select: (location) => location.state.fromCheckout === true })
  const navigate = useNavigate()
  const { order, status } = useOrderStatus(orderId)
  // The receipt takes focus when it appears after an event: the checkout navigation, or the
  // processing panel it replaces. Derived during render, not in an effect (RCPT-15).
  const [sawOpen, setSawOpen] = React.useState(false)
  if (order && order.status !== 'confirmed' && !sawOpen) setSawOpen(true)

  if (order && isReceiptOrder(order)) {
    return (
      <PageContainer className="pt-2 lg:pt-0">
        <title>Pedido confirmado · KURIO</title>
        <ReceiptCard view={receiptView(order)} focusOnMount={fromCheckout || sawOpen} />
      </PageContainer>
    )
  }

  if (order?.status === 'pending') {
    return (
      <PageContainer className="py-10">
        <title>{`Pedido ${order.id} · KURIO`}</title>
        <h1 className="sr-only">Pedido {order.id}</h1>
        <OrderPendingPanel order={order} />
      </PageContainer>
    )
  }

  if (order?.status === 'declined') {
    return (
      <PageContainer className="py-10">
        <title>{`Pedido ${order.id} · KURIO`}</title>
        <h1 className="sr-only">Pedido {order.id}</h1>
        <OrderDeclinedPanel
          order={order}
          onRetry={() => {
            void navigate({ to: '/checkout' })
          }}
        />
      </PageContainer>
    )
  }

  // `error` with no order never gets here (the loader throws first); this is the first paint.
  return status === 'loading' ? <ReceiptSkeleton /> : null
}
