import type * as React from 'react'

import { Announcer, Toaster } from '@/components/feedback'
import { DesktopFooter } from '@/components/layout/desktop-footer'
import { DesktopHeader } from '@/components/layout/desktop-header'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import type { ShellSession } from '@/components/layout/session'
import { useShellConfig } from '@/components/layout/shell-config'
import { SkipLink } from '@/components/layout/skip-link'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// The only place later specs plug data into the shell (DS-28): session (04), search (05) and cart
// count (07). Until then the shell renders the guest / empty state.
const GUEST: ShellSession = { status: 'guest' }

/**
 * Both compositions stay in the DOM and switch at `lg` with CSS (`display: none` also removes the
 * hidden one from the accessibility tree), so there is no layout jump after first paint.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const shell = useShellConfig()
  const session = GUEST
  const cartCount = 0
  const onSearch = undefined
  const { mobile } = shell

  return (
    <TooltipProvider>
      <SkipLink href="#conteudo">Pular para o conteúdo</SkipLink>
      <DesktopHeader
        className="hidden lg:block"
        nav={shell.nav}
        divider={shell.headerDivider}
        cartCount={cartCount}
        session={session}
        onSearch={onSearch}
      />
      {mobile.kind === 'inner' && <MobileTopBar className="lg:hidden" title={mobile.title} />}
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
      <Toaster />
      <Announcer />
    </TooltipProvider>
  )
}
