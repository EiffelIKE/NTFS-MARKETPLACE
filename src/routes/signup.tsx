import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: 'Criar conta · KURIO' }] }),
  component: SignupPage,
})

function SignupPage() {
  return (
    <main>
      <h1>Criar conta</h1>
    </main>
  )
}
