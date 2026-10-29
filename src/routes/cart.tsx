import { createFileRoute } from '@tanstack/react-router'

import { cartQueryOptions } from '@/features/cart/api/cart-queries'
import { CartPage } from '@/features/cart/components/cart-page'

const noop = () => undefined

export const Route = createFileRoute('/cart')({
  // Public: a guest has a cart too (CART-01). The read starts with the navigation but is not
  // awaited, so the page opens at once with its skeleton (spec 07 design §3).
  loader: ({ context: { queryClient, session } }) => {
    void queryClient.query(cartQueryOptions(session.owner())).catch(noop)
  },
  staticData: {
    shell: {
      nav: 'market',
      headerDivider: false,
      mobile: { kind: 'inner', title: 'Carrinho de NFTs' },
    },
  },
  head: () => ({ meta: [{ title: 'Carrinho · KURIO' }] }),
  component: CartPage,
})
