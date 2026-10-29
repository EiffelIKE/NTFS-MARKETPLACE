import { createFileRoute } from '@tanstack/react-router'

import { AuthPage } from '@/features/auth/components/auth-page'
import { authSearchSchema } from '@/features/auth/model/auth-search'
import { redirectIfAuthenticated } from '@/features/auth/model/redirects'

export const Route = createFileRoute('/signup')({
  staticData: { shell: { nav: 'home', headerDivider: true, mobile: { kind: 'bare' } } },
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  head: () => ({ meta: [{ title: 'Criar conta · KURIO' }] }),
  component: SignupPage,
})

function SignupPage() {
  return <AuthPage mode="signup" search={Route.useSearch()} />
}
