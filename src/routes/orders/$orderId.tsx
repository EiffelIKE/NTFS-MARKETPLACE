import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/orders/$orderId')({
  staticData: {
    shell: { nav: 'market', headerDivider: false, mobile: { kind: 'inner', title: 'Pedido' } },
  },
  head: () => ({ meta: [{ title: 'Confirmação do pedido · KURIO' }] }),
  component: OrderConfirmationPage,
})

function OrderConfirmationPage() {
  return (
    <div>
      <h1>Confirmação do pedido</h1>
    </div>
  )
}
