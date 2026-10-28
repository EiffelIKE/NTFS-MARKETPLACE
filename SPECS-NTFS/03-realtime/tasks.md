# 03 — Realtime · Tasks

> Status: Ready for review

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 02 is Done. T08 (dev page) also needs spec 01's shell `inner` config and form primitives.

## Blockers (user-provided)

None.

## Tasks

- [ ] **T01 — Dependencies and transport spike** · RT-01, RT-02, RT-03
  - `pnpm add socket.io-client@^4.8.4 @mswjs/socket.io-binding@^0.2.0`.
  - Add `VITE_REALTIME_URL` to `lib/env.ts` and `.env.example`.
  - Throwaway spike, not committed: a `ws.link` handler with `toSocketIo`, plus a client with `transports: ['websocket']`, in the dev server. Confirm:
    - the URL pattern matches `/socket.io/?EIO=4&transport=websocket`;
    - the open packet and CONNECT ack arrive;
    - the raw `40{"token":…}` is visible;
    - a 20 s raw `2` keeps the socket alive past 30 s.
  - Record any difference in design §3 before continuing.
  - **Proof:** spike notes in design §3; `pnpm typecheck` clean.

- [ ] **T02 — Event contracts** · RT-04, RT-05, RT-06
  - `contracts/events.ts`: `ResourceRef`, `NftLive`, `OrderLive`, `RealtimeEvent`, an `eventId()` helper.
  - **Proof:** `contracts/events.test.ts`.

- [ ] **T03 — Mock hub and envelopes** · RT-07, RT-08, RT-10
  - `mocks/realtime/envelope.ts`, reusing spec 02's summary and detail builders for `NftLive`.
  - `mocks/realtime/hub.ts`: audience rules, delivery delay, ring log, `drop`, `restore`, `redeliver`, `inject`.
  - Amend `MockConfig` with `realtime` (spec 02 amendment), and set `offline` to `available: false`.
  - **Proof:** `mocks/realtime/hub.test.ts` (design §9).

- [ ] **T04 — Mock socket handler and control** · RT-01, RT-03, RT-08, RT-09, RT-10
  - `mocks/realtime/handler.ts` (design §3): refuse when not accepting, raw CONNECT parsing, heartbeat, detach on close.
  - Wire it into `createHandlers` and `startMocks()`, and subscribe the hub to the bus.
  - Add `window.__mock.realtime` and its type in `control-types.ts`.
  - Add the panel's "Tempo real indisponível" checkbox.
  - **Proof:** T09 E2E; the panel E2E from spec 02 still passes.

- [ ] **T05 — Guard and appliers** · RT-11, RT-12, RT-13, RT-14
  - `lib/realtime/guard.ts` and `lib/realtime/appliers.ts`, following the query-key contract in design §7.
  - **Proof:** `guard.test.ts`, `appliers.test.ts`.

- [ ] **T06 — Manager, socket factory, hooks** · RT-02, RT-15, RT-16, RT-17, RT-18, RT-19
  - `socket.ts` with a lazy import; `manager.ts` (connect rule, session change, pipeline, status, reconciliation, dev log); `hooks.ts`; `index.ts`.
  - `app.tsx`: start after the first render, call `setSession({ key: 'guest', token: null })` until spec 04, and stop on unmount.
  - **Proof:** `manager.test.ts`. `pnpm build` shows `socket.io-client` in its own chunk, not in the entry chunk (check `dist/assets` with `grep -l "socket.io"`).

- [ ] **T07 — Lint boundaries** · RT-01
  - Add the rules from design §7 to `eslint.config.js`.
  - **Proof:** temporary imports of `socket.io-client` in `features/` and of `@/lib/realtime` in `mocks/` both fail lint; removed after.

- [ ] **T08 — Developer page** · RT-13, RT-14, RT-16
  - `routes/dev/realtime.tsx` with `noindex` and the shell `inner "Tempo real"`; `features/dev-realtime/` sections (design §8).
  - **Proof:** T09.

- [ ] **T09 — E2E** · RT-21
  - `e2e/support/realtime.ts`; `e2e/realtime-resilience.spec.ts` with the six tests in design §9.
  - **Proof:** `pnpm test:e2e` green in both projects.

- [ ] **T10 — Docs hand-off** · RT-20, RT-21
  - Append design §12 to the spec 14 notes list.
  - README scenarios table: realtime controls and the offline effect.
  - **Proof:** spec 14 checklist entry exists.

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
