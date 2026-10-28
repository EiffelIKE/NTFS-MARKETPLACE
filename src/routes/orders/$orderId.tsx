import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/model/redirects'

export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: requireAuth,
  staticData: {
    requiresAuth: true,
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
