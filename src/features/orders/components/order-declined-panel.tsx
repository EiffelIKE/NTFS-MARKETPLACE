import { Link } from '@tanstack/react-router'
import * as React from 'react'

import { announce } from '@/components/feedback'
import { AlertCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { Order } from '@/contracts'

/**
 * "Pagamento recusado" (CHK-32): the order is terminal, the cart is untouched. The two ways on are
 * a new attempt and a way back to the cart. Announced once, assertively, as it appears.
 */
export function OrderDeclinedPanel({
  order,
  onRetry,
  onBackToCart,
}: {
  order: Pick<Order, 'id' | 'declineReason'>
  /** Starts a new attempt (a new key, a fresh quote). */
  onRetry: () => void
  /** The user acknowledged the refusal and is leaving for the cart. */
  onBackToCart?: () => void
}) {
  const heading = React.useRef<HTMLHeadingElement>(null)
  const message = order.declineReason?.message ?? 'O pagamento não foi aprovado.'
  const { id } = order

  React.useEffect(() => {
    announce(`Pagamento recusado. ${message}`, 'assertive')
    heading.current?.focus()
  }, [id, message])

  return (
    <section
      aria-labelledby="order-status-title"
      data-testid="order-declined"
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-md bg-surface-card px-6 py-12 text-center"
    >
      <AlertCircleIcon className="size-10 text-error" />
      <h2
        ref={heading}
        id="order-status-title"
        tabIndex={-1}
        className="text-heading text-foreground outline-none"
      >
        Pagamento recusado
      </h2>
      <p className="text-body-lg text-foreground">{message}</p>
      <p className="max-w-md text-body text-text-secondary">
        Pedido {order.id}. Seu carrinho continua como estava e nada foi cobrado.
      </p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button type="button" onClick={onRetry}>
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link to="/cart" onClick={onBackToCart}>
            Voltar ao carrinho
          </Link>
        </Button>
      </div>
    </section>
  )
}
