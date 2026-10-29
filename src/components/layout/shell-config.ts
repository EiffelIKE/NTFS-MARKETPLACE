import { useMatches } from '@tanstack/react-router'

// Per-route shell configuration (spec 01 design §8), declared as `staticData.shell` on routes.

export type MobileTab = 'home' | 'favorites' | 'cart' | 'profile'

export interface ShellConfig {
  /** Desktop nav item highlighted (Figma "Active" variant). */
  nav: 'home' | 'market'
  /** Figma "Header With Divider" vs. "Header Row". */
  headerDivider: boolean
  mobile:
    | { kind: 'tab'; tab?: MobileTab }
    | { kind: 'inner'; title?: string; trailing?: 'favorite'; panel?: boolean }
    | { kind: 'bare' }
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    shell?: ShellConfig
  }
}

export const defaultShellConfig: ShellConfig = {
  nav: 'home',
  headerDivider: true,
  mobile: { kind: 'tab' },
}

/**
 * Shell config of the deepest matched route that declares one. On the home tab, `?favorites=1`
 * (spec 05) marks the favorites tab instead.
 */
export function useShellConfig(): ShellConfig {
  const match = useMatches({
    select: (matches) => matches.findLast((candidate) => candidate.staticData.shell),
  })
  const shell = match?.staticData.shell ?? defaultShellConfig
  const favorites = (match?.search as { favorites?: unknown } | undefined)?.favorites
  if (favorites !== undefined && shell.mobile.kind === 'tab' && shell.mobile.tab === 'home') {
    return { ...shell, mobile: { kind: 'tab', tab: 'favorites' } }
  }
  return shell
}
