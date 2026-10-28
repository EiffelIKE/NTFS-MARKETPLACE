import { env } from '@/lib/env'

// The only place that loads `socket.io-client`. The import is dynamic, so the library lands in its
// own chunk and the first render never waits for it (RT-02).

type Listener = (...args: never[]) => void

/** The slice of a Socket.IO socket the manager uses; tests fake it with an `EventEmitter`. */
export interface SocketLike {
  on(event: string, listener: Listener): unknown
  off(event?: string, listener?: Listener): unknown
  /** The Manager: reconnection events live here, not on the socket. */
  io: {
    on(event: string, listener: Listener): unknown
    off(event?: string, listener?: Listener): unknown
  }
  connect(): unknown
  disconnect(): unknown
}

export interface SocketOptions {
  url?: string
  /** Sent in the CONNECT packet; `null` is a guest. */
  token: string | null
}

export type SocketFactory = (options: SocketOptions) => Promise<SocketLike>

/** Backoff of the reconnection: 1 s growing to 5 s with no jitter, so tests are deterministic. */
export const RECONNECTION = { delay: 1000, delayMax: 5000 } as const

export const createSocket: SocketFactory = async ({ url = env.VITE_REALTIME_URL, token }) => {
  const { io } = await import('socket.io-client')
  return io(url, {
    // MSW intercepts WebSocket; HTTP long-polling would be a plain request to a host that does
    // not exist.
    transports: ['websocket'],
    autoConnect: false,
    // One Manager per socket, so a session change can never share a connection.
    forceNew: true,
    auth: token ? { token } : {},
    reconnectionDelay: RECONNECTION.delay,
    reconnectionDelayMax: RECONNECTION.delayMax,
    randomizationFactor: 0,
    timeout: 10_000,
  })
}
