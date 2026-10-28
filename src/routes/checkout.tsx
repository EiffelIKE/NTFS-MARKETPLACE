import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/checkout')({
  staticData: {
    shell: {
      nav: 'market',
      headerDivider: false,
      mobile: { kind: 'inner', title: 'Pagamento com carteira' },
    },
  },
  head: () => ({ meta: [{ title: 'Finalizar compra · KURIO' }] }),
  component: CheckoutPage,
})

function CheckoutPage() {
  return (
    <div>
      <h1>Finalizar compra</h1>
    </div>
  )
}
