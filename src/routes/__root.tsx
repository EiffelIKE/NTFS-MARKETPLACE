import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/app/app-shell'
import type { RouterContext } from '@/app/router'
import { NotFound } from '@/components/route-states'
import { pageHead } from '@/lib/seo'

export const Route = createRootRouteWithContext<RouterContext>()({
  // Every route waits for the stored session to be verified (AUTH-08). With no stored session this
  // resolves at once, so a visitor's first render pays nothing.
  beforeLoad: ({ context }) => context.session.ready,
  // Public catalog routes opt into indexing. Account, checkout, and developer pages do not.
  head: () => pageHead({ noindex: true }),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <HeadContent />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  )
}
