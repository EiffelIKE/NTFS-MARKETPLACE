# 03 — Realtime · Design

> Status: Done

Implements [`requirements.md`](requirements.md). No Figma input. The only UI is the developer page `/dev/realtime` (§8), built from spec 01 components.

## 1. Dependencies and version decisions

| Package | Version | Kind | Why |
|---|---|---|---|
| `socket.io-client` | `^4.8.4` | runtime | Required by the brief (§2, §6). Released 2026-09-25, so it meets the 7-day `minimumReleaseAge`. |
| `@mswjs/socket.io-binding` | `^0.2.0` | runtime | Wraps MSW's WebSocket connection with Socket.IO encoding (brief §6). It ships in the demo build with the rest of `mocks/`. Its peer `msw: ^2.10.2` matches spec 02's `msw@^2.15.0`. |

- **Protocol match.** The binding encodes with `socket.io-parser@^4.2.4` and `engine.io-parser@^5.2.3`. `socket.io-client@4.8.4` uses `socket.io-parser@~4.2.4` (Socket.IO protocol 5, Engine.IO 4), so both sides speak the same wire format.
- **What the binding does and does not do.** These facts come from reading `build/index.js` of 0.2.0:
  - On a connection with no real server behind it, it sends the Engine.IO open packet `0{"sid":"test","upgrades":[],"pingInterval":25000,"pingTimeout":5000}`, then the Socket.IO CONNECT ack `40{"sid":"test"}`, in a microtask.
  - It decodes only EVENT packets for `io.client.on(...)`, and `io.client.emit(...)` encodes on namespace `/`.
  - It does **not** send heartbeats, does not expose the client's CONNECT payload (`auth`), and has no rooms, namespaces, broadcasting or acknowledgements.

  §3 covers each gap.

## 2. Layout

```
src/
  contracts/events.ts            # RealtimeEvent schemas (zod + money only, like the rest of contracts/)
  lib/realtime/                  # the only importer of socket.io-client
    index.ts                     # public API: realtime, useRealtimeEvent, useRealtimeStatus, types
    manager.ts                   # RealtimeManager: session, socket lifecycle, status, listeners
    socket.ts                    # createSocket(url, token): lazy import of socket.io-client
    guard.ts                     # EventGuard: dedupe LRU + per-resource versions + cache version lookup
    appliers.ts                  # default Query cache appliers for nft.updated / order.updated
    hooks.ts                     # useRealtimeEvent, useRealtimeStatus, useRealtimeEventLog
    instance.ts                  # the tab's one manager
    event-kit.ts                 # test builders (nftEvent, orderEvent)
  mocks/realtime/
    types.ts                     # Transport, RealtimeControl, DeliveryLogEntry (no runtime imports: E2E imports it)
    hub.ts                       # RealtimeHub: connections, audience, delivery, log, block (pure, testable)
    handler.ts                   # ws.link + toSocketIo + raw CONNECT parsing + heartbeat
    envelope.ts                  # DomainChange + MockState → RealtimeEvent
  features/dev-realtime/         # /dev/realtime harness (§8): connection, resources, event-log
  routes/dev/realtime.tsx
e2e/
  support/realtime.ts            # realtime(page) proxy over __mock.realtime, waitForConnection()
  realtime-resilience.spec.ts    # this spec's half of brief scenario 10; spec 09 adds the pending-order half
```

## 3. Transport (RT-01 – RT-03)

**URL.** `lib/env.ts` gains `VITE_REALTIME_URL: z.url().default('wss://realtime.kurio.example')`. The default uses a reserved `.example` host, so if interception ever fails, the browser gets a DNS failure and never reaches a real server. The socket path is the Socket.IO default `/socket.io/`.

**Client options** (`lib/realtime/socket.ts`):

```ts
const { io } = await import('socket.io-client')        // own chunk (RT-02)
return io(env.VITE_REALTIME_URL, {
  transports: ['websocket'],          // MSW intercepts WebSocket; HTTP long-polling would hit the REST fallback
  autoConnect: false,
  forceNew: true,                     // one Manager per socket, so a session change cannot share a connection
  auth: { token },                    // fixed per socket (one socket per session, §6)
  reconnectionDelay: 1000, reconnectionDelayMax: 5000, randomizationFactor: 0,   // RT-16, deterministic in tests
  timeout: 10_000,
})
```

**Mock handler** (`mocks/realtime/handler.ts`), registered in spec 02's `createHandlers`:

```ts
const link = ws.link(env.VITE_REALTIME_URL)            // MSW strips `/socket.io/` before matching (spike 1)
link.addEventListener('connection', (connection) => {
  const { client } = connection
  if (!hub.accepting()) return refuse(client)           // RT-09: `error` event, then close (spike 3)
  const io = toSocketIo(connection)                     // sends open + CONNECT ack; needs the whole connection
  const id = hub.attach({ emit: (type, payload) => io.client.emit(type, payload), close: () => client.close(4001, 'dropped') })
  client.addEventListener('message', (e) => {
    if (typeof e.data === 'string' && e.data.startsWith('40')) hub.identify(id, parseAuth(e.data.slice(2)))   // RT-08
  })
  const beat = setInterval(() => client.send('2'), HEARTBEAT_MS)                                            // RT-03
  client.addEventListener('close', () => { clearInterval(beat); hub.detach(id) })
})
```

Each piece closes one of the binding's gaps:

- **Auth.** The client's CONNECT packet is `40{"token":"…"}`. We read it from the raw message, because the binding hides it. `parseAuth` returns `null` on bad JSON. Until it arrives, the connection is a guest connection.
- **Heartbeat.** The open packet tells the client to expect a ping every 25 s and to give up after 30 s, but the binding never pings. The handler sends a raw Engine.IO ping `2` every 20 s, and the client answers `3`, which the binding ignores. Timers use the page clock (spec 02 §7), so tests that use `page.clock` must advance time with `runFor`, which fires every timer in order. `fastForward` over 30 s can trip the client's ping timeout. That is harmless, because the client reconnects and reconciles, but it adds noise.
- **No rooms.** The hub routes events itself (§5).
- **Verification spike (T01, 2026-10-28).** Run against the preview build in Chromium:
  1. **URL matching.** The `/socket.io/*` pattern never matched: MSW's `WebSocketHandler.parse` rewrites the client path `/socket.io/` to `/` before matching, so the handler is registered on the server's base URL (`VITE_REALTIME_URL`) and the connection fell through to a real (unresolvable) host until it was.
  2. **Handshake and auth.** The open packet and the CONNECT ack arrive, and the raw `40{"token":…}` is visible to `client.addEventListener('message')`. The ack is sent in a microtask, **before** the client's CONNECT, so `connect` can fire a moment before `identify`. E2E helpers therefore wait for the connection's `userId`, not only for its existence.
  3. **Refusing a connection.** A bare `client.close(4000)` before the connection opened is **not noticed** by `socket.io-client`: the Manager listens to the engine's `close` only after it opened, so the client waited for its 10 s connect timeout and showed "conectando". The handler first dispatches an `error` event on the underlying mock socket (reached with `Reflect.get(client, 'socket')`, the same kind of access the binding itself uses), then closes. The client then reports `connect_error` at once and retries with a growing backoff, as it does after a refused handshake. If a future MSW version hides that object, the fallback is the plain close and the 10 s delay.
  4. **Heartbeat.** With the 20 s ping, an idle socket survives 45 s of page-clock time. With the ping disabled it is closed and replaced by a new connection (the E2E test fails), so the ping is what keeps it alive.
  5. **Types.** `toSocketIo` takes the whole connection object (`client`, `server`, `info`, `params`), not a `{ client, server }` pair.

## 4. Event contract (`contracts/events.ts`, RT-04 – RT-06)

```ts
export const ResourceRef = z.discriminatedUnion('type', [
  z.object({ type: z.literal('nft'), id: NftId }),
  z.object({ type: z.literal('order'), id: OrderId }),
])
export const NftLive = z.object({
  price: Eth, previousPrice: Eth.optional(), available: z.boolean(),
  editions: z.array(z.object({ id: EditionId, available: z.int().min(0).nullable() })),
})
export const OrderLive = Order.pick({ status: true, transaction: true, declineReason: true, settledAt: true, updatedAt: true })
const base = { id: z.string().regex(/^evt_[a-z.]+_[A-Za-z0-9_-]+_\d+$/), version: z.int().min(1), occurredAt: IsoDateTime }
export const RealtimeEvent = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('nft.updated'), resource: ResourceRef.options[0], data: NftLive }),
  z.object({ ...base, type: z.literal('order.updated'), resource: ResourceRef.options[1], data: OrderLive }),
])
export type RealtimeEventType = RealtimeEvent['type']
```

- **Id.** `evt_<type>_<resourceId>_<version>`, for example `evt_nft.updated_emerald-ape-042_4`. One committed change produces exactly one version, so a redelivery has the same id (RT-05).
- **Socket event name.** It equals `type`, and the payload is the whole envelope, as the only argument.
- **Live fields, not deltas.** Applying the newest event alone gives the right state, so a skipped version is never a problem.

## 5. Mock hub (`mocks/realtime/hub.ts`, RT-07 – RT-10)

```ts
interface Transport { emit(type: RealtimeEventType, payload: RealtimeEvent): void; close(): void }
class RealtimeHub {
  attach(t: Transport): ConnectionId; identify(id: ConnectionId, auth: { token?: string } | null): void; detach(id: ConnectionId): void
  accepting(): boolean                      // config.realtime.available && !blocked
  publish(change: DomainChange): void       // subscribed to spec 02's bus at startMocks()
  drop(opts?: { block?: boolean }): void; restore(): void
  redeliver(count?: number): void; inject(e: unknown, to?: InjectTarget): void
  connections(): ConnectionInfo[]; log(): DeliveryLogEntry[]
}
```

**Publish.**
1. On a bus change, read the resource from the committed state and build the envelope with `envelope.ts`. The `nft.updated` fields come from the same domain helper that builds `NftSummary` and `NftDetail` for REST, so REST and events never disagree (brief §6).
2. Schedule the delivery after `config.realtime.deliveryDelayMs`.
3. At delivery time, compute the audience:

| Type | Audience |
|---|---|
| `nft.updated` | every open connection, guests included |
| `order.updated` | connections whose token resolves *at delivery time* to an unexpired session of `change.userId` |

Resolving the session at delivery time, rather than at connect time, means an expired or revoked session stops receiving private events right away (RT-07, RT-08).

**Log.** A ring buffer of 200 entries `{ seq, at, eventId, type, resourceId, version, connectionIds }`. An event with an empty audience is still logged, which proves isolation in tests.

**Test control** (spec 02 amendment, `window.__mock.realtime`; the types live in `mocks/realtime/types.ts`):

```ts
interface RealtimeControl {
  connections(): { id: ConnectionId; userId: UserId | null; openedAt: string }[]
  drop(opts?: { block?: boolean }): void    // close all; with block, refuse reconnects until restore()
  restore(): void
  redeliver(count?: number): void           // re-send the last N delivered envelopes to their original live connections
  inject(e: unknown, to?: { connectionIds?: ConnectionId[] }): void         // default: normal audience rules
  log(): DeliveryLogEntry[]; clearLog(): void
}
```

`blocked` lives in memory, so a reload clears it. `config.realtime.available` is persisted and comes from the scenario.

## 6. Client manager (`lib/realtime/manager.ts`, RT-11 – RT-19)

```ts
class RealtimeManager {
  start(deps: { queryClient: QueryClient }): void            // app.tsx, after first render (requestIdleCallback, 2 s fallback)
  stop(): void                                               // app unmount
  setSession(s: { key: string; token: string | null }): void   // spec 04; 'guest' until then
  status(): RealtimeStatus; subscribeStatus(fn): () => void
  on<T extends RealtimeEventType>(type: T, fn: (e: EventOf<T>) => void): () => void
}
```

**Connect rule.** The manager connects only when it has been started **and** a session has been set. Spec 04 sets the session after restore, so a signed-in user never connects first as a guest. Until spec 04 lands, `app.tsx` calls `setSession({ key: 'guest', token: null })`.

**Session change (RT-18).** When `setSession` gets a different `key` or `token`:
1. `old.off(); old.io.off(); old.disconnect()` — no listener survives on the old socket.
2. `guard.reset()` clears seen ids and versions.
3. Create a new socket with the new token, attach the handlers, and connect.

Each handler first checks `socket === this.socket`, so a packet already queued on the old socket is dropped. The server-side check (§5) is the second layer.

**Processing pipeline** for each incoming type:

1. **Stale socket:** drop it.
2. **Schema:** `RealtimeEvent.safeParse(payload)`. On failure, drop with reason `invalid` and `console.warn` in development (RT-06).
3. **Guard** (`guard.ts`), checked in this order:
   1. `seen.has(id)`: `duplicate` (RT-11).
   2. `version <= versions.get(resourceKey)`: `stale`.
   3. `version <= cachedVersion(resource)`: `stale`, where `cachedVersion` is the highest `version` among cached entries for that resource (RT-12).

   On acceptance, record the id (LRU of 1 000) and the version.
4. **Default applier** (§7).
5. **Listeners** of that type, each in a try/catch, so one failing listener cannot block the others.
6. **Dev log:** push `{ event, outcome }` to a 50-entry ring for `/dev/realtime`.

**Status (RT-16):**

| Socket event | Status |
|---|---|
| `start` + session, before the first connect | `connecting` |
| `connect` | `connected` |
| `disconnect` with reason `io client disconnect` | `disconnected` |
| any other `disconnect`, `connect_error`, `reconnect_attempt` | `reconnecting` |

**Reconciliation (RT-17).** On a `connect` that follows an earlier connect of the same socket, the manager calls `queryClient.invalidateQueries()`. Every cached query is marked stale, and the active ones refetch right away. That covers prices, availability and orders settled while the socket was down, without a list of "active resources" to maintain. The first connect of a socket reconciles nothing, because the data was just fetched by its screens.

## 7. Default appliers and hooks (`appliers.ts`, `hooks.ts`)

**Query key contract** (relied on by specs 05, 06 and 09; their key factories already follow it):
- everything under `['nfts', …]` holds `NftSummary`, `NftDetail` or `{ items: NftSummary[] }` data;
- `['orders', 'detail', orderId]` holds an `Order`;
- other `['orders', …]` keys hold order lists.

**`nft.updated` (RT-13):**
- Run `setQueriesData({ queryKey: ['nfts'] }, patch)`. `patch` walks one level:
  - an object with `id === nftId` and an older `version` gets `price`, `previousPrice`, `available`, `version`, and edition `available` by `id` when `editions` is present;
  - `items[]` is mapped the same way;
  - anything else is returned unchanged, keeping the same reference, so nothing re-renders.
- Then run `invalidateQueries({ queryKey: ['nfts', 'list'], refetchType: 'none' })`. A list sorted by price or faceted by price is marked stale without an immediate refetch flicker.

**`order.updated` (RT-14):**
- `setQueryData(['orders', 'detail', id], …)` only when the cached order exists and is older.
- Then `invalidateQueries({ queryKey: ['orders'], predicate: (q) => q.queryKey[1] !== 'detail' })`.

**Hooks:**

```ts
function useRealtimeEvent<T extends RealtimeEventType>(type: T, listener: (e: EventOf<T>) => void, opts?: { enabled?: boolean }): void
function useRealtimeStatus(): RealtimeStatus
```

- `useRealtimeEvent` registers in an effect and keeps the latest listener in a ref, so re-renders do not re-register. It unregisters on unmount (RT-15). Listeners run after the default applier, so they see the patched cache.
- `useRealtimeStatus` uses `useSyncExternalStore`.

**Lint (amends spec 00 §9):**
- `socket.io-client` may be imported only from `src/lib/realtime/**`;
- `@mswjs/socket.io-binding` only from `src/mocks/**`;
- `src/mocks/**` may not import `@/lib/realtime`.

The existing API-35 rule already keeps app code away from `@/mocks`.

## 8. Developer page `/dev/realtime`

This is a harness for proving the transport before the screen specs exist. It is like spec 01's `/dev/ui-kit`: `noindex`, never linked, shell `inner "Tempo real"`.

- **Status:** "Status: conectado | conectando | reconectando | desconectado", in a `role="status"` region.
- **Sessão:** a "Token de teste" input plus "Conectar com token" and "Conectar como visitante". These call `realtime.setSession` with `key: 'dev:<token>'`. This is test-only plumbing; spec 04 is the real caller.
- **NFT:** an id input, default `emerald-ape-042`. The page loads `catalogApi.get` under `['nfts', 'detail', id]`, so it uses the same key as spec 06, and shows the price (`formatEth`), each edition's availability and the version.
- **Pedido:** an id input. The page loads `ordersApi.get` under `['orders', 'detail', id]` and shows status and version.
- **Eventos:** the manager's dev log (last 50), with type, resource, version and outcome (`aplicado | duplicado | antigo | inválido`).

## 9. Testing (RT-20, RT-21)

### Unit (Vitest, node)

| File | Covers |
|---|---|
| `contracts/events.test.ts` | Both event types parse. A numeric price, an unknown type or a bad id are rejected. |
| `lib/realtime/guard.test.ts` | Duplicate id → `duplicate`. A lower or equal version → `stale`. A cached v5 with an incoming v4 → `stale`. `reset()` forgets everything. LRU eviction at 1 000. |
| `lib/realtime/appliers.test.ts` | A list, a detail and a related list for the same NFT are all patched. A newer cached version is untouched. Unrelated data keeps its reference. An order not in the cache changes nothing. |
| `lib/realtime/manager.test.ts` | With a fake socket factory (an EventEmitter with `connect`, `disconnect`, `off`, `io.off`): <br>– `setSession` closes the old socket and ignores its late events; <br>– a reconnect calls `invalidateQueries` once; the first connect does not; <br>– a throwing listener does not stop the next one; <br>– unregistering removes the listener. |
| `mocks/realtime/hub.test.ts` | With fake transports and the spec 02 store: <br>– `updateNft` → every connection gets the same envelope; <br>– `settleOrder` → only the owner's connection; <br>– an expired token gets nothing private; <br>– `drop({ block: true })` → `accepting()` is false until `restore()`; <br>– `redeliver` sends the same id; <br>– the envelope matches what `nfts.get` returns after the change. |

The real socket is not unit-tested in Node. In Node, `engine.io-client` uses the `ws` package rather than the global `WebSocket`, so MSW would not intercept it. The socket path is proven in the browser.

### E2E (`e2e/realtime-resilience.spec.ts`, both projects, preview build)

**Helpers** (`e2e/support/realtime.ts`):
- `realtime(page)`: a typed proxy over `window.__mock.realtime`.
- `waitForConnection(page, { userId? })`: polls `connections()`.

| Test | Proves |
|---|---|
| `/dev/realtime`: wait for the connection. Clear the request log, then `updateNft('emerald-ape-042', { price: '1.29' })` → the page shows "1.29 ETH" and v+1, and `requests({ op: 'nfts.get' })` is empty | RT-01, RT-07, RT-13 |
| `redeliver(1)` → the price stays, and the event log shows `duplicado`. Then `inject` the previous version with price `1.19` → the price stays 1.29, and the log shows `antigo` | RT-11, RT-12 |
| `drop({ block: true })`, status "reconectando"; `updateNft` to `1.39` (no event delivered: empty audience in `log()`); `restore()`; `page.clock.runFor(5000)` → "conectado", `nfts.get` refetched, "1.39 ETH" | RT-16, RT-17 |
| `?scenario=pending-order`: connect with Bruno's token (`loginAs`), `settleOrder('ord_000002', 'confirmed')` → the log entry has an empty audience. Connect with Ana's token, load the order, `settleOrder` on a fresh reset → status "confirmado" without a refetch | RT-07, RT-08, RT-14 |
| Token switch Ana → Bruno → `connections()` has exactly one connection, with Bruno's id | RT-18 |
| `?scenario=offline`: status stays "reconectando", and `connections()` is empty; `configure({ realtime: { available: true } })` lets the next attempt in | RT-09 |
| Added in T09: an idle connection survives 45 s of page-clock time (the mock heartbeat), the panel checkbox cuts and restores realtime, and the developer page passes axe | RT-03, RT-09, RT-10 |

## 10. Spec 02 amendments

Applied in this spec's tasks (spec 02 is not reopened):

| Spec 02 section | Change |
|---|---|
| §2 layout / §8 handlers | Add `mocks/realtime/`. `createHandlers` also returns the `ws.link` handler, and `startMocks()` creates the hub and subscribes it to the bus. |
| §4 contracts | Add `contracts/events.ts` (§4 above). |
| §10 `MockConfig` | Add `realtime: { available: boolean; deliveryDelayMs: number }`, default `{ available: true, deliveryDelayMs: 50 }`. The `offline` scenario sets `available: false`. |
| §11 `MockControl` | Add `realtime: RealtimeControl` (§5). |
| §11 panel, "Rede" | Add a "Tempo real indisponível" checkbox that calls `drop({ block: true })` or `restore()`. |
| §12 lint | Add the rules in §7. |
| spec 00 §7 env | Add `VITE_REALTIME_URL`. |

## 11. Figma references

None. Realtime has no drawn UI. The checkout's use of the status is spec 09's.

## 12. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Transport in the mock.**
  - Socket.IO runs over MSW's in-page WebSocket interception plus `@mswjs/socket.io-binding@0.2.0`. It is WebSocket only, with no long-polling fallback.
  - The binding has no rooms, namespaces or acks, so the mock hub routes by connection itself.
  - The binding sends no heartbeat, so the mock pings every 20 s.
  - The binding hides the CONNECT `auth`, so the mock reads the raw packet.
- **Audience.** `nft.updated` goes to everyone. `order.updated` goes only to the owner's connections whose session is still valid at delivery. A client-side guard and a new socket per session are the second layer.
- **Identity and ordering.** Ids are deterministic (`type + resource + version`). The client drops duplicates and anything not newer than the last applied event or the cached data. Payloads carry live fields, so skipped versions are harmless.
- **Reconciliation.** After a reconnect, every cached query is invalidated and the active ones refetch. This is simple and complete for this data volume. A real backend would send a resume cursor instead.
- **Known race.** A change committed between a REST read and the socket's (re)connection is not pushed. Reconciliation on reconnect, focus refetch and the checkout's quote revalidation (spec 09) catch it.
- **Multi-tab.** Events are published only in the tab whose mock wrote the change (spec 02 §7). Other tabs catch up on focus.
- **Clock.** Heartbeat and reconnection timers follow the page clock. Tests use `runFor`.

## 13. Implementation decisions (2026-10-28)

Decisions taken while implementing, where the design was silent or had to give way to what the code showed. The spike findings are in §3.

**Amendments to earlier specs (applied in those documents):**

| Spec | Change |
|---|---|
| 00 | Design §7 and §15: the env variable is `VITE_REALTIME_URL`, not `VITE_SOCKET_URL`. `.env.example`, `env-schema.ts` and `vite-env.d.ts` carry it. |
| 00 | Design §9 lint: `socket.io-client` is restricted outside `src/lib/realtime/**`, `@mswjs/socket.io-binding` outside `src/mocks/**`, and `src/mocks/**` cannot import `@/lib/realtime`. |
| 02 | Design §10 (`MockConfig.realtime`), §11 (`__mock.realtime`, panel checkbox) and §12 (lint): marked as applied by spec 03. |
| 14 | Design §2 and the env list use `VITE_REALTIME_URL`; the transport limits of §12 below are the confirmed list for DOC-10. |

**Mock server**
- The hub is created with the runtime, but it only forwards bus changes after `runtime.realtime.start()`. `startMocks()` calls it; `createMockServer()` (Node contract tests) does not, so the 330 contract tests schedule no delivery timers.
- A change whose version has already been superseded inside the same write (an order that bumps the same NFT twice) produces no envelope. The last change carries the final state, so there is one event per final version.
- `redeliver(n)` takes the last `n` entries that were published (not injected, not redelivered) with a non-empty audience, and sends them to the connections that got them first, if those are still open.
- `inject(event, to?)` accepts `unknown`: tests need to send malformed payloads. A payload that does not parse is sent under its own `type` (or `nft.updated` when it has none) and logged with `eventId: '(invalid)'`.
- The log has a `kind` (`publish`, `redeliver`, `inject`) next to the design's fields.
- `__mock.configure({ realtime: { available: false } })` closes open sockets at once (`hub.enforce()`). Untoggling "Tempo real indisponível" in the panel also sets `available: true` again, so it can undo the `offline` scenario's setting.
- `RealtimeControl`, `Transport`, `ConnectionInfo` and `DeliveryLogEntry` live in `mocks/realtime/types.ts`, with no runtime imports. `control-types.ts` imports them from there: importing from `hub.ts` pulled `import.meta.glob` (artwork fixtures) into the E2E TypeScript project, which has no Vite types.
- The handler uses `ws.link(env.VITE_REALTIME_URL)` and the heartbeat constant `HEARTBEAT_MS = 20_000` (exported, and tested to stay below the announced 25 s).

**Client**
- The guard has a fourth outcome, `known`: the event is not newer than the cached data, so the default applier still runs (it only patches entries older than the event and never reverts anything) but listeners are not called. This heals a list that a detail refetch got ahead of, a case where "ignore completely" would leave a stale price on the list. The developer page shows it as `antigo`.
- Appliers write with `setQueryData(key, next, { updatedAt })`, keeping the entry's own `dataUpdatedAt`: patching must not make a stale entry look freshly fetched. Entries that are not affected are not written at all.
- `order.updated` invalidates the order lists only when the order is in the cache (its detail, or inside a cached list). An order that is nowhere in the cache changes nothing, as RT-14 requires.
- The socket sends `auth: {}` for a guest and `auth: { token }` otherwise.
- `createRealtimeManager({ createSocket, guard })` is the testable factory. `instance.ts` holds the singleton, so `manager.ts` has no module-level state.
- A socket factory that rejects (the chunk failed to load) leaves the status `disconnected` and logs a warning. There is no retry: a real fix is a reload, as for any failed chunk.
- `stop()` drops the Query client, so a socket that finished loading after it is discarded, like one that finished loading after a session change. `App`'s effect calls `setSession({ key: 'guest' })` itself until spec 04 replaces it.

**Developer page**
- The order id starts empty and the order is requested only with a token and an id, so the default scenarios make no failing request on load.
- Without spec 04's interceptor, the page installs a temporary Axios request interceptor while a token is set, to send the bearer to `ordersApi.get`. **Spec 04 must delete it** once the real interceptor exists.
- "Conectar com token" also removes cached `['orders']` queries, so the new identity cannot see the previous one's orders.
- A table, a `role="status"` region named "Conexão" and `role="group"` regions named "Dados do NFT" and "Dados do pedido" are the accessible hooks the E2E tests use.

**Tests**
- `useRealtimeEvent` and `useRealtimeStatus` are not unit-tested in Node (no DOM); they are exercised by the developer page in E2E.
- E2E helpers wait for `window.__mock` before polling: right after `goto`, the page may not have started the worker yet.
- Every E2E test waits for the NFT to be on screen before changing it. A change committed while the first REST read is in flight is a real race (design §12, "Known race"), and without the wait the test would be flaky on a loaded machine.
- In Playwright, `test.use({ allowedConsoleErrors: [a, b] })` reads a two-element array as a fixture `[value, options]` tuple. Use one regular expression instead.
- `page.clock.install()` before `goto` keeps time flowing and lets `runFor` accelerate it: the reconnect and heartbeat tests use that.

**Applied by spec 04 (design §14):** the guest `setSession` in `App`'s effect and the temporary bearer interceptor on `/dev/realtime` are gone. The session bridge sets the identity after the restore and on every change, and the developer page and its E2E tests use the real session (`loginAs` plus a navigation).
