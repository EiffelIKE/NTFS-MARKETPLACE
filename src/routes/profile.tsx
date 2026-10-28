import { createFileRoute } from '@tanstack/react-router'

import { profileQueryOptions } from '@/features/account/api/profile-queries'
import { ProfilePage } from '@/features/account/components/profile-page'
import { requireAuth } from '@/features/auth/model/redirects'

const noop = () => undefined

export const Route = createFileRoute('/profile')({
  beforeLoad: requireAuth,
  // The read starts with the navigation but is not awaited, so the page opens at once with its
  // skeleton (spec 08 design §3).
  loader: ({ context: { queryClient, session } }) => {
    const owner = session.owner()
    if (owner.kind === 'user') void queryClient.query(profileQueryOptions(owner.userId)).catch(noop)
  },
  staticData: {
    requiresAuth: true,
    shell: { nav: 'home', headerDivider: true, mobile: { kind: 'tab', tab: 'profile' } },
  },
  head: () => ({ meta: [{ title: 'Meu perfil · KURIO' }] }),
  component: ProfilePage,
})
