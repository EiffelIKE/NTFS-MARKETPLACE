import { createFileRoute, notFound } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/model/redirects'
import { orderQueryOptions } from '@/features/orders/api/order-queries'
import { OrderPage } from '@/features/receipt/components/order-page'
import {
  OrderForbidden,
  ReceiptError,
  ReceiptSkeleton,
} from '@/features/receipt/components/receipt-states'
import { isApiError } from '@/lib/http/errors'

export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: requireAuth,
  // The cache is used as it is (checkout seeds it with the order just paid); otherwise the API is
  // asked once. The page's own observer keeps the order fresh and follows its status.
  loader: async ({ context: { queryClient }, params: { orderId } }) => {
    try {
      await queryClient.query({ ...orderQueryOptions(orderId), staleTime: 'static' })
      return { forbidden: false }
    } catch (error) {
      if (isApiError(error, 'NOT_FOUND')) throw notFound()
      // Someone else's order: a view of its own, with nothing about the order in it (RCPT-03).
      if (isApiError(error, 'FORBIDDEN')) return { forbidden: true }
      throw error
    }
  },
  pendingComponent: ReceiptSkeleton,
  pendingMs: 150,
  pendingMinMs: 300,
  errorComponent: ReceiptError,
  staticData: {
    requiresAuth: true,
    shell: { nav: 'market', headerDivider: false, mobile: { kind: 'inner', title: 'Pedido' } },
  },
  component: OrderRoute,
})

function OrderRoute() {
  const { forbidden } = Route.useLoaderData()
  return forbidden ? <OrderForbidden /> : <OrderPage />
}
