import type { z } from 'zod'

import type { HttpMethod, OperationId } from '@/contracts'
import { http } from '@/lib/http/client'
import { ApiError } from '@/lib/http/errors'

interface RequestOptions<S extends z.ZodType> {
  id: OperationId
  method: HttpMethod
  url: string
  /** Success schema. For a 204 use `z.undefined()`. */
  response: S
  params?: Record<string, string | undefined>
  data?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal | undefined
}

/**
 * The only way features reach the REST API (API-03, API-04): one Axios call, then the response is
 * parsed with the operation's schema. A mismatch is an `ApiError` of kind `contract`, never
 * unvalidated data.
 */
export async function request<S extends z.ZodType>(op: RequestOptions<S>): Promise<z.output<S>> {
  const { id, method, url, params, data, headers, signal } = op
  let body: unknown
  try {
    const response = await http.request<unknown>({
      method,
      url,
      ...(params && { params }),
      ...(data !== undefined && { data }),
      ...(headers && { headers }),
      ...(signal && { signal }),
    })
    body = response.status === 204 ? undefined : response.data
  } catch (error) {
    throw error instanceof ApiError ? error.withOperation(id) : error
  }

  const parsed = op.response.safeParse(body)
  if (parsed.success) return parsed.data
  if (import.meta.env.DEV) console.error(`Contract mismatch in ${id}`, parsed.error.issues)
  throw new ApiError('contract', 'Resposta inesperada do servidor.', {
    operation: id,
    data: body,
    cause: parsed.error,
  })
}

/** Options accepted by every read operation (API-05). */
export interface ReadOptions {
  signal?: AbortSignal | undefined
}

/** URL-encodes one path segment. */
export function path(segment: string): string {
  return encodeURIComponent(segment)
}
