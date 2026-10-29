// `/dev/*` gating (spec 14 §9, R10 / G8). The developer harnesses (`/dev/ui-kit`,
// `/dev/realtime`) are reachable in a production build only when `VITE_ENABLE_DEV_ROUTES=true` is
// set at build time. Otherwise each route module is replaced by a stub that answers not-found, so
// the harness code never reaches `dist/`; the generated route tree is untouched.
import path from 'node:path'

import type { Plugin } from 'vite'

const DEV_ROUTE_FILE = /[\\/]src[\\/]routes[\\/]dev[\\/]([\w-]+)\.tsx$/

/** Dev server: on. Build: on only when `VITE_ENABLE_DEV_ROUTES` is exactly `true`. */
export function devRoutesEnabled(command: 'serve' | 'build', flag: string | undefined): boolean {
  if (flag !== undefined && flag !== '') return flag === 'true'
  return command === 'serve'
}

/** The source of the stub that stands in for `src/routes/dev/<name>.tsx`. */
export function disabledRouteSource(name: string): string {
  return [
    `import { createFileRoute, notFound } from '@tanstack/react-router'`,
    `export const Route = createFileRoute('/dev/${name}')({`,
    `  beforeLoad: () => {`,
    `    throw notFound()`,
    `  },`,
    `})`,
    ``,
  ].join('\n')
}

export function stripDevRoutes(enabled: boolean): Plugin {
  return {
    name: 'kurio:strip-dev-routes',
    enforce: 'pre',
    transform(_code, id) {
      if (enabled) return null
      const file = id.split('?')[0] ?? id
      const name = DEV_ROUTE_FILE.exec(file)?.[1]
      if (!name) return null
      return { code: disabledRouteSource(path.basename(name)), map: null }
    },
  }
}
