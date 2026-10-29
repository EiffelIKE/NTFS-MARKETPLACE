import { describe, expect, it } from 'vitest'

import { devRoutesEnabled, disabledRouteSource, stripDevRoutes } from './dev-routes.ts'

type Transform = (code: string, id: string) => { code: string } | null

function transformOf(enabled: boolean): Transform {
  const plugin = stripDevRoutes(enabled)
  return plugin.transform as unknown as Transform
}

describe('devRoutesEnabled', () => {
  it('is on in the dev server and off in a build by default', () => {
    expect(devRoutesEnabled('serve', undefined)).toBe(true)
    expect(devRoutesEnabled('build', undefined)).toBe(false)
    expect(devRoutesEnabled('build', '')).toBe(false)
  })

  it('follows VITE_ENABLE_DEV_ROUTES when it is set, spelled exactly', () => {
    expect(devRoutesEnabled('build', 'true')).toBe(true)
    expect(devRoutesEnabled('serve', 'false')).toBe(false)
    expect(devRoutesEnabled('build', '1')).toBe(false)
  })
})

describe('stripDevRoutes', () => {
  const realtime = '/repo/src/routes/dev/realtime.tsx'

  it('replaces each /dev route module with a not-found stub when disabled', () => {
    const out = transformOf(false)('import { Heavy } from "@/features/dev-realtime/x"', realtime)
    expect(out?.code).toBe(disabledRouteSource('realtime'))
    expect(out?.code).toContain("createFileRoute('/dev/realtime')")
    expect(out?.code).toContain('throw notFound()')
    expect(out?.code).not.toContain('dev-realtime')
  })

  it('names the route after the file, also for the UI kit and with a query string', () => {
    const out = transformOf(false)('', '/repo/src/routes/dev/ui-kit.tsx?tsr-split=component')
    expect(out?.code).toContain("createFileRoute('/dev/ui-kit')")
  })

  it('handles Windows separators', () => {
    const out = transformOf(false)('', 'C:\\repo\\src\\routes\\dev\\realtime.tsx')
    expect(out?.code).toContain("createFileRoute('/dev/realtime')")
  })

  it('leaves every other module alone', () => {
    const transform = transformOf(false)
    expect(transform('x', '/repo/src/routes/cart.tsx')).toBeNull()
    expect(transform('x', '/repo/src/features/dev-realtime/connection.tsx')).toBeNull()
    expect(transform('x', '/repo/src/routes/dev/notes.md')).toBeNull()
  })

  it('does nothing when the routes are enabled', () => {
    expect(transformOf(true)('x', realtime)).toBeNull()
  })
})
