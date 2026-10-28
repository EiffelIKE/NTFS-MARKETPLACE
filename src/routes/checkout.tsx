import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/checkout')({
  head: () => ({ meta: [{ title: 'Finalizar compra · KURIO' }] }),
  component: CheckoutPage,
})

function CheckoutPage() {
  return (
    <main>
      <h1>Finalizar compra</h1>
    </main>
  )
}
