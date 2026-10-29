import { HttpResponse, http, type HttpHandler, type WebSocketHandler } from 'msw'

import type { OperationId } from '@/contracts'
import { MOCK_HEALTH_HEADER } from '@/lib/mock-recovery'

import type { MockRuntime } from '../runtime'
import { realtimeHandler } from '../realtime/handler'
import { authOps } from './auth'
import { cartOps } from './cart'
import { catalogOps } from './catalog'
import { explorerOps } from './explorer'
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
  ...explorerOps,
  ...favoriteOps,
  ...networkOps,
  ...cartOps,
  ...orderOps,
  ...profileOps,
  ...walletOps,
}

/** Not part of the contract: the boot's interception probe (`lib/mock-recovery.ts`). */
export const healthPath = '/__mock/health'

/**
 * Answers the probe from the worker, outside the pipeline: no latency, no failure rules, no log.
 * A page whose requests reach the network instead gets the SPA's HTML, without the marker header.
 */
function health(runtime: MockRuntime): HttpHandler {
  return http.get(`${runtime.baseUrl}${healthPath}`, () => {
    return new HttpResponse(null, {
      status: 204,
      headers: { [MOCK_HEALTH_HEADER]: '1', 'Cache-Control': 'no-store' },
    })
  })
}

/**
 * One MSW handler per operation of the contract, the Socket.IO endpoint (spec 03), then the 404
 * catch-all.
 */
export function createHandlers(runtime: MockRuntime): (HttpHandler | WebSocketHandler)[] {
  return [health(runtime), ...routes(runtime, OPS), realtimeHandler(runtime), fallback(runtime)]
}
