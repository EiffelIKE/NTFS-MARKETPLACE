import axios from 'axios'

import { backendReady } from '@/lib/backend-ready'
import { env } from '@/lib/env'

import { toApiError } from './errors'

/** The only Axios instance for REST. Query functions pass TanStack Query's `signal` per request. */
export const http = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
  // The fetch adapter enforces `timeout` with `setTimeout`, so fake clocks (Playwright `page.clock`,
  // Vitest fake timers) control it; the XHR adapter uses the browser's native `xhr.timeout`.
  adapter: 'fetch',
})

// Let the runtime set `multipart/form-data` with its boundary: Axios' default urlencoded header
// would otherwise survive in non-browser runtimes (Node, where the contract tests run).
http.interceptors.request.use(async (config) => {
  // The mock worker may still be starting while the shell renders (`lib/backend-ready.ts`).
  await backendReady()
  if (config.data instanceof FormData) config.headers.setContentType(false)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)
