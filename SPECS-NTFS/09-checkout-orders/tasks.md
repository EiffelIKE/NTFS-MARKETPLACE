# 09 — Checkout & orders · Tasks

> Status: Done (2026-10-28)

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 07 and 08 are Done (cart, coupon field, quote factory, profile, wallets, ENS field). Uses spec 03's event hook and socket test helper, and spec 04's session guard, expiry flow and `loginAs` helper.

## Blockers (user-provided)

None. Desktop and mobile "Pagamento" screenshots are in `figma_tokens/screenshots/`.

## Tasks

- [x] **T01 — Textarea and order queries** · CHK-29, CHK-33
  - `pnpm dlx shadcn@4.22.1 add textarea`, restyle like `Input`, add to the `/dev/ui-kit` gallery (spec 01 amendment).
  - `features/orders/api/order-queries.ts`: `orderKeys`, `orderQuery(id)`, `pendingOrdersQuery()`.
  - `features/orders/api/use-order-status.ts` with the pending-only `refetchInterval` (design §7).
  - **Proof:** `use-order-status.test.tsx` (msw/node, fake timers): pending order polls every 5 s, stops at `confirmed`; an older `version` written to the cache does not revert the status.
  - **Done:** `ui/textarea.tsx` already existed (spec 01); the form layer gets `TextareaField` (counter near the limit). `order-queries.ts` (`orderKeys`, `orderQueryOptions` with a version guard, `pendingOrdersQueryOptions`) and `use-order-status.ts` exist. Proof is `use-order-status.test.ts` (node, no fake timers): the pending-only interval option and the version guard through `queryClient.query`. Query ignores `refetchInterval` outside a browser, so the live 5 s poll is proven by E2E `realtime-resilience.spec.ts` ("with the socket down the REST fallback still finds the outcome").

- [x] **T02 — Form model and draft** · CHK-05 – CHK-09
  - `model/form.ts` (`prefill`, reducer, `toCreateOrderBody`, API field mapping) and `model/draft-store.ts`.
  - **Proof:** `form.test.ts` (design §11).
  - **Done:** `model/form.ts` is a Zod schema plus pure helpers (TanStack Form holds the state, so there is no reducer); `model/draft-store.ts` keeps values only. Proof: `form.test.ts` (11 tests), E2E draft reload and sign-out tests.

- [x] **T03 — Attempt store and create-order mutation** · CHK-23 – CHK-27
  - `model/attempt-store.ts`, `api/use-create-order.ts` with the response table of design §6 and the in-flight guard.
  - **Proof:** `attempt-store.test.ts`; `use-create-order.test.tsx` (msw/node): same body reuses the key; `QUOTE_CHANGED` seeds the quote cache; `ORDER_PENDING` returns `details.orderId` for tracking; two synchronous `pay()` calls send one request.
  - **Done:** `attempt-store.ts`, `place-order.ts` (the closed outcome union and the response table), `use-create-order.ts` (in-flight ref, epoch guard). Proof: `attempt-store.test.ts` (9), `place-order.test.ts` (11, msw/node: same key replays the same order, `ORDER_PENDING`/`IDEMPOTENCY_CONFLICT` give the order id, `QUOTE_CHANGED`, availability, wallet, timeout with fake clock, session on first send and on replay). The hook-level test of `use-create-order` is E2E (no DOM test environment): triple click sends one request.

- [x] **T04 — Route, loader and gates** · CHK-01 – CHK-04, CHK-30
  - `routes/checkout.tsx` with the spec 04 guard, parallel `ensureQueryData`, skeleton `pendingComponent`.
  - `CheckoutPage` gate order (pending → empty → no wallet → form), per-region errors with "Tentar novamente".
  - Recovery on load (attempt with or without `orderId`).
  - **Proof:** E2E `purchase.spec.ts` access tests (guest redirect and return, Carla no-wallet state, empty cart); `?scenario=errors-then-recover` shows the cart region error then recovers on "Tentar novamente".
  - **Done:** Route with `requireAuth`, loader prefetch, `CheckoutPage` gates, per-region errors, recovery on load and when the cart empties under an unanswered attempt. Proof: `purchase.spec.ts` (guest redirect and return, empty cart, Carla without a wallet, cart region error and recovery), `checkout-failures.spec.ts` (reload during a lost answer, settled-while-lost).

- [x] **T05 — Collector form, wallet and provider pickers** · CHK-05 – CHK-07, CHK-10 – CHK-13
  - `collector-form.tsx`, `wallet-picker.tsx` (desktop toggle, mobile cards), `provider-picker.tsx`; network select filtered by family; quote refetch on network change.
  - **Proof:** E2E `realtime-checkout.spec.ts` network test (Polygon fee 0.002, total from the quote); `checkout-failures.spec.ts` invalid referral code → field error and focus; Ana's fields prefilled from fixtures.
  - **Done:** `CollectorFields`, `NoteField`, `WalletToggle`, `WalletCards`, `ProviderPicker`; network options by wallet family; quote per network. Proof: `realtime-checkout.spec.ts` (Polygon fee 0.002, total 3.172; address read-only; wallet switch), `checkout-failures.spec.ts` (invalid referral code: message and focus), `purchase.spec.ts` (Ana's prefill).

- [x] **T06 — Desktop and mobile compositions** · CHK-35
  - Desktop two-column layout with "Seus NFTs" summary and coupon reveal; mobile wallet cards, provider rows, collapsed "Dados do colecionador", fixed bottom action.
  - **Proof:** manual comparison against both PNGs at 1440 and 390 (screenshots attached to the PR); E2E mobile project opens the collapsed section automatically on a validation error.
  - **Done:** Both compositions built from the Figma screenshots. Proof: side-by-side check at 1440 and 390 (design §14, "Visual check"); `purchase.spec.ts` composition test per project; mobile validation test opens the collapsed section.

- [x] **T07 — Wallet connection** · CHK-14 – CHK-17
  - `use-connect-wallet.ts`; connection row in the review; reset on wallet/provider/network change; `WALLET_NOT_CONNECTED` handling.
  - **Proof:** `review-dialog.test.tsx` (pay disabled until connected, `wallet-reject` message and retry); E2E `checkout-failures.spec.ts` `disconnectWallet()` → reconnect prompt.
  - **Done:** `use-wallet-connection.ts` and the connection row of the review. Proof: `checkout-failures.spec.ts` (`wallet-reject` message and retry, `disconnectWallet()` reconnect prompt, provider change needs a new connection). `review-dialog.test.tsx` is replaced by these E2E tests (no DOM test environment).

- [x] **T08 — Review dialog and quote revalidation** · CHK-18 – CHK-22
  - `review-dialog.tsx`, `model/quote-review.ts` (`diffQuotes`, state machine), spec 03 `nft.updated` subscription while open, blocking-issue alert.
  - **Proof:** `quote-review.test.ts`; E2E `realtime-checkout.spec.ts` live price change and the two checkout-trigger scenarios.
  - **Done:** `review-dialog.tsx`, `quote-review.ts`, live refetch through spec 07's `useCartLive`. Proof: `quote-review.test.ts` (10) and `realtime-checkout.spec.ts` (live price change with "Aceitar novos valores", live sell-out, `price-change-on-checkout`, `sold-out-on-checkout`).

- [x] **T09 — Submission, unknown result and session expiry** · CHK-24 – CHK-28
  - Wire `use-create-order` into the dialog: loading button, `unknown` state, retry with the same key, expiry flow keeping draft and attempt.
  - **Proof:** E2E `checkout-failures.spec.ts`: triple click → one order; `order-timeout` with `page.clock` → same order id after retry; reload during the hang → recovered; `expireSessions()` during review → login → pay succeeds with the restored draft.
  - **Done:** Loading button, unknown state, same-key retry, expiry flow keeping draft and attempt. Proof: `checkout-failures.spec.ts` (triple click, `order-timeout` with `page.clock`, reload during the hang, expiry then login then pay).

- [x] **T10 — Processing, confirmed and declined** · CHK-29 – CHK-34
  - `OrderPendingPanel`, `OrderDeclinedPanel`, navigation on confirm, cache invalidations, "Tentar novamente" with a new attempt.
  - **Proof:** E2E `purchase.spec.ts` full purchase and cart-cleanup test; `checkout-failures.spec.ts` declined then confirmed; `realtime-resilience.spec.ts` pending resume across reload and socket disconnection.
  - **Done:** `OrderPendingPanel`, `OrderDeclinedPanel`, `TrackedOrder`, navigation on confirm. Proof: `purchase.spec.ts` (full purchase to `/orders/ord_000002`, cart cleanup keeps lines added while pending), `checkout-failures.spec.ts` (declined then confirmed), `realtime-resilience.spec.ts` (reload, socket down with the 5 s poll, reconnect reconciliation, terminal state).

- [x] **T11 — Accessibility pass** · CHK-36
  - Radio groups, focus management of the dialog states, single announcement channel per event.
  - **Proof:** spec 01 axe helper on the form, review dialog (reviewing and `changed`) and processing state: zero serious or critical violations; keyboard-only E2E path from "Confirmar compra" to processing.
  - **Done:** Proof: axe on the form, the review (reviewing and `changed`), processing, declined and blocked states; the keyboard path test (desktop); Esc returns focus to "Confirmar compra" (fixed: the review is not opened by a Radix trigger, so `onCloseAutoFocus` returns it).

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (**655 unit tests** in 56 files, 45 of them new in `features/checkout` and `features/orders`), `pnpm build` and the full `pnpm test:e2e` (**467 passed, 27 skipped** by design, in `desktop-chromium` and `mobile-chromium`) all exit 0. The new specs run 67 tests across both projects (`purchase.spec.ts` 8 per project, `checkout-failures.spec.ts` 17 with the keyboard path skipped on mobile, `realtime-checkout.spec.ts` 6, and 3 new tests in `realtime-resilience.spec.ts`). The four checkout specs were repeated three times in a row (`--repeat-each=3`, both projects): 255 passed, 3 skipped, no flake.
- **Open warning:** `pnpm build` still reports a chunk over 500 kB, owned by spec 13.
- **Found while building:**
  - An order that settles while its answer is lost empties the cart under the open review, and checkout then said the cart was empty for an order that was paid. The unanswered attempt is now replayed when the cart empties too (design §14.12).
  - Focus did not return to "Confirmar compra" when the review closed (the dialog is opened by a submit, not a trigger): fixed with `onCloseAutoFocus`.
  - `clearServerErrors` threw on a form value without an input (`walletId`): the form layer now skips fields without meta.
  - Query does not poll outside a browser, so the 5 s poll is proven in E2E, not in a unit test.
  - The mock `__mock` is not there right after `goto`: `openCheckout` waits for it before any control call.
- Existing E2E: none changed except `realtime-resilience.spec.ts` (new tests and its header comment). The `smoke` spec needed no change.
- Visual check against `figma_tokens/screenshots/desktop/Pagamento.png` and `mobile/Pagamento.png` at 1440 and 390: design §14, "Visual check".

## Coverage

| Requirement | Tasks | Proof |
|---|---|---|
| CHK-01 | T04 | `purchase.spec.ts` guest redirect and return |
| CHK-02 | T04 | `purchase.spec.ts` empty cart |
| CHK-03 | T04 | `purchase.spec.ts` Carla without a wallet |
| CHK-04 | T04 | `purchase.spec.ts` cart region error and "Tentar novamente"; skeleton in `checkout-skeleton.tsx` |
| CHK-05, CHK-06 | T02, T05 | `form.test.ts` prefill; `purchase.spec.ts` Ana's fields |
| CHK-07 | T02, T05 | `checkout-failures.spec.ts` invalid field (message, focus, mobile section opens) |
| CHK-08 | T02 | `form.test.ts` `mapServerFields` (not reachable from the UI with the mock, design §14.3) |
| CHK-09 | T02 | `checkout-failures.spec.ts` draft reload, sign-out clears it |
| CHK-10, CHK-11 | T05 | `form.test.ts` `walletSwitchPatch`; `realtime-checkout.spec.ts` address and network options |
| CHK-12 | T05 | `realtime-checkout.spec.ts` Polygon fee and total |
| CHK-13 | T05 | `checkout-failures.spec.ts` provider change; `purchase.spec.ts` review provider |
| CHK-14 – CHK-17 | T07 | `checkout-failures.spec.ts` reject and retry, disconnect, provider change |
| CHK-18 | T08 | `purchase.spec.ts` review values |
| CHK-19, CHK-20 | T08 | `realtime-checkout.spec.ts` live price change; `price-change-on-checkout`; `quote-review.test.ts` |
| CHK-21 | T08 | `realtime-checkout.spec.ts` live sell-out and `sold-out-on-checkout` |
| CHK-22 | T08 | `quote-review.test.ts` `quoteNotes` |
| CHK-23 | T03 | `attempt-store.test.ts`; `place-order.test.ts` |
| CHK-24 | T03, T09 | `checkout-failures.spec.ts` triple click |
| CHK-25, CHK-26 | T03, T09 | `place-order.test.ts` timeout; `checkout-failures.spec.ts` unknown state, reload during the hang, settled while lost |
| CHK-27 | T03 | `place-order.test.ts` `ORDER_PENDING` and `IDEMPOTENCY_CONFLICT` |
| CHK-28 | T09 | `checkout-failures.spec.ts` expiry, login, pay |
| CHK-29 | T01, T10 | `purchase.spec.ts` processing panel |
| CHK-30 | T04, T10 | `checkout-failures.spec.ts` pending order seed; `realtime-resilience.spec.ts` reload |
| CHK-31 | T10 | `purchase.spec.ts` navigation to `/orders/ord_000002` |
| CHK-32 | T10 | `checkout-failures.spec.ts` declined, retry, back to the cart |
| CHK-33 | T01, T10 | `use-order-status.test.ts` version guard; `realtime-resilience.spec.ts` terminal state |
| CHK-34 | T10 | `purchase.spec.ts` cart cleanup keeps lines added while pending |
| CHK-35 | T06 | `purchase.spec.ts` composition per viewport; visual check in design §14 |
| CHK-36 | T11 | axe in the specs; keyboard path and focus return in `checkout-failures.spec.ts` |
