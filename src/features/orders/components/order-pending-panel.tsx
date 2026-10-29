import * as React from 'react'

import { announce } from '@/components/feedback'
import { SpinnerIcon } from '@/components/icons'
import { NETWORK_LABELS, type Order } from '@/contracts'

/**
 * "Processando pagamento" (CHK-29): the order exists and is waiting for the simulated network.
 * Shown on checkout and, in spec 10, on the receipt route while the order is pending. The status
 * is announced once, politely, when the panel appears; the visible text is not a live region, so a
 * screen reader never hears it twice. `focusOnMount` is for the moment the user has just paid.
 */
export function OrderPendingPanel({
  order,
  focusOnMount = false,
}: {
  order: Pick<Order, 'id' | 'network'>
  focusOnMount?: boolean
}) {
  const heading = React.useRef<HTMLHeadingElement>(null)
  const { id } = order

  React.useEffect(() => {
    announce(`Processando pagamento. Pedido ${id}.`, 'polite')
    if (focusOnMount) heading.current?.focus()
  }, [id, focusOnMount])

  return (
    <section
      aria-labelledby="order-status-title"
      data-testid="order-pending"
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-md bg-surface-card px-6 py-12 text-center"
    >
      <SpinnerIcon className="size-10 text-text-accent motion-reduce:animate-none" />
      <h2
        ref={heading}
        id="order-status-title"
        tabIndex={-1}
        className="text-heading text-foreground outline-none"
      >
        Processando pagamento
      </h2>
      <p className="text-body-lg text-text-secondary">
        Pedido <span className="font-bold text-foreground">{order.id}</span> · aguardando
        confirmação da rede {NETWORK_LABELS[order.network]}
      </p>
      <p className="max-w-md text-body text-text-secondary">
        Você pode atualizar a página ou sair: o pedido continua de onde parou e não será cobrado de
        novo.
      </p>
    </section>
  )
}
