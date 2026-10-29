import type { Page } from '@playwright/test'

import type { MockControl } from '../../src/mocks/control-types'
import { CREDENTIALS, type CredentialName } from '../../src/mocks/fixtures/credentials'

// Helpers over `window.__mock` and the service worker (spec 02 §13). The page is where the mock
// runs, so every call goes through `page.evaluate`.

type Remote<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never
}

/**
 * A typed proxy over `window.__mock`: `await mock(page).useScenario('slow')`. Each call first waits
 * for `__mock`: the shell renders before the mock finishes booting (spec 13), so a view that needs
 * no request can be on screen before the control API exists.
 */
export function mock(page: Page): Remote<MockControl> {
  return new Proxy({} as Remote<MockControl>, {
    get:
      (_target, name: string) =>
      async (...args: unknown[]) => {
        await page.waitForFunction(() => '__mock' in window)
        return page.evaluate(
          ([method, params]) => {
            const control = (
              window as unknown as { __mock?: Record<string, (...a: unknown[]) => unknown> }
            ).__mock
            const fn = control?.[method]
            if (!fn) throw new Error(`window.__mock.${method} is not available`)
            return fn(...params)
          },
          [name, args] as [string, unknown[]],
        )
      },
  })
}

export interface ApiResponse<T = unknown> {
  status: number
  body: T
}

/** `fetch('/api' + path)` inside the page, so it goes through the service worker. */
export async function apiFetch<T = unknown>(
  page: Page,
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  return page.evaluate(
    async ([url, options]) => {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      })
      const text = await response.text()
      return { status: response.status, body: text ? (JSON.parse(text) as unknown) : undefined }
    },
    [`/api${path}`, init] as const,
  ) as Promise<ApiResponse<T>>
}

/** The app's own storage key for the session (spec 04), so the next navigation starts signed in. */
export const SESSION_STORAGE_KEY = 'kurio.session'

/**
 * Logs in with a fixture user through the API and returns the bearer token. It also writes the
 * session payload where the app keeps it (spec 04 amendment), so the next navigation starts signed
 * in: `await loginAs(page, 'ana'); await page.goto('/profile')`. The page that is already open
 * does not notice, because a tab never gets a `storage` event for its own writes. Pass
 * `{ seed: false }` for a token only.
 */
export async function loginAs(
  page: Page,
  name: CredentialName,
  { seed = true }: { seed?: boolean } = {},
): Promise<string> {
  // `apiFetch` needs a page the service worker controls.
  if (page.url() === 'about:blank') await page.goto('/')
  // Right after `goto` the worker may not have started yet; `__mock` appears once it has.
  await page.waitForFunction(() => '__mock' in window)
  const { email, password } = CREDENTIALS[name]
  const { status, body } = await apiFetch<{ token: string }>(page, '/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  if (status !== 200) throw new Error(`Login as ${name} failed with ${String(status)}`)
  if (seed) {
    await page.evaluate(
      ([key, payload]) => {
        localStorage.setItem(key, payload)
      },
      [SESSION_STORAGE_KEY, JSON.stringify(body)] as const,
    )
  }
  return body.token
}

/**
 * Drops the app's stored session. A `?reset=1` or scenario switch clears the mock's sessions, so a
 * session left in storage would be refused (and logged as a 401) when the app restores it.
 */
export async function forgetSession(page: Page): Promise<void> {
  await page.evaluate((key) => {
    localStorage.removeItem(key)
  }, SESSION_STORAGE_KEY)
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
