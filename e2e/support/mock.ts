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

/** A typed proxy over `window.__mock`: `await mock(page).useScenario('slow')`. */
export function mock(page: Page): Remote<MockControl> {
  return new Proxy({} as Remote<MockControl>, {
    get:
      (_target, name: string) =>
      (...args: unknown[]) =>
        page.evaluate(
          ([method, params]) => {
            const control = (
              window as unknown as { __mock?: Record<string, (...a: unknown[]) => unknown> }
            ).__mock
            const fn = control?.[method]
            if (!fn) throw new Error(`window.__mock.${method} is not available`)
            return fn(...params)
          },
          [name, args] as [string, unknown[]],
        ),
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

/** Logs in with a fixture user through the API and returns the bearer token. */
export async function loginAs(page: Page, name: CredentialName): Promise<string> {
  const { email, password } = CREDENTIALS[name]
  const { status, body } = await apiFetch<{ token: string }>(page, '/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  if (status !== 200) throw new Error(`Login as ${name} failed with ${String(status)}`)
  return body.token
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
