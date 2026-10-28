import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'KURIO — Marketplace de NFTs' }] }),
  component: HomePage,
})

// Placeholder navigation until spec 05 builds the catalog.
function HomePage() {
  return (
    <main>
      <h1>KURIO</h1>
      <nav aria-label="Telas">
        <ul>
          <li>
            <Link to="/nfts/$nftId" params={{ nftId: '1' }}>
              Detalhes do NFT
            </Link>
          </li>
          <li>
            <Link to="/cart">Carrinho</Link>
          </li>
          <li>
            <Link to="/checkout">Finalizar compra</Link>
          </li>
          <li>
            <Link to="/orders/$orderId" params={{ orderId: '1' }}>
              Confirmação do pedido
            </Link>
          </li>
          <li>
            <Link to="/login">Entrar</Link>
          </li>
          <li>
            <Link to="/signup">Criar conta</Link>
          </li>
          <li>
            <Link to="/profile">Perfil</Link>
          </li>
          <li>
            <Link to="/wallets">Carteiras</Link>
          </li>
        </ul>
      </nav>
    </main>
  )
}
