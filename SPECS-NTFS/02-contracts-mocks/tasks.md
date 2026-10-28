# 02 — Contracts & mocks · Tasks

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 00 is Done. T15 (panel) and the panel's axe check in T17 also need spec 01's `Sheet`, `RadioGroup`, `Select`, `Checkbox` and the `e2e/support` axe helper (spec 01 T06, T07, T16).

## Blockers (user-provided)

None. The artworks were delivered on 2026-10-27 in `src/assets/NFTs/{250,750,1000}/`.

## Tasks

- [ ] **T01 — Dependencies, worker, env flag, spec 00 amendments** · API-34, API-43
  - **Dependencies:** `pnpm add msw@^2.15.0 big.js@^7.0.1` and `pnpm add -D @types/big.js@^7.0.0`.
  - **Worker:** `pnpm exec msw init public --save`. This writes `public/mockServiceWorker.js` and `package.json#msw.workerDirectory`.
  - **Env flag:** add `VITE_ENABLE_MOCKS` to `lib/env.ts` and `.env.example`. Add the `define` write-back in `vite.config.ts` (design §3).
  - **Spec 00 amendments** (design §1 table):
    - `adapter: 'fetch'` in `lib/http/client.ts`;
    - `/mockServiceWorker.js` `no-cache` header in `vercel.json`;
    - Lighthouse details URL → `/nfts/emerald-ape-042`.
  - **Proof:**
    - `pnpm ls msw` shows 2.15.x;
    - `env.test.ts` gets new cases: the default is `true`, and `'1'` fails naming the variable;
    - spec 00's `errors.test.ts` still passes with the fetch adapter (the timeout case uses `ETIMEDOUT`).

- [ ] **T02 — Money module** · API-06, API-07, API-08, API-09
  - `src/lib/money.ts` per design §5: a private strict `Big` constructor, the `eth` helpers, `formatEth` and `formatEthAmount`.
  - **Proof:** `lib/money.test.ts` (design §13 cases) passes.

- [ ] **T03 — Common contracts, error envelope, `ApiError` extension** · API-10, API-11, API-12
  - `contracts/common.ts`, `contracts/errors.ts`: the code union, the envelope, `errorDetails`.
  - Extend `lib/http/errors.ts`: kind `contract`; `code`, `fields`, `details`, `operation`; envelope parsing in `toApiError`; `isApiError` narrowing.
  - **Proof:** extended `errors.test.ts` passes, and the envelope cases from `contracts.test.ts` pass.

- [ ] **T04 — Resource contracts and operation table** · API-01, API-02, API-06
  - Schemas for auth, catalog, favorites, cart, quote, orders, profile, wallets and networks (design §4), with pt-BR messages.
  - `contracts/operations.ts`: the `OperationId` union plus method and path for each of the 34 operations.
  - **Proof:** `contracts.test.ts` passes. `pnpm typecheck` is clean. A type-level test (`expectTypeOf`) shows `Eth` fields are `string` and quantities are `number`.

- [ ] **T05 — `request()` and endpoint modules** · API-03, API-04, API-05
  - `api/request.ts`. Modules `api/{auth,catalog,favorites,cart,orders,profile,wallets,networks}.ts`, one function per operation, with `toWire` query serialization (comma-joined arrays).
  - Every read takes `{ signal }`. `ordersApi.create` takes `{ idempotencyKey }`.
  - **Proof:** `pnpm typecheck` clean. Behavior is proved by the T16 contract tests (contract guard, abort).

- [ ] **T06 — Import boundaries** · API-35
  - The three `no-restricted-imports` blocks from design §12 in `eslint.config.js`.
  - **Proof:** each of these makes `pnpm lint` fail, and passes again once reverted:
    - `import '@/mocks/scenarios'` in `src/routes/index.tsx`;
    - `import { http } from '@/lib/http/client'` in `src/mocks/handlers/cart.ts`;
    - `import axios from 'axios'` in `src/contracts/cart.ts`.

- [ ] **T07 — Mock store, bus and utilities** · API-36, API-37, API-31
  - `mocks/db/{state,store,bus}.ts`, `mocks/lib/{prng,crypto}.ts`:
    - storage adapter (browser and memory);
    - `load`, `read`, `write` with clone, rollback and synchronous persistence, plus the schema-version reseed;
    - the `storage`-event reload;
    - publishing only after commit.
  - **Proof:** `mocks/db/store.test.ts` passes:
    - a thrown write leaves the state and storage unchanged;
    - a corrupt or old-version payload reseeds;
    - bus listeners fire only after commit;
    - `hash` then `verify` round-trips, and a wrong password fails.

- [ ] **T08 — Fixtures and seeds** · API-38, API-31
  - Rename the artworks to `src/assets/NFTs/<width>/<key>.webp` (design §9 table; `NFT Artwork 10` and `11` both become `ape-headphones`) and build each `Image.srcSet` from the three widths. `mocks/fixtures/*`: the artwork manifest, the catalog generator plus anchors (grid order, related row), users, credentials, coupons, networks and highlights with the Figma copy. Seeds `default`, `empty-catalog` and `pending-order`.
  - `scripts/hash-password.mjs`, used to produce the three fixture hashes.
  - **Proof:** `fixtures.test.ts` passes (design §13), including: page 1 of `sort=recent` lists the nine Figma grid anchors in order, and `related('emerald-ape-042')` returns the five Figma items.

- [ ] **T09 — Config, scenarios, network pipeline** · API-39, API-41, API-43, API-10
  - `mocks/{config,scenarios,network}.ts`, `mocks/handlers/{pipeline,fallback,index}.ts`, `mocks/node.ts`:
    - effective-config merge;
    - the 16 scenarios;
    - failure rules (before/after), latency kinds and out-of-order;
    - abort-aware waiting and the request log;
    - session resolution, body and query parsing to 422, the `HttpError` envelope, and the 404 fallback.
  - **Proof:** `mocks/network.test.ts` (fake timers) passes:
    - a `times: 2` rule fails twice, then passes;
    - `range` latency gives the same sequence for the same seed;
    - out-of-order resolves call 2 before call 1;
    - `timeout/after` commits the write and never resolves;
    - an unknown path gives a 404 envelope.

- [ ] **T10 — Account and profile handlers** · API-29, API-30, API-31, API-32, API-33
  - `domain/auth.ts`, `handlers/{auth,profile}.ts`, `mocks/lib/images.ts` (browser and Node adapters).
  - **Proof:** auth and profile contract tests in T16:
    - sign-up conflicts on `email` and `username`;
    - `INVALID_CREDENTIALS`;
    - expired → `SESSION_EXPIRED`;
    - logout invalidates the token;
    - password change revokes other sessions;
    - avatar 413 and 415;
    - `USERNAME_TAKEN`.

- [ ] **T11 — Catalog, highlights, favorites, networks handlers** · API-13, API-14, API-15, API-16
  - `domain/catalog-query.ts`, `handlers/{catalog,favorites,networks}.ts`.
  - **Proof:**
    - `domain/catalog-query.test.ts`: combined filters, disjunctive facets, accent folding, stable ties, page beyond last.
    - catalog contract tests:
      - the anchor detail matches design §9;
      - an unknown id gives 404;
      - `related` of the anchor returns the 5 Figma items;
      - `favorites=true` without a token gives 401;
      - add and remove are idempotent.

- [ ] **T12 — Cart, coupons, quote, merge handlers** · API-17, API-18, API-19, API-20, API-21, API-09
  - `domain/{cart,quote}.ts`, `handlers/cart.ts`: guest cart ids, line limits, status priority, `acknowledgePrice`, coupons, merge and the quote fingerprint.
  - **Proof:**
    - `domain/quote.test.ts`:
      - `total = subtotal − discount + fee` on fixture carts;
      - `KURIO10`, `COLECAO05` (below and above the minimum) and `VERAO25`;
      - the id is stable for the same content and changes on any price, coupon or network change.
    - cart contract tests: limit 409 with `available`; sold-out 409; guest → login → merge with a `capped` adjustment; a second merge has no effect.

- [ ] **T13 — Wallets, connections, orders and settlement** · API-22, API-23, API-24, API-25, API-26, API-27, API-28, API-37
  - `domain/{wallets,orders}.ts`, `handlers/{wallets,orders}.ts`:
    - address vs. network validation and the two wallet slots;
    - connect, reject and disconnect;
    - create steps 1–8 (design §8.4) with reservations and checkout triggers;
    - `settleDue` plus the armed timer;
    - cart cleanup on confirm.
  - **Proof:** the contract tests in T16 named Idempotency, Timeout recovery, Revalidation, Settlement, Snapshot and Isolation. `domain/wallets.test.ts` checks EVM and Solana addresses against each network, `WALLET_ROLE_TAKEN` and `WALLET_DUPLICATE`.

- [ ] **T14 — Browser bootstrap and `window.__mock`** · API-34, API-39, API-40, API-42
  - `mocks/browser.ts`: URL params (strip `scenario` and `reset`), load, `worker.start`, settlement timer, control install.
  - `mocks/control.ts` and `control-types.ts`. `main.tsx` uses `prepare()` plus `renderBootError` (design §3).
  - **Proof:**
    - `pnpm dev` loads with `[MSW] Mocking enabled` (dev only);
    - `window.__mock.state()` returns `default`;
    - `/?scenario=empty` switches the scenario and cleans the URL.

    E2E proofs are in T17.

- [ ] **T15 — Mock panel** · API-44
  - `mocks/panel/{mount.ts,mock-panel.tsx}`: own root, lazy load, `Alt+Shift+M`, the `?mockPanel=1` flag, the session launcher, and the four sections (design §11).
  - **Proof:** E2E panel tests in T17. Manual check: every control is reachable with Tab, and Esc returns focus to the launcher.

- [ ] **T16 — Contract test suite (Node)** · API-45, FND-16
  - `src/api/*.contract.test.ts` per design §13: every operation at least once for success and once per listed error, plus the named cases (Isolation, Idempotency, Timeout recovery, Revalidation, Settlement, Snapshot, Abort, Contract guard).
  - **Proof:** `pnpm test` is green. The **Abort** case is the proof of FND-16 that spec 00 T07 deferred here. Spec 05's out-of-order E2E proves it again through the UI.

- [ ] **T17 — E2E suite** · API-46
  - `e2e/support/mock.ts` (`mock`, `apiFetch`, `loginAs`). `e2e/mocks.spec.ts` with the eight tests in design §13.
  - **Proof:** `pnpm test:e2e` is green in `desktop-chromium` and `mobile-chromium`. The spec 00 smoke suite and the spec 01 suite still pass with the worker active.

- [ ] **T18 — Done gate** · API-34 (build check), all
  - From a clean install, run in order: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
  - Then run `VITE_ENABLE_MOCKS=false pnpm build && ! grep -rlE "setupWorker|__mock|mockServiceWorker" dist/assets`, and rebuild with the default.
  - **Proof:**
    - everything exits 0 with zero warnings;
    - after the user's next Vercel deploy, `curl -sI <url>/mockServiceWorker.js` returns `200` with `cache-control: no-cache`;
    - opening `<url>/?scenario=empty` on the deploy shows `window.__mock.state().scenarioId === 'empty'`.

    Update the spec 02 status in [`../README.md`](../README.md) to **Done**, or to **Done — deploy check pending** if the remote check is outstanding.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| API-01 | T04, T17 | schemas shared; E2E parses with `NftListResponse` |
| API-02 | T04, T10–T13, T16 | operation table; every operation contract-tested |
| API-03 | T05, T16 | contract-guard case |
| API-04 | T05, T06 | endpoint modules; lint boundaries |
| API-05 | T05, T09, T16 | abort case |
| API-06 | T02, T04 | `contracts.test.ts` rejects numbers |
| API-07 | T02 | strict `Big` |
| API-08 | T02 | `formatEth` cases |
| API-09 | T02, T12 | `quote.test.ts` arithmetic |
| API-10 | T03, T09 | envelope tests; pipeline 422 / 404 |
| API-11 | T03, T10–T13 | every listed error code contract-tested |
| API-12 | T03 | `errors.test.ts` |
| API-13 | T11 | `catalog-query.test.ts` |
| API-14 | T11 | facets, `applied`, page beyond last, 422 |
| API-15 | T11 | anchor detail, 404 |
| API-16 | T11 | favorites contract tests |
| API-17 | T12 | limit / sold-out 409 |
| API-18 | T12 | merge with adjustment; idempotent |
| API-19 | T12 | status priority |
| API-20 | T12 | coupon codes |
| API-21 | T12 | quote per network, id fingerprint |
| API-22 | T13, T16 | idempotency case |
| API-23 | T13, T16 | revalidation case; `WALLET_NOT_CONNECTED` |
| API-24 | T13, T16 | settlement case |
| API-25 | T13, T16 | snapshot case |
| API-26 | T13, T16 | isolation case (403) |
| API-27 | T13 | `wallets.test.ts`; duplicate 409 |
| API-28 | T13 | connect / reject / disconnect contract tests |
| API-29 | T10 | sign-up tests |
| API-30 | T10 | login / session / logout tests |
| API-31 | T07, T08, T10 | hash round-trip; fixture hashes; no plaintext in `state.ts` types |
| API-32 | T10 | profile, avatar, password tests |
| API-33 | T10–T13, T16 | 401 without session; isolation case |
| API-34 | T01, T14, T17, T18 | worker in preview; build without mocks has none |
| API-35 | T06 | lint failures on purpose |
| API-36 | T07, T17 | store tests; persistence E2E |
| API-37 | T07, T13 | bus after commit; settlement publishes |
| API-38 | T08 | `fixtures.test.ts` |
| API-39 | T09, T14, T17 | scenario registry; `?scenario=` E2E |
| API-40 | T14, T17 | `?reset=1` E2E |
| API-41 | T09, T17 | `network.test.ts`; offline + latency E2E |
| API-42 | T14, T17 | `mock(page)` helper used across E2E |
| API-43 | T01, T09, T16, T17 | fetch adapter; fake-timer tests; `page.clock` E2E |
| API-44 | T15, T17 | panel E2E + axe |
| API-45 | T02–T13, T16 | `pnpm test` |
| API-46 | T17 | `pnpm test:e2e` |
