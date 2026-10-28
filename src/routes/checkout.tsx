import { createFileRoute } from '@tanstack/react-router'

import { profileQueryOptions } from '@/features/account/api/profile-queries'
import { walletsQueryOptions } from '@/features/account/api/wallets-queries'
import { requireAuth } from '@/features/auth/model/redirects'
import { cartQueryOptions } from '@/features/cart/api/cart-queries'
import { networksQueryOptions } from '@/features/checkout/api/checkout-queries'
import { CheckoutPage } from '@/features/checkout/components/checkout-page'
import { pendingOrdersQueryOptions } from '@/features/orders/api/order-queries'

const noop = () => undefined

export const Route = createFileRoute('/checkout')({
  beforeLoad: requireAuth,
  // The reads start with the navigation and run in parallel, but nothing is awaited: the page
  // opens at once with its skeleton, and each region shows its own error (spec 09 design §3).
  loader: ({ context: { queryClient, session } }) => {
    const owner = session.owner()
    if (owner.kind !== 'user') return
    void queryClient.query(cartQueryOptions(owner)).catch(noop)
    void queryClient.query(profileQueryOptions(owner.userId)).catch(noop)
    void queryClient.query(walletsQueryOptions(owner.userId)).catch(noop)
    void queryClient.query(networksQueryOptions()).catch(noop)
    void queryClient.query(pendingOrdersQueryOptions()).catch(noop)
  },
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
