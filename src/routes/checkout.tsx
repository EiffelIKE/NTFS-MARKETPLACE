import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/model/redirects'

export const Route = createFileRoute('/checkout')({
  beforeLoad: requireAuth,
  staticData: {
    requiresAuth: true,
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
