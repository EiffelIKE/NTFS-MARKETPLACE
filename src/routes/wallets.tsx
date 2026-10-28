import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras · KURIO' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  return (
    <main>
      <h1>Carteiras</h1>
    </main>
  )
}
