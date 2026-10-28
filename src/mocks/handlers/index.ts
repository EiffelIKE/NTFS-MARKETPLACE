import type { HttpHandler, WebSocketHandler } from 'msw'

import type { OperationId } from '@/contracts'

import type { MockRuntime } from '../runtime'
import { realtimeHandler } from '../realtime/handler'
import { authOps } from './auth'
import { cartOps } from './cart'
import { catalogOps } from './catalog'
import { favoriteOps } from './favorites'
import { networkOps } from './networks'
import { orderOps } from './orders'
import { fallback, routes, type AnyOp } from './pipeline'
import { profileOps } from './profile'
import { walletOps } from './wallets'

/** Every operation must have a handler: the type fails to compile when one is missing. */
const OPS: Record<OperationId, AnyOp> = {
  ...authOps,
  ...catalogOps,
  ...favoriteOps,
  ...networkOps,
  ...cartOps,
  ...orderOps,
  ...profileOps,
  ...walletOps,
}

/**
 * One MSW handler per operation of the contract, the Socket.IO endpoint (spec 03), then the 404
 * catch-all.
 */
export function createHandlers(runtime: MockRuntime): (HttpHandler | WebSocketHandler)[] {
  return [...routes(runtime, OPS), realtimeHandler(runtime), fallback(runtime)]
}
