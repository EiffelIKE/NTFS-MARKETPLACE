import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile')({
  staticData: {
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
