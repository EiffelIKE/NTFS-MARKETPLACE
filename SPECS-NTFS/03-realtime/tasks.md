# 03 — Realtime · Tasks

> Status: Done

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 02 is Done. T08 (dev page) also needs spec 01's shell `inner` config and form primitives.

## Blockers (user-provided)

None.

## Tasks

- [x] **T01 — Dependencies and transport spike** · RT-01, RT-02, RT-03
  - `pnpm add socket.io-client@^4.8.4 @mswjs/socket.io-binding@^0.2.0`.
  - Add `VITE_REALTIME_URL` to `lib/env.ts` and `.env.example`.
  - Throwaway spike, not committed: a `ws.link` handler with `toSocketIo`, plus a client with `transports: ['websocket']`, in the dev server. Confirm:
    - the URL pattern matches `/socket.io/?EIO=4&transport=websocket`;
    - the open packet and CONNECT ack arrive;
    - the raw `40{"token":…}` is visible;
    - a 20 s raw `2` keeps the socket alive past 30 s.
  - Record any difference in design §3 before continuing.
  - **Proof:** spike notes in design §3; `pnpm typecheck` clean.
  - **Done:** the spike ran in the preview build against the real handler, not a throwaway file. It found that MSW strips `/socket.io/` before matching (the handler is registered on the base URL) and that a close before `open` is not noticed by the client (design §3, spike 1 to 5). `env.test.ts` covers the default URL and a relative URL failing by name.

- [x] **T02 — Event contracts** · RT-04, RT-05, RT-06
  - `contracts/events.ts`: `ResourceRef`, `NftLive`, `OrderLive`, `RealtimeEvent`, an `eventId()` helper.
  - **Proof:** `contracts/events.test.ts`.
  - **Done:** `contracts/events.test.ts` (10 tests): both types parse, numeric price, bad type, bad id, wrong resource kind, version 0, negative edition count, narrowing with `expectTypeOf`, `eventId`, `resourceKey`.

- [x] **T03 — Mock hub and envelopes** · RT-07, RT-08, RT-10
  - `mocks/realtime/envelope.ts`, reusing spec 02's summary and detail builders for `NftLive`.
  - `mocks/realtime/hub.ts`: audience rules, delivery delay, ring log, `drop`, `restore`, `redeliver`, `inject`.
  - Amend `MockConfig` with `realtime` (spec 02 amendment), and set `offline` to `available: false`.
  - **Proof:** `mocks/realtime/hub.test.ts` (design §9).
  - **Done:** `hub.test.ts` (27 tests): envelope equals what REST returns, audience by owner, expired token, empty-audience log, delay, `drop`/`restore`/`enforce`, `redeliver`, `inject`, start/stop, `parseAuth`.

- [x] **T04 — Mock socket handler and control** · RT-01, RT-03, RT-08, RT-09, RT-10
  - `mocks/realtime/handler.ts` (design §3): refuse when not accepting, raw CONNECT parsing, heartbeat, detach on close.
  - Wire it into `createHandlers` and `startMocks()`, and subscribe the hub to the bus.
  - Add `window.__mock.realtime` and its type in `control-types.ts`.
  - Add the panel's "Tempo real indisponível" checkbox.
  - **Proof:** T09 E2E; the panel E2E from spec 02 still passes.
  - **Done:** `realtime-resilience.spec.ts` drives the handler through the real client in both projects; `mocks.spec.ts` (panel) still passes; the new panel test cuts and restores realtime with the checkbox.

- [x] **T05 — Guard and appliers** · RT-11, RT-12, RT-13, RT-14
  - `lib/realtime/guard.ts` and `lib/realtime/appliers.ts`, following the query-key contract in design §7.
  - **Proof:** `guard.test.ts`, `appliers.test.ts`.
  - **Done:** `guard.test.ts` (8) and `appliers.test.ts` (14): list, detail and related patched together, no revert, same reference for untouched data, `dataUpdatedAt` kept, lists marked stale without refetch, orders not in the cache untouched.

- [x] **T06 — Manager, socket factory, hooks** · RT-02, RT-15, RT-16, RT-17, RT-18, RT-19
  - `socket.ts` with a lazy import; `manager.ts` (connect rule, session change, pipeline, status, reconciliation, dev log); `hooks.ts`; `index.ts`.
  - `app.tsx`: start after the first render, call `setSession({ key: 'guest', token: null })` until spec 04, and stop on unmount.
  - **Proof:** `manager.test.ts`. `pnpm build` shows `socket.io-client` in its own chunk, not in the entry chunk (check `dist/assets` with `grep -l "socket.io"`).
  - **Done:** `manager.test.ts` (19 tests, fake socket factory). `grep -l "socket.io\|engine.io" dist/assets/*.js` lists `esm-*.js` (30 kB, `socket.io-client`) and `browser-*.js` (the mocks chunk, with the binding); `index-*.js` has no match.

- [x] **T07 — Lint boundaries** · RT-01
  - Add the rules from design §7 to `eslint.config.js`.
  - **Proof:** temporary imports of `socket.io-client` in `features/` and of `@/lib/realtime` in `mocks/` both fail lint; removed after.
  - **Done:** On 2026-10-28 three throwaway files failed `eslint` and were removed: `socket.io-client` from `src/features/tmp/a.ts`, `@/lib/realtime` from `src/mocks/tmp-b.ts`, and `@mswjs/socket.io-binding` from `src/lib/realtime/tmp-c.ts`. The tree is lint-clean again.

- [x] **T08 — Developer page** · RT-13, RT-14, RT-16
  - `routes/dev/realtime.tsx` with `noindex` and the shell `inner "Tempo real"`; `features/dev-realtime/` sections (design §8).
  - **Proof:** T09.
  - **Done:** the harness is what every test in `realtime-resilience.spec.ts` reads; it also passes axe, and a screenshot at 1440 shows the four sections inside the shell.

- [x] **T09 — E2E** · RT-21
  - `e2e/support/realtime.ts`; `e2e/realtime-resilience.spec.ts` with the six tests in design §9.
  - **Proof:** `pnpm test:e2e` green in both projects.
  - **Done:** 9 tests per project (the 6 in design §9 plus heartbeat, panel and axe). The heartbeat test fails with the ping disabled (checked once by hand). See the Run log.

- [x] **T10 — Docs hand-off** · RT-20, RT-21
  - Append design §12 to the spec 14 notes list.
  - README scenarios table: realtime controls and the offline effect.
  - **Proof:** spec 14 checklist entry exists.
  - **Done:** spec 14 design (env list, transport limits) now names `VITE_REALTIME_URL` and points at spec 03 design §3 and §12 for DOC-10; its scenario table already lists the realtime controls. The root `README.md` does not exist yet (spec 14 writes it). The panel's "Tempo real indisponível" checkbox and the `offline` scenario's effect are described in design §13.

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `lint` (`--max-warnings 0`), `format:check`, `test` (27 files, 409 tests: 79 new), `build`, `test:e2e` (98 results in both projects: 96 passed, 2 skipped by design from spec 01; the realtime spec also ran 72 times with `--repeat-each=4`, all green) all exit 0.
- New unit tests: `events` 10, `guard` 8, `appliers` 14, `manager` 19, `hub` 27, `env` +1.
- New E2E (`realtime-resilience.spec.ts`, both projects): live price and availability without a REST refetch, duplicate / old version / malformed payload, disconnection and reconciliation with the page clock, idle connection past the ping timeout, switching accounts, `order.updated` only for the owner (scenario `pending-order`), the panel checkbox, `offline`, axe on `/dev/realtime`.
- Build check: `socket.io-client` is in its own chunk (`esm-*.js`, 30 kB) and not in the entry chunk; `@mswjs/socket.io-binding` is inside the lazy mocks chunk (`browser-*.js`). The 576 kB `index-*.js` warning belongs to spec 13.
- `VITE_ENABLE_MOCKS=false pnpm build`: `grep -rlE "setupWorker|__mock|mockServiceWorker|socket.io-binding|toSocketIo" dist/assets` is empty; `socket.io-client` stays (the client is the real transport). The default build was restored afterwards.
- **Transport findings** (design §3): MSW strips `/socket.io/` before matching; the binding hides CONNECT `auth`, sends no heartbeat and acks before the client's CONNECT; a close before `open` is invisible to `socket.io-client` for 10 s unless an `error` event comes first.
- **For spec 04:** call `realtime.setSession` with the restored session's identity (it replaces the `guest` call in `app.tsx`), and delete the temporary bearer interceptor in `features/dev-realtime/resources.tsx`.
- **For spec 09:** `e2e/realtime-resilience.spec.ts` is shared; add the pending-order resume tests there. Remember that without `VITE_ENABLE_MOCKS` and with the default `VITE_REALTIME_URL` a real build retries a host that does not exist: set the variable in production.
- Not covered in the browser: a real network drop below the WebSocket (the control closes the socket from the server side), cross-tab delivery (spec 02 §7), and `useRealtimeEvent` outside the developer page (specs 06, 07 and 09 use it).

## Coverage

| Requirement | Tasks | Proof |
|---|---|---|
| RT-01 | T01, T04, T07, T09 | E2E through `/dev/realtime`; lint rules |
| RT-02 | T01, T06 | separate chunk in `dist` |
| RT-03 | T01, T04 | spike; heartbeat in handler |
| RT-04 | T02 | `events.test.ts` |
| RT-05 | T02, T03 | id helper; `redeliver` keeps the id |
| RT-06 | T02, T06 | invalid payload dropped (`manager.test.ts`) |
| RT-07 | T03, T09 | hub audience tests; E2E price update |
| RT-08 | T03, T04, T09 | expired token gets nothing private; Bruno vs Ana E2E |
| RT-09 | T03, T04, T09 | `offline` E2E |
| RT-10 | T03, T04 | hub tests; helpers used across E2E |
| RT-11 | T05, T09 | guard test; `duplicado` E2E |
| RT-12 | T05, T09 | guard test; `antigo` E2E |
| RT-13 | T05, T08, T09 | appliers test; price without `nfts.get` |
| RT-14 | T05, T09 | appliers test; order status E2E |
| RT-15 | T06 | listener unregister test |
| RT-16 | T06, T09 | status table; reconnect E2E |
| RT-17 | T06, T09 | invalidate on reconnect; refetch E2E |
| RT-18 | T06, T09 | session switch unit + E2E |
| RT-19 | T06 | stop on unmount |
| RT-20 | T02–T06 | `pnpm test` |
| RT-21 | T09 | `pnpm test:e2e` |
