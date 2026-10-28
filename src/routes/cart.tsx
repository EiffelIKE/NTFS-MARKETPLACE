import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho · KURIO' }] }),
  component: CartPage,
})

function CartPage() {
  return (
    <main>
      <h1>Carrinho</h1>
    </main>
  )
}
