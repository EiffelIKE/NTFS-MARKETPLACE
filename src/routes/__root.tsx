import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/app/app-shell'
import type { RouterContext } from '@/app/router'
import { NotFound } from '@/components/route-states'

export const Route = createRootRouteWithContext<RouterContext>()({
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
