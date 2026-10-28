import { lazy, Suspense } from 'react'

import { router } from './router'

// `import.meta.env.DEV` is replaced with `false` in production builds, so both dynamic imports
// are dead code there and never reach `dist/`.
const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : null

const QueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : null

export function Devtools() {
  if (!RouterDevtools || !QueryDevtools) return null
  return (
    <Suspense fallback={null}>
      <RouterDevtools router={router} position="bottom-left" />
      <QueryDevtools buttonPosition="bottom-right" />
    </Suspense>
  )
}
