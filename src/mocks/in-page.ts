import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { WebSocketInterceptor } from '@mswjs/interceptors/WebSocket'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import { defineNetwork, InterceptorSource } from 'msw/experimental'

import type { createHandlers } from './handlers'

type InterceptorList = ConstructorParameters<typeof InterceptorSource>[0]['interceptors']

/**
 * The mock without a Service Worker: what MSW's own fallback mode does in a browser that has none.
 * The same handlers answer `fetch`, XHR and WebSocket from inside the page.
 */
export function startInPage(handlers: ReturnType<typeof createHandlers>): void {
  // One source: every `InterceptorSource` registers under the same global name, so a second one
  // would reuse the first and never apply its own interceptors. The option's type is narrower than
  // the interceptors it takes; MSW casts them the same way.
  const interceptors: unknown[] = [
    new FetchInterceptor(),
    new XMLHttpRequestInterceptor(),
    new WebSocketInterceptor(),
  ]
  const network = defineNetwork({
    sources: [new InterceptorSource({ interceptors: interceptors as InterceptorList })],
    handlers,
    onUnhandledFrame: 'bypass',
    context: { quiet: import.meta.env.PROD },
  })
  network.enable()
}
