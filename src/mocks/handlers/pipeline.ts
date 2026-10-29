import { HttpResponse, http, type HttpHandler, type JsonBodyType } from 'msw'
import { z } from 'zod'

import {
  AUTHORIZATION_HEADER,
  ERROR_DEFAULTS,
  GUEST_CART_HEADER,
  OPERATIONS,
  type OperationId,
} from '@/contracts'

import type { MockConfig } from '../config'
import type { UserRecord } from '../db/state'
import { lookupSession, closeSession } from '../domain/auth'
import { HttpError } from '../lib/http-error'
import type { MockRuntime } from '../runtime'

// Server-side messages (422 field errors from zod) come out in pt-BR.
z.config(z.locales.ptBR())

/** The 12 steps of spec 02 §8.1, shared by every operation. */
export interface Ctx<Q, B> {
  runtime: MockRuntime
  config: MockConfig
  request: Request
  params: Record<string, string>
  query: Q
  body: B
  /** The resolved bearer session, when the operation is authenticated. */
  session: { token: string; user: UserRecord } | null
  /** `X-Guest-Cart-Id`, only without a session. */
  guestCartId: string | null
  /** Same as `session.user`, but throws 401 when there is none. */
  user: () => UserRecord
}

export interface Reply {
  status: number
  body?: unknown
}

export const ok = (body: unknown): Reply => ({ status: 200, body })
export const created = (body: unknown): Reply => ({ status: 201, body })
export const noContent = (): Reply => ({ status: 204 })

type Schema = z.ZodType

interface OpDefinition<Q extends Schema, B extends Schema> {
  /** Validated query string (with coercion built into the schema). */
  query?: Q
  /** Validated JSON body. */
  body?: B
  handle(ctx: Ctx<z.output<Q>, z.output<B>>): Reply | Promise<Reply>
}

export interface AnyOp {
  query?: Schema
  body?: Schema
  handle(ctx: Ctx<unknown, unknown>): Reply | Promise<Reply>
}

/** Declares a handler with typed `query` and `body`. */
export function op<Q extends Schema = z.ZodUndefined, B extends Schema = z.ZodUndefined>(
  definition: OpDefinition<Q, B>,
): AnyOp {
  return definition
}

function toFields(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_'
    ;(fields[key] ??= []).push(issue.message)
  }
  return fields
}

function envelope(error: HttpError): Response {
  return HttpResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields && { fields: error.fields }),
        ...(error.details !== undefined && { details: error.details }),
      },
    },
    { status: error.status },
  )
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get(AUTHORIZATION_HEADER)
  if (header === null) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match?.[1]) throw new HttpError('UNAUTHENTICATED')
  return match[1]
}

/** Operations whose auth mode is `optional` ignore the header only when none was sent. */
function resolveSession(
  runtime: MockRuntime,
  request: Request,
  auth: (typeof OPERATIONS)[OperationId]['auth'],
): { token: string; user: UserRecord } | null {
  if (auth === 'none') return null
  if (auth === 'lenient') {
    // Logout: a missing, malformed or expired token is not an error.
    try {
      const token = bearerToken(request)
      const lookup = token
        ? runtime.store.read((state) => lookupSession(state, token, Date.now()))
        : null
      return token && lookup?.kind === 'ok' ? { token, user: lookup.user } : null
    } catch {
      return null
    }
  }
  const token = bearerToken(request)
  if (token === null) {
    if (auth === 'required') throw new HttpError('UNAUTHENTICATED')
    return null
  }
  const lookup = runtime.store.read((state) => lookupSession(state, token, Date.now()))
  if (lookup.kind === 'ok') return { token, user: lookup.user }
  if (lookup.kind === 'expired') {
    runtime.store.write((tx) => {
      closeSession(tx, token)
    })
    throw new HttpError('SESSION_EXPIRED')
  }
  throw new HttpError('UNAUTHENTICATED')
}

async function readBody(request: Request, schema: Schema): Promise<unknown> {
  let raw: unknown
  try {
    const text = await request.text()
    raw = text ? (JSON.parse(text) as unknown) : undefined
  } catch {
    throw new HttpError('VALIDATION_FAILED', { fields: { _: ['Corpo da requisição inválido.'] } })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new HttpError('VALIDATION_FAILED', { fields: toFields(parsed.error) })
  return parsed.data
}

function readQuery(request: Request, schema: Schema): unknown {
  const raw = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new HttpError('VALIDATION_FAILED', { fields: toFields(parsed.error) })
  return parsed.data
}

function reply({ status, body }: Reply): Response {
  return status === 204
    ? new HttpResponse(null, { status })
    : HttpResponse.json(body as JsonBodyType, { status })
}

interface RouteInfo {
  request: Request
  params: Record<string, string | readonly string[] | undefined>
}

async function run(
  runtime: MockRuntime,
  id: OperationId,
  definition: AnyOp,
  { request, params }: RouteInfo,
): Promise<Response> {
  const { pathname, search } = new URL(request.url)
  const entry = runtime.network.log.start(id, request.method, pathname + search)
  const { signal } = request
  let hangAfter = false
  try {
    // 2. Network, before: failure rules first, then latency.
    const rule = runtime.network.match(id)
    if (rule) {
      const { effect } = rule
      if (effect.kind === 'network-error') {
        runtime.network.log.finish(entry, 'network-error')
        return HttpResponse.error()
      }
      if (effect.kind === 'timeout' && effect.phase === 'before') {
        runtime.network.log.finish(entry, 'timeout')
        return await runtime.network.hang(signal)
      }
      if (effect.kind === 'http') {
        await runtime.network.wait(runtime.network.latencyFor(id), signal)
        runtime.network.log.finish(entry, effect.status)
        // The one code whose envelope carries details (`retryAfterMs`), so the client parses it.
        const limited = effect.code === 'RATE_LIMITED'
        return HttpResponse.json(
          {
            error: {
              code: effect.code,
              message: ERROR_DEFAULTS[effect.code].message,
              ...(limited && { details: { retryAfterMs: 1000 } }),
            },
          },
          { status: effect.status, ...(limited && { headers: { 'Retry-After': '1' } }) },
        )
      }
      hangAfter = true
    }
    await runtime.network.wait(runtime.network.latencyFor(id), signal)

    // 3. Settlement tick.
    runtime.settlement.tick()

    // 4. Session. 5. Query and body. 6. Handler.
    const config = runtime.config.effective()
    const session = resolveSession(runtime, request, OPERATIONS[id].auth)
    const query = definition.query ? readQuery(request, definition.query) : undefined
    const body = definition.body ? await readBody(request, definition.body) : undefined
    const result = await definition.handle({
      runtime,
      config,
      request,
      params: Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ),
      query,
      body,
      session,
      guestCartId: session ? null : request.headers.get(GUEST_CART_HEADER),
      user() {
        if (!session) throw new HttpError('UNAUTHENTICATED')
        return session.user
      },
    })

    // 7. Network, after: the write committed, the response is lost.
    if (hangAfter) {
      runtime.network.log.finish(entry, 'timeout')
      return await runtime.network.hang(signal)
    }
    runtime.network.log.finish(entry, result.status)
    return reply(result)
  } catch (error) {
    if (signal.aborted) {
      runtime.network.log.finish(entry, 'aborted')
      return HttpResponse.error()
    }
    if (error instanceof HttpError) {
      runtime.network.log.finish(entry, error.status)
      return envelope(error)
    }
    console.error(`[mock] ${id} failed`, error)
    runtime.network.log.finish(entry, 500)
    return envelope(new HttpError('INTERNAL'))
  }
}

/** Registers one MSW handler per operation of the contract table. */
export function routes(
  runtime: MockRuntime,
  definitions: Record<OperationId, AnyOp>,
): HttpHandler[] {
  return (Object.keys(OPERATIONS) as OperationId[]).map((id) => {
    const { method, path } = OPERATIONS[id]
    const register = {
      GET: http.get,
      POST: http.post,
      PUT: http.put,
      PATCH: http.patch,
      DELETE: http.delete,
    }[method]
    return register(`${runtime.baseUrl}${path}`, (info) => run(runtime, id, definitions[id], info))
  })
}

/** Anything else under the API base is a 404 envelope, so a wrong path is never silent. */
export function fallback(runtime: MockRuntime): HttpHandler {
  return http.all(`${runtime.baseUrl}/*`, ({ request }) => {
    const { pathname, search } = new URL(request.url)
    const entry = runtime.network.log.start('unmatched', request.method, pathname + search)
    runtime.network.log.finish(entry, 404)
    return envelope(new HttpError('NOT_FOUND', { details: { resource: 'route' } }))
  })
}
