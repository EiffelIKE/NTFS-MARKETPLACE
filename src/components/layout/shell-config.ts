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
    | { kind: 'inner'; title?: string; trailing?: 'favorite' }
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

/** Shell config of the deepest matched route that declares one. */
export function useShellConfig(): ShellConfig {
  return useMatches({
    select: (matches) =>
      matches.findLast((match) => match.staticData.shell)?.staticData.shell ?? defaultShellConfig,
  })
}
