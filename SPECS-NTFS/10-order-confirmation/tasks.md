# 10 — Order confirmation · Tasks

> Status: Done (2026-10-28)

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 09 is Done (`features/orders/`: query options, `useOrderStatus`, pending and declined panels; navigation from checkout).

## Blockers (user-provided)

None. The page-vs-modal and mobile questions were decided on 2026-10-28 (requirements "Decisions", design §2 and §6).

## Tasks

- [x] **T01 — Formatting helpers and view model** · RCPT-08 – RCPT-11
  - `features/receipt/model/format.ts` (`shortHash`, `formatOrderDate`) and `model/receipt.ts` (`isReceiptOrder`, `receiptView`).
  - **Proof:** `format.test.ts` and `receipt.test.ts` (8 tests).
  - **Done:** The provider label is `WALLET_PROVIDER_LABELS` and the network name `NETWORK_LABELS` (design §11, 1), so there is no `providerLabel` helper and no `networks.list` read.

- [x] **T02 — Route, loader and status switch** · RCPT-01 – RCPT-07
  - `routes/orders/$orderId.tsx`: spec 04 guard, loader reading the order, 404 → `notFound()`, 403 → `OrderForbidden`, `ReceiptError`, `ReceiptSkeleton` as `pendingComponent`.
  - `order-page.tsx` switching on `useOrderStatus`.
  - **Proof:** E2E `receipt.spec.ts` access tests (guest redirect, Bruno forbidden, unknown id not found, 503 then "Tentar novamente") and the pending tests (confirmed in place with focus, declined with both links).

- [x] **T03 — Receipt card** · RCPT-08 – RCPT-11, RCPT-13, RCPT-15, RCPT-16
  - `receipt-card.tsx`, `receipt-lines.tsx` per design §5; focus on arrival (`state.fromCheckout`, or in-place settle).
  - **Proof:** `receipt.test.ts`; E2E `receipt.spec.ts` direct access (band, lines, totals with discount, note, explorer link, no `nfts.*` request, axe), close and "Continuar explorando"; side-by-side with the desktop PNG at 1440 (design §11).

- [x] **T04 — Mobile composition** · RCPT-14
  - Design §6 below `lg`.
  - **Proof:** E2E `receipt.spec.ts` mobile test (no horizontal scroll at 390, back button instead of ×, explorer action fixed at the bottom, last link not hidden by the bar, axe clean).

- [x] **T05 — Snapshot immutability and purchase hand-off** · RCPT-05, RCPT-12
  - The receipt reads no catalog query; `purchase.spec.ts` ends at the confirmed receipt (the `TODO(spec 10)` is gone).
  - **Proof:** E2E `receipt.spec.ts` price change and sell-out then reload keeps amounts; `purchase.spec.ts` receipt assertions plus a price change and reload.

- [x] **T06 — Site favicon (project owner request)**
  - `src/assets/favicon.ico` moved to `public/favicon.ico`; `index.html` links it (`<link rel="icon" href="/favicon.ico" sizes="any">`, replacing `href="data:,"`).
  - **Proof:** `dist/favicon.ico` after `pnpm build`; `curl -I /favicon.ico` on `pnpm preview` answers 200; the console-error fixture stays clean in the full E2E run. Vercel serves static files before the SPA rewrite.

- [x] **T07 — Simulated in-app block explorer (amendment, 2026-10-28)** · RCPT-11, RCPT-17 – RCPT-21
  - Contract `contracts/explorer.ts`, operation `explorer.getTransaction` (35th), `api/explorer.ts`, mock domain and handler (`mocks/domain/explorer.ts`, `mocks/handlers/explorer.ts`), in-app `explorerTxUrl` in the mock fixtures, `SCHEMA_VERSION` 2.
  - Route `/explorer/$network/tx/$txHash` and `features/explorer/` (queries, `explorerView`, page, skeleton, not-found and error states).
  - Receipt: `explorerTarget` in the view model, router `Link` for an internal address (same tab), adapted caption; E2E and spec docs updated (design §12).
  - **Proof:** `explorer.contract.test.ts` (6), `explorer.test.ts` (3), `receipt.test.ts` (+1); `explorer.spec.ts` (14 tests, 24 runs; 4 skipped by viewport); `a11y.spec.ts` matrix with two explorer screens; `receipt.spec.ts` and `purchase.spec.ts` assert the in-app `href`; browser check at 1440 and 390.

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (**663 unit tests** in 58 files, 8 new in `features/receipt`), `pnpm build` and the full `pnpm test:e2e` (**485 passed, 29 skipped** by design, in `desktop-chromium` and `mobile-chromium`; the 2 `smoke.spec.ts` failures of that run were fixed and `smoke`, `purchase` and `receipt` re-run: 62 passed, 2 skipped) all exit 0. The new `receipt.spec.ts` has 11 tests (20 runs, 2 skipped by viewport).
- **Open warning:** `pnpm build` still reports a chunk over 500 kB, owned by spec 13.
- **Found while building:**
  - `smoke.spec.ts` expected the stub heading at `/orders/1`; it now opens Ana's `ord_000001` and expects the receipt (heading and "Pedido confirmado" title).
  - The checkout axe check in `purchase.spec.ts` failed once, under load, on `quote-total` contrast: the figure was dimmed mid-transition (`data-outdated`). The test now waits for the figure to settle before axe. Not reproduced in 4 repeats afterwards.
  - The router logs a loader error to the console, so the 503 test allows `ApiError: Serviço temporariamente` next to the browser's "Failed to load resource" (one combined regex).
  - A reload clears the mock request log, so the purchase test checks `orders.create` before it reloads.
  - The RCPT-12 live-update check waits 500 ms for the socket event, because the page shows no signal of an `nft.updated` it does not use; the reload that follows is the real proof.
- Amended earlier specs: 09 design §14.15 (the stub is gone, navigation passes `state.fromCheckout`), `e2e/smoke.spec.ts` (route entry), 00 design §8 (favicon).
- Favicon (T06): `public/favicon.ico` is copied by Vite to `dist/` and served by `pnpm dev` and `pnpm preview` (200 checked); with the explicit `<link>` the browser never probes a missing `/favicon.ico`, so Lighthouse and the console-error fixture stay clean.
- Visual check against `figma_tokens/screenshots/desktop/Confirmação de Pedido.png` at 1440 and the mobile layout at 390: design §11.

## Coverage

| Requirement | Tasks | Proof |
|---|---|---|
| RCPT-01 | T02 | `receipt.spec.ts` guest redirect and return |
| RCPT-02 | T02 | `receipt.spec.ts` unknown order |
| RCPT-03 | T02 | `receipt.spec.ts` Bruno on Ana's order |
| RCPT-04 | T02 | `receipt.spec.ts` 503 and "Tentar novamente"; `ReceiptSkeleton` |
| RCPT-05 | T02, T05 | `receipt.test.ts` `isReceiptOrder`; `receipt.spec.ts` pending and declined show no receipt |
| RCPT-06 | T02 | `receipt.spec.ts` pending then settled in place, heading focused |
| RCPT-07 | T02 | `receipt.spec.ts` declined: message, "Tentar novamente", "Voltar ao carrinho" |
| RCPT-08 | T01, T03 | `receipt.test.ts`; `receipt.spec.ts` direct access with no `nfts.*` request |
| RCPT-09 | T01, T03 | `format.test.ts`; `receipt.spec.ts` band; `purchase.spec.ts` short hash |
| RCPT-10 | T01, T03 | `receipt.test.ts` note; `receipt.spec.ts` note |
| RCPT-11 | T01, T03 | `receipt.spec.ts` explorer href, `target`, `rel`, simulated caption; `purchase.spec.ts` |
| RCPT-12 | T05 | `receipt.spec.ts` and `purchase.spec.ts` price change then reload |
| RCPT-13 | T03 | `receipt.spec.ts` desktop card (580, centered, close); visual check |
| RCPT-14 | T04 | `receipt.spec.ts` mobile layout |
| RCPT-15 | T03, T04 | `receipt.spec.ts` focus on in-place settle, table headers, axe; `purchase.spec.ts` focus after checkout |
| RCPT-16 | T03 | `receipt.spec.ts` close and "Continuar explorando" |

## Run log: simulated explorer amendment (2026-10-28)

- Gate: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (**682 unit tests** in 62 files; 10 of them new: 6 contract, 3 view-model and 1 `explorerTarget`) and `pnpm build` pass. The full `pnpm test:e2e` ran twice on the final code: **775 passed, 36 skipped, 1 failed** and then **774 passed, 36 skipped, 2 failed**; every failure is `favorites.spec.ts:176` "three rapid clicks end on, in the cache and on the server" (DET-21).
- **That test is flaky and not caused by this change:** on a clean worktree of `HEAD` (no explorer code) it failed 3 of 15 runs in `mobile-chromium`; it fails under load in both projects. Left as it is (spec 06 / 11 territory).
- The visual baselines (spec 12) are untouched: the screenshot specs pass with no baseline change.
- Found while building:
  - `contracts.test.ts` pins the operation table at 34 entries; it is 35 now.
  - Persisted mock databases hold orders with the old external `explorerUrl`; `SCHEMA_VERSION` 2 makes the store reseed them (design §12, 6).
  - In E2E, `receipt-row-fee` includes its label, so the explorer comparison reads its `dd`; the header names the signed-in user, so the "no private data" check reads `main` only.
- Amended earlier specs: 02 design (operation table, settlement, networks, 35 operations) and tasks, 14 design (demo table row), README.

| Requirement | Tasks | Proof |
|---|---|---|
| RCPT-11 (amended) | T07 | `receipt.spec.ts` and `purchase.spec.ts` in-app `href`, same tab; `receipt.test.ts` `explorerTarget` |
| RCPT-17 | T07 | `explorer.contract.test.ts`; `explorer.spec.ts` receipt to explorer |
| RCPT-18 | T07 | `explorer.contract.test.ts` no private data; `explorer.spec.ts` no private data |
| RCPT-19 | T07 | `explorer.spec.ts` banner on the page and on the not-found state |
| RCPT-20 | T07 | `explorer.spec.ts` unknown hash, other network, unknown network, 503 and retry |
| RCPT-21 | T07 | `explorer.spec.ts` direct access, refresh, 390 / 768 / 1440; `a11y.spec.ts` matrix |
