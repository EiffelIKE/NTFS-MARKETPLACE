import { createFileRoute } from '@tanstack/react-router'

import { loginSearchSchema } from './-login-search'

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  head: () => ({ meta: [{ title: 'Entrar · KURIO' }] }),
  component: LoginPage,
})

function LoginPage() {
  return (
    <main>
      <h1>Entrar</h1>
    </main>
  )
}
