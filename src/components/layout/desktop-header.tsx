import { Link, useLocation } from '@tanstack/react-router'
import type * as React from 'react'

import { CartIcon, LogoutIcon, SearchIcon } from '@/components/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { cartLabel } from './cart-label'
import { PageContainer } from './page-container'
import type { ShellSession } from './session'
import type { ShellConfig } from './shell-config'
import { Unavailable } from './unavailable'

// Figma: nav text sits at the top of the 45 row; the active rule is 24 below it, on the divider.
const navItem =
  'relative flex pb-6 text-body-lg text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 hover:text-text-accent'
const navItemActive = 'font-bold text-text-accent after:bg-text-accent'

export interface DesktopHeaderProps extends React.ComponentProps<'header'> {
  nav: ShellConfig['nav']
  divider: boolean
  cartCount: number
  session: ShellSession
  onSearch?: (() => void) | undefined
}

/** Figma "Header With Divider" / "Header Row" (DS-25). Presentational: data comes from the shell. */
export function DesktopHeader({
  nav,
  divider,
  cartCount,
  session,
  onSearch,
  className,
  ...props
}: DesktopHeaderProps) {
  const location = useLocation()
  const redirect = location.href

  return (
    <header className={cn('pt-6', className)} {...props}>
      <PageContainer>
        <div
          className={cn(
            'flex h-11.25 items-start justify-between',
            divider && 'border-b border-border',
          )}
        >
          <Link
            to="/"
            aria-label="KURIO, início"
            className="flex h-8.5 w-40 items-center text-body font-bold tracking-brand text-foreground"
          >
            KURIO
          </Link>

          <nav aria-label="Principal">
            <ul className="flex gap-10">
              <li>
                <Link
                  to="/"
                  activeOptions={{ exact: true, includeHash: true }}
                  className={cn(navItem, nav === 'home' && navItemActive)}
                >
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/"
                  hash="mercado"
                  activeOptions={{ exact: true, includeHash: true }}
                  className={cn(navItem, nav === 'market' && navItemActive)}
                >
                  Mercado
                </Link>
              </li>
              <li>
                <Unavailable className={navItem}>Criadores</Unavailable>
              </li>
              <li>
                <Unavailable className={navItem}>Aprenda</Unavailable>
              </li>
            </ul>
          </nav>

          <div className="flex h-8.5 items-center gap-7">
            <div className="flex items-center gap-2">
              {onSearch ? (
                <Button variant="ghost" size="icon" aria-label="Buscar" onClick={onSearch}>
                  <SearchIcon />
                </Button>
              ) : (
                <Unavailable
                  as="button"
                  aria-label="Buscar"
                  className="flex size-10 items-center justify-center rounded-sm text-foreground"
                >
                  <SearchIcon className="size-5" />
                </Unavailable>
              )}

              <Link
                to="/cart"
                aria-label={cartLabel(cartCount)}
                className="relative flex size-10 items-center justify-center rounded-sm text-foreground hover:text-text-accent"
              >
                <CartIcon className="size-6" />
                {cartCount > 0 && (
                  <Badge variant="count" className="absolute top-1.5 right-0.5" aria-hidden="true">
                    {cartCount > 99 ? '99+' : cartCount}
                  </Badge>
                )}
              </Link>
            </div>

            {session.status === 'guest' ? (
              <Button asChild size="sm" className="w-25 gap-1 px-0">
                <Link to="/login" search={location.pathname === '/login' ? {} : { redirect }}>
                  <LogoutIcon data-icon="inline-start" />
                  Entrar
                </Link>
              </Button>
            ) : (
              <Link to="/profile" aria-label={`Perfil de ${session.name}`} className="rounded-full">
                <Avatar>
                  {session.avatarUrl && <AvatarImage src={session.avatarUrl} alt="" />}
                  <AvatarFallback>{session.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
            )}
          </div>
        </div>
      </PageContainer>
    </header>
  )
}
