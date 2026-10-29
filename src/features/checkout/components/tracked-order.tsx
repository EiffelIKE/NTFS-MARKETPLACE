import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'

import { AlertCircleIcon } from '@/components/icons'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/contracts'
import { useAccountUserId } from '@/features/account/model/use-account'
import { cartKeys } from '@/features/cart/api/cart-keys'
import { useCartOwner } from '@/features/cart/model/use-cart'
import { orderKeys } from '@/features/orders/api/order-queries'
import { useOrderStatus } from '@/features/orders/api/use-order-status'
import { OrderDeclinedPanel } from '@/features/orders/components/order-declined-panel'
import { OrderPendingPanel } from '@/features/orders/components/order-pending-panel'
import { CHECKOUT_ARRIVAL } from '@/features/receipt/model/arrival'
import { isApiError } from '@/lib/http/errors'

import { attemptStore } from '../model/attempt-store'

interface TrackedOrderProps {
  orderId: string
  /** The user has just paid: the panel takes focus (CHK-29). */
  fresh: boolean
  /** A new attempt after a refusal (CHK-32). */
  onRetry: (order: Order) => void
  /** The order is not ours to show (gone, or someone else's): back to the form. */
  onGone: () => void
  /** The user is leaving for the cart; the refused order is acknowledged. */
  onLeave: () => void
}

/**
 * The order checkout is following (CHK-29 – CHK-33). Updates come from `order.updated` through the
 * cache, with the 5 s poll behind them; this component only reads the order. Confirmed is the only
 * state that leaves the page, and it does so by replacing the history entry, so Back never returns
 * to a payment form for an order that is already paid (CHK-31).
 */
export function TrackedOrder({ orderId, fresh, onRetry, onGone, onLeave }: TrackedOrderProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const userId = useAccountUserId()
  const owner = useCartOwner()
  const { order, status, error, refetch } = useOrderStatus(orderId)

  const gone = isApiError(error, 'NOT_FOUND') || isApiError(error, 'FORBIDDEN')
  React.useEffect(() => {
    if (status === 'error' && gone) onGone()
  }, [status, gone, onGone])

  React.useEffect(() => {
    if (status === 'confirmed') {
      if (userId) attemptStore.clear(userId)
      void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all, exact: false })
      void navigate({
        to: '/orders/$orderId',
        params: { orderId },
        state: CHECKOUT_ARRIVAL,
        replace: true,
      })
    } else if (status === 'declined') {
      // Released stock changes availability, so the cart looks again.
      void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
    }
  }, [status, orderId, userId, owner, queryClient, navigate])

  if (order?.status === 'pending') return <OrderPendingPanel order={order} focusOnMount={fresh} />
  if (order?.status === 'declined') {
    return (
      <OrderDeclinedPanel
        order={order}
        onRetry={() => {
          onRetry(order)
        }}
        onBackToCart={onLeave}
      />
    )
  }
  if (order?.status === 'confirmed') {
    return (
      <p role="status" className="py-16 text-center text-body-lg text-text-secondary">
        Pagamento confirmado. Abrindo o seu pedido…
      </p>
    )
  }
  if (status === 'error' && !gone) {
    return (
      <Alert className="mx-auto max-w-xl">
        <AlertCircleIcon />
        <AlertDescription>Não foi possível carregar o seu pedido.</AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetch()
            }}
          >
            Tentar novamente
          </Button>
        </AlertAction>
      </Alert>
    )
  }
  return <Skeleton className="mx-auto h-64 w-full max-w-xl rounded-md" />
}
