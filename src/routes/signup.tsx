import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/signup')({
  staticData: { shell: { nav: 'home', headerDivider: true, mobile: { kind: 'bare' } } },
  head: () => ({ meta: [{ title: 'Criar conta · KURIO' }] }),
  component: SignupPage,
})

function SignupPage() {
  return (
    <div>
      <h1>Criar conta</h1>
    </div>
  )
}
