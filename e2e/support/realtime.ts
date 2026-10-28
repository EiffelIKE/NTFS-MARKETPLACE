import type { Page } from '@playwright/test'

import type { ConnectionInfo, RealtimeControl } from '../../src/mocks/realtime/types'
import { expect } from './test'

// Helpers over `window.__mock.realtime` (spec 03 §9). The mock server lives in the page, so every
// call goes through `page.evaluate`; the events themselves still travel through the real
// `socket.io-client` of the app.

type Remote<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never
}

/** A typed proxy over `window.__mock.realtime`: `await realtime(page).drop({ block: true })`. */
export function realtime(page: Page): Remote<RealtimeControl> {
  return new Proxy({} as Remote<RealtimeControl>, {
    get:
      (_target, name: string) =>
      (...args: unknown[]) =>
        page.evaluate(
          ([method, params]) => {
            const control = (
              window as unknown as {
                __mock?: { realtime?: Record<string, (...a: unknown[]) => unknown> }
              }
            ).__mock?.realtime
            const fn = control?.[method]
            if (!fn) throw new Error(`window.__mock.realtime.${method} is not available`)
            return fn(...params)
          },
          [name, args] as [string, unknown[]],
        ),
  })
}

/**
 * Waits until the mock server has an open connection (for `userId`, when given; `null` waits for
 * a guest) and returns the list. A connection counts for a user once its CONNECT `auth` arrived.
 */
export async function waitForConnection(
  page: Page,
  { userId, count = 1 }: { userId?: string | null; count?: number } = {},
): Promise<ConnectionInfo[]> {
  await page.waitForFunction(() => '__mock' in window)
  await expect
    .poll(
      async () => {
        const open = await realtime(page).connections()
        return open.filter((c) => userId === undefined || c.userId === userId).length
      },
      { message: 'open realtime connections' },
    )
    .toBe(count)
  return realtime(page).connections()
}
