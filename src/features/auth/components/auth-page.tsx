import { Link, useRouter } from '@tanstack/react-router'

import { CloseIcon } from '@/components/icons'
import { HrefLink } from '@/components/href-link'
import { PageContainer } from '@/components/layout/page-container'

import type { AuthSearch } from '../model/auth-search'
import { closeTarget, pathRequiresAuth } from '../model/redirects'
import { AuthTabs } from './auth-tabs'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'
import { SocialLoginButtons } from './social-login'

const COPY = {
  login: {
    subtitle: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    mobileTitle: 'Entrar',
    desktopTitle: 'Entrar',
  },
  signup: {
    subtitle: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    mobileTitle: 'Criar perfil de colecionador',
    desktopTitle: 'Criar conta',
  },
} as const

/**
 * `/login` and `/signup` (AUTH-19). One form instance serves both compositions: from `lg` it sits in
 * the Figma panel (tabs, close, accent bar), below it is a bare page with the logo and a footer
 * link. Desktop-only and mobile-only parts are hidden with CSS, which also removes them from the
 * accessibility tree.
 */
export function AuthPage({ mode, search }: { mode: 'login' | 'signup'; search: AuthSearch }) {
  const router = useRouter()
  const copy = COPY[mode]
  const carried = { redirect: search.redirect }
  const close = closeTarget((pathname) => pathRequiresAuth(router, pathname), search.redirect)

  return (
    <PageContainer className="px-0 lg:px-6">
      <div className="relative mx-auto flex w-full max-w-125 flex-col lg:mt-15 lg:min-h-150 lg:bg-surface-card">
        {/* Desktop: close button and tabs. */}
        <HrefLink
          href={close}
          aria-label="Fechar"
          className="absolute top-2 right-2.25 z-10 hidden size-6 items-center justify-center rounded-xs text-primary hover:text-text-accent lg:flex"
        >
          <CloseIcon className="size-5" />
        </HrefLink>

        {/* Mobile: logo and title. */}
        <Link
          to="/"
          aria-label="KURIO, início"
          className="mx-auto mt-22 w-fit text-[1.875rem] leading-10 font-bold tracking-brand text-foreground lg:hidden"
        >
          KURIO
        </Link>
        <h1 className="mt-20 mb-8 px-4 text-center text-title text-foreground lg:hidden">
          {copy.mobileTitle}
        </h1>

        <AuthTabs mode={mode} search={search} className="mt-11.5 hidden lg:flex" />
        <h1 className="sr-only max-lg:hidden">{copy.desktopTitle}</h1>
        <p className="mx-auto mt-10 mb-5.5 hidden max-w-105 px-4 text-center text-caption leading-4 font-normal text-foreground lg:block lg:px-0">
          {copy.subtitle}
        </p>

        <div className="flex w-full flex-col gap-4 px-4 lg:mx-auto lg:w-85 lg:px-0">
          {mode === 'login' ? <LoginForm search={search} /> : <SignupForm search={search} />}
          <SocialLoginButtons />
        </div>

        {/* Mobile: link to the other page. */}
        <p className="mt-12 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-body text-text-secondary lg:hidden">
          {mode === 'login' ? (
            <>
              Novo na Kurio?{' '}
              <Link to="/signup" search={carried} className="text-text-accent underline">
                Crie uma conta
              </Link>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <Link to="/login" search={carried} className="text-text-accent underline">
                Entre
              </Link>
            </>
          )}
        </p>

        {/* Desktop: the accent bar along the bottom edge. */}
        <div className="mt-auto hidden pt-10 lg:block">
          <div aria-hidden="true" className="h-2.5 bg-primary" />
        </div>
      </div>
    </PageContainer>
  )
}
