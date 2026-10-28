# 03 — Realtime · Requirements

> Status: Ready for review

Deliver live updates over Socket.IO. The client uses `socket.io-client`. The mock server runs inside MSW through `@mswjs/socket.io-binding` and turns spec 02's domain changes (`nft.updated`, `order.updated`) into versioned events. The client drops duplicates and stale events, patches the Query cache, reconciles with REST after a reconnection, and opens a fresh socket for each session. Screens (specs 05–10) consume this through a listener hook and the default cache appliers. They never touch the socket.

Brief coverage: §2 (Socket.IO used meaningfully), §4 (consistent invalidation after events, isolation by user), §6 (events through MSW with a Socket.IO-compatible binding, transport limits documented, data changes reflected in REST and events), §7 (events, identity and version, duplicates and old events, reconnection reconciliation, session isolation, listener release), §9 (real-time tests go through the Socket.IO client; event triggering under test control).

## User stories

- **US-1** — As a collector viewing an NFT, my cart or my checkout, I see price and availability changes without reloading.
- **US-2** — As a collector with a pending order, I see it become confirmed or declined as soon as the simulated network settles it, even if my connection dropped in between.
- **US-3** — As a collector who signs out or switches accounts, nothing from the previous session updates what I see.
- **US-4** — As a test author, I trigger, duplicate, replay, delay and cut events from Playwright, and every check goes through the real Socket.IO client.

## Acceptance criteria

### Transport

- **RT-01** — THE SYSTEM SHALL receive realtime events only through a `socket.io-client` socket. In mock mode the server side SHALL be an MSW WebSocket handler wrapped by `@mswjs/socket.io-binding`. No code path SHALL deliver events to the UI or the cache by calling setters, callbacks or the Query cache directly from mock code.
- **RT-02** — THE SYSTEM SHALL connect with the WebSocket transport only, to the URL in `VITE_REALTIME_URL`. It SHALL load the socket code in a separate chunk after the first render, so the initial bundle does not contain it.
- **RT-03** — WHILE the mock socket server is connected, THE SYSTEM SHALL keep the Engine.IO heartbeat alive, so an idle connection is not closed by the client's ping timeout.

### Event contract

- **RT-04** — THE SYSTEM SHALL define every event as a Zod schema in the contracts module, with an envelope `{ id, type, resource: { type, id }, version, occurredAt, data }`. `type` SHALL be `nft.updated` or `order.updated`, and `data` SHALL carry the resource's current live fields, not a delta.
- **RT-05** — THE SYSTEM SHALL derive `id` from the type, the resource and the version, so the same change always has the same id. `version` SHALL be the resource's version in the mock database after the change.
- **RT-06** — WHEN an incoming payload does not parse against the event schema, THE SYSTEM SHALL drop it, log it in development, and continue processing later events.

### Mock server

- **RT-07** — WHEN a write commits a domain change (spec 02 bus), THE SYSTEM SHALL read the current resource from the mock database, build the envelope and emit it after the configured delivery delay:
  - `nft.updated` to every open connection;
  - `order.updated` only to connections whose session is valid at delivery time and belongs to the order's owner.
- **RT-08** — THE SYSTEM SHALL identify a connection's user from the `auth.token` sent in the Socket.IO CONNECT packet. A missing, unknown or expired token SHALL make it a guest connection that receives only public events.
- **RT-09** — WHEN the mock configuration marks realtime as unavailable (the `offline` scenario, or a test block), THE SYSTEM SHALL refuse new connections and close open ones.
- **RT-10** — THE SYSTEM SHALL let tests, through `window.__mock.realtime`, list connections, drop every connection with or without blocking reconnection, restore, redeliver already-sent events, inject an arbitrary envelope to chosen connections, and read the delivery log.

### Client processing

- **RT-11** — WHEN an event arrives whose `id` was already processed in the current session, THE SYSTEM SHALL ignore it and SHALL NOT re-run any effect.
- **RT-12** — WHEN an event arrives whose `version` is lower than or equal to the highest version already applied for that resource, or to the version of the cached data, THE SYSTEM SHALL ignore it and SHALL NOT revert newer state.
- **RT-13** — WHEN an `nft.updated` event passes the guards, THE SYSTEM SHALL patch every cached NFT summary and detail with that id whose version is older (price, previous price, availability, edition availability, version).
- **RT-14** — WHEN an `order.updated` event passes the guards, THE SYSTEM SHALL patch the cached order with that id when its version is older, and SHALL mark the cached order lists stale. Events for orders that are not in the cache SHALL change nothing.
- **RT-15** — THE SYSTEM SHALL offer a hook for components to react to events (e.g. invalidate the cart, open a review). The listener SHALL receive only events that passed the guards, and SHALL be removed when the component unmounts.

### Reconnection and session lifecycle

- **RT-16** — WHEN the connection drops, THE SYSTEM SHALL reconnect automatically with backoff (1 s, growing to at most 5 s, no jitter) and expose the status `connecting | connected | reconnecting | disconnected` to components.
- **RT-17** — WHEN the socket reconnects after a disconnection, THE SYSTEM SHALL reconcile with REST by invalidating the cached queries, refetching the active ones. Events missed while disconnected SHALL therefore not leave stale data on screen.
- **RT-18** — WHEN the session identity or token changes (login, sign-up, logout, expiry, user switch), THE SYSTEM SHALL:
  - close the old socket and remove all its listeners;
  - clear the dedupe and version state;
  - open a new socket with the new credentials.

  No event received on a previous session's socket SHALL be processed after the change.
- **RT-19** — THE SYSTEM SHALL keep one socket per tab for the lifetime of the session, and SHALL close it when the app unmounts.

### Tests

- **RT-20** — THE SYSTEM SHALL include unit tests for the event schemas, the guards (dedupe, version, malformed payload), the default appliers, the session reset and the mock hub's audience rules.
- **RT-21** — THE SYSTEM SHALL include E2E tests, in both Playwright projects against the preview build, proving through the real Socket.IO client:
  - a live price and availability update without a REST refetch;
  - duplicates and old versions are ignored;
  - a disconnection, a change while disconnected, then reconnection and REST reconciliation;
  - `order.updated` reaches only its owner.

## Out of scope

- What each screen shows for a live change (inline notice, review dialog, announcements): specs 06, 07 and 09 through the listener hook.
- The pending-order resume flow and its E2E half of brief scenario 10: spec 09 (adds to `e2e/realtime-resilience.spec.ts`).
- Session storage and the moment identity changes: spec 04 calls this spec's `setSession`.
- Cross-tab event delivery: the mock publishes only in the tab that wrote (spec 02 §7). Documented as a limitation; other tabs catch up through focus refetch.
- Rooms, namespaces and acknowledgements: the binding does not support them (design §3).
- A global connection indicator: none is drawn in Figma. Screens that need it (checkout) read the status hook.

## Decisions

Technical choices that need no product input are made in [`design.md`](design.md):
- broadcast `nft.updated` to all connections and route `order.updated` by owner, instead of per-resource subscriptions (§5);
- reconcile all cached queries on reconnect (§6);
- one new socket per session (§6);
- events carry live fields so the cache can be patched without a refetch (§4).
