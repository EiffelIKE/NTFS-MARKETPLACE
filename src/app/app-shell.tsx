import { useRouterState } from '@tanstack/react-router'
import * as React from 'react'

import { Announcer, Toaster } from '@/components/feedback'
import { DesktopFooter } from '@/components/layout/desktop-footer'
import { DesktopHeader } from '@/components/layout/desktop-header'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import type { ShellSession } from '@/components/layout/session'
import { useShellConfig } from '@/components/layout/shell-config'
import { SkipLink } from '@/components/layout/skip-link'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useCartCount } from '@/features/cart/model/use-cart'
import { RouteFavorite } from '@/features/favorites/components/route-favorite'
import { SearchDialog } from '@/features/catalog/components/search-dialog'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useRouteFocus } from './use-route-focus'
import { useSession } from '@/features/auth/model/use-session'
import type { SessionState } from '@/features/auth/model/session'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// The only place specs plug data into the shell (DS-28): session (04), search (05), cart count (06)
// and the details favorite in the mobile top bar (06).
function shellSession(state: SessionState): ShellSession {
  return state.status === 'authenticated'
    ? { status: 'user', name: state.user.displayName, avatarUrl: state.user.avatarUrl ?? undefined }
    : { status: 'guest' }
}

/**
 * Both compositions stay in the DOM and switch at `lg` with CSS (`display: none` also removes the
 * hidden one from the accessibility tree), so there is no layout jump after first paint.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const shell = useShellConfig()
  const state = useSession()
  const session = shellSession(state)
  const cartCount = useCartCount()
  const { mobile } = shell
  useRouteFocus()

  // Search (CAT-25): on the mobile home the catalog's own field takes focus; everywhere else,
  // including desktop home where Figma draws only the icon, a dialog opens.
  const [searchOpen, setSearchOpen] = React.useState(false)
  const onHome = useRouterState({ select: (router) => router.location.pathname === '/' })
  const wide = useMediaQuery('(min-width: 1024px)')
  const onSearch = () => {
    const field = document.getElementById('catalog-search')
    if (onHome && !wide && field) {
      field.scrollIntoView({ block: 'center' })
      field.focus({ preventScroll: true })
    } else {
      setSearchOpen(true)
    }
  }

  return (
    <TooltipProvider>
      <SkipLink href="#conteudo">Pular para o conteúdo</SkipLink>
      <DesktopHeader
        className="hidden lg:block"
        nav={shell.nav}
        divider={shell.headerDivider}
        cartCount={cartCount}
        session={session}
        userMenu={
          session.status === 'user' && (
            <UserMenu name={session.name} avatarUrl={session.avatarUrl} />
          )
        }
        onSearch={onSearch}
      />
      {mobile.kind === 'inner' && (
        <MobileTopBar
          className="lg:hidden"
          title={mobile.title}
          trailing={mobile.trailing === 'favorite' ? <RouteFavorite /> : undefined}
        />
      )}
      <main
        id="conteudo"
        tabIndex={-1}
        className={cn(
          'outline-none lg:pt-8 lg:pb-0',
          mobile.kind === 'tab' && 'pb-[calc(126px+env(safe-area-inset-bottom))]',
          mobile.kind !== 'inner' && 'pt-10',
        )}
      >
        {children}
      </main>
      <DesktopFooter className="hidden lg:block" />
      {mobile.kind === 'tab' && (
        <MobileTabBar
          className="lg:hidden"
          active={mobile.tab}
          cartCount={cartCount}
          onSearch={onSearch}
        />
      )}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
      <Announcer />
    </TooltipProvider>
  )
}
