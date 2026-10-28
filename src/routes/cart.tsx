import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cart')({
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

function CartPage() {
  return (
    <div>
      <h1>Carrinho</h1>
    </div>
  )
}
