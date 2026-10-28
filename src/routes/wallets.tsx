import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/model/redirects'

export const Route = createFileRoute('/wallets')({
  beforeLoad: requireAuth,
  staticData: {
    requiresAuth: true,
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
