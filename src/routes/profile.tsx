import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/model/redirects'

export const Route = createFileRoute('/profile')({
  beforeLoad: requireAuth,
  staticData: {
    requiresAuth: true,
    shell: { nav: 'home', headerDivider: true, mobile: { kind: 'tab', tab: 'profile' } },
  },
  head: () => ({ meta: [{ title: 'Perfil · KURIO' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <div>
      <h1>Perfil</h1>
    </div>
  )
}
