import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import type { AuthSearch } from '../model/auth-search'

const tab = 'px-2.5 text-[1.25rem] leading-6 font-medium text-foreground hover:text-text-accent'
const tabActive = 'text-text-accent'

/** "Entrar | Criar conta" (Figma desktop): links, so each tab is a real URL with its own history. */
export function AuthTabs({
  mode,
  search,
  className,
}: {
  mode: 'login' | 'signup'
  search: AuthSearch
  className?: string
}) {
  // The expired notice belongs to the login page only; the redirect travels between both.
  const carried = { redirect: search.redirect }
  return (
    <nav aria-label="Acesso à conta" className={cn('flex items-center justify-center', className)}>
      <Link
        to="/login"
        search={carried}
        className={cn(tab, mode === 'login' && tabActive)}
        {...(mode === 'login' && { 'aria-current': 'page' as const })}
      >
        Entrar
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-primary" />
      <Link
        to="/signup"
        search={carried}
        className={cn(tab, mode === 'signup' && tabActive)}
        {...(mode === 'signup' && { 'aria-current': 'page' as const })}
      >
        Criar conta
      </Link>
    </nav>
  )
}
