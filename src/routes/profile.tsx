import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile')({
  head: () => ({ meta: [{ title: 'Perfil · KURIO' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <main>
      <h1>Perfil</h1>
    </main>
  )
}
