import { createFileRoute } from '@tanstack/react-router'

import { walletsQueryOptions } from '@/features/account/api/wallets-queries'
import { WalletsPage } from '@/features/account/components/wallets-page'
import { requireAuth } from '@/features/auth/model/redirects'

const noop = () => undefined

export const Route = createFileRoute('/wallets')({
  beforeLoad: requireAuth,
  loader: ({ context: { queryClient, session } }) => {
    const owner = session.owner()
    if (owner.kind === 'user') void queryClient.query(walletsQueryOptions(owner.userId)).catch(noop)
  },
  staticData: {
    requiresAuth: true,
    shell: { nav: 'home', headerDivider: true, mobile: { kind: 'inner', title: 'Carteiras' } },
  },
  head: () => ({ meta: [{ title: 'Carteiras · KURIO' }] }),
  component: WalletsPage,
})
