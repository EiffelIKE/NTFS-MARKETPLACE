import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/wallets')({
  staticData: {
    shell: { nav: 'home', headerDivider: true, mobile: { kind: 'inner', title: 'Carteiras' } },
  },
  head: () => ({ meta: [{ title: 'Carteiras · KURIO' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  return (
    <div>
      <h1>Carteiras</h1>
    </div>
  )
}
