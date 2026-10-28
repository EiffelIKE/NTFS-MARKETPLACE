import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandler } from 'msw'

import { env } from '@/lib/env'

import type { MockRuntime } from '../runtime'

// The Socket.IO endpoint inside MSW (spec 03 §3). `@mswjs/socket.io-binding` supplies the
// Engine.IO/Socket.IO encoding and the handshake; everything it lacks is closed here: reading the
// CONNECT `auth`, the heartbeat and refusing connections. Its limits are listed in design §3.

/** Engine.IO ping every 20 s; the open packet tells the client to expect one every 25 s. */
export const HEARTBEAT_MS = 20_000

/**
 * Reads the `auth` object from a raw Socket.IO CONNECT payload (the text after the leading
 * `40`): `{"token":"…"}`, or nothing. The binding hides this packet, so it is parsed here.
 */
export function parseAuth(payload: string): { token?: unknown } | null {
  if (payload === '') return {}
  try {
    const parsed: unknown = JSON.parse(payload)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Fails the connection the way a refused WebSocket handshake does: an `error` event, then the
 * close. A bare close before `open` would go unnoticed by `socket.io-client`, which only listens
 * for it after the connection opened and would wait for its 10 s connect timeout. MSW does not
 * expose a way to dispatch the error, so it goes to the underlying mock socket (the binding
 * reaches into the same object).
 */
function refuse(client: { close(code?: number, reason?: string): void }): void {
  const socket: unknown = Reflect.get(client, 'socket')
  if (socket instanceof EventTarget) socket.dispatchEvent(new Event('error'))
  client.close(4000, 'realtime unavailable')
}

export function realtimeHandler(runtime: MockRuntime): WebSocketHandler {
  const hub = runtime.realtime
  // MSW strips the `/socket.io/` prefix of the client's URL before matching, so the handler is
  // registered on the server's base URL, not on the Socket.IO path.
  const link = ws.link(env.VITE_REALTIME_URL)

  return link.addEventListener('connection', (connection) => {
    const { client } = connection
    // Refuse before the binding handshakes, so the client sees a failed connection (RT-09).
    if (!hub.accepting()) {
      refuse(client)
      return
    }

    const io = toSocketIo(connection)
    const id = hub.attach({
      emit: (type, payload) => {
        io.client.emit(type, payload)
      },
      close: () => {
        client.close(4001, 'dropped')
      },
    })

    // CONNECT is the Socket.IO packet type 0, inside an Engine.IO message (type 4): `40{…}`.
    client.addEventListener('message', (event) => {
      if (typeof event.data === 'string' && event.data.startsWith('40')) {
        hub.identify(id, parseAuth(event.data.slice(2)))
      }
    })

    // The binding sends no heartbeat, so an idle socket would hit the client's ping timeout (RT-03).
    const beat = setInterval(() => {
      client.send('2')
    }, HEARTBEAT_MS)
    client.addEventListener('close', () => {
      clearInterval(beat)
      hub.detach(id)
    })
  })
}
