import axios from 'axios'

import { env } from '@/lib/env'

import { toApiError } from './errors'

/** The only Axios instance for REST. Query functions pass TanStack Query's `signal` per request. */
export const http = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)
