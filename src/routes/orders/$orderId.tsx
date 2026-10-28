import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/orders/$orderId')({
  head: () => ({ meta: [{ title: 'Confirmação do pedido · KURIO' }] }),
  component: OrderConfirmationPage,
})

function OrderConfirmationPage() {
  return (
    <main>
      <h1>Confirmação do pedido</h1>
    </main>
  )
}
