# 09 — Checkout & orders · Tasks

> Status: Ready for review

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 07 and 08 are Done (cart, coupon field, quote factory, profile, wallets, ENS field). Uses spec 03's event hook and socket test helper, and spec 04's session guard, expiry flow and `loginAs` helper.

## Blockers (user-provided)

None. Desktop and mobile "Pagamento" screenshots are in `figma_tokens/screenshots/`.

## Tasks

- [ ] **T01 — Textarea and order queries** · CHK-29, CHK-33
  - `pnpm dlx shadcn@4.22.1 add textarea`, restyle like `Input`, add to the `/dev/ui-kit` gallery (spec 01 amendment).
  - `features/orders/api/order-queries.ts`: `orderKeys`, `orderQuery(id)`, `pendingOrdersQuery()`.
  - `features/orders/api/use-order-status.ts` with the pending-only `refetchInterval` (design §7).
  - **Proof:** `use-order-status.test.tsx` (msw/node, fake timers): pending order polls every 5 s, stops at `confirmed`; an older `version` written to the cache does not revert the status.

- [ ] **T02 — Form model and draft** · CHK-05 – CHK-09
  - `model/form.ts` (`prefill`, reducer, `toCreateOrderBody`, API field mapping) and `model/draft-store.ts`.
  - **Proof:** `form.test.ts` (design §11).

- [ ] **T03 — Attempt store and create-order mutation** · CHK-23 – CHK-27
  - `model/attempt-store.ts`, `api/use-create-order.ts` with the response table of design §6 and the in-flight guard.
  - **Proof:** `attempt-store.test.ts`; `use-create-order.test.tsx` (msw/node): same body reuses the key; `QUOTE_CHANGED` seeds the quote cache; `ORDER_PENDING` returns `details.orderId` for tracking; two synchronous `pay()` calls send one request.

- [ ] **T04 — Route, loader and gates** · CHK-01 – CHK-04, CHK-30
  - `routes/checkout.tsx` with the spec 04 guard, parallel `ensureQueryData`, skeleton `pendingComponent`.
  - `CheckoutPage` gate order (pending → empty → no wallet → form), per-region errors with "Tentar novamente".
  - Recovery on load (attempt with or without `orderId`).
  - **Proof:** E2E `purchase.spec.ts` access tests (guest redirect and return, Carla no-wallet state, empty cart); `?scenario=errors-then-recover` shows the cart region error then recovers on "Tentar novamente".

- [ ] **T05 — Collector form, wallet and provider pickers** · CHK-05 – CHK-07, CHK-10 – CHK-13
  - `collector-form.tsx`, `wallet-picker.tsx` (desktop toggle, mobile cards), `provider-picker.tsx`; network select filtered by family; quote refetch on network change.
  - **Proof:** E2E `realtime-checkout.spec.ts` network test (Polygon fee 0.002, total from the quote); `checkout-failures.spec.ts` invalid referral code → field error and focus; Ana's fields prefilled from fixtures.

- [ ] **T06 — Desktop and mobile compositions** · CHK-35
  - Desktop two-column layout with "Seus NFTs" summary and coupon reveal; mobile wallet cards, provider rows, collapsed "Dados do colecionador", fixed bottom action.
  - **Proof:** manual comparison against both PNGs at 1440 and 390 (screenshots attached to the PR); E2E mobile project opens the collapsed section automatically on a validation error.

- [ ] **T07 — Wallet connection** · CHK-14 – CHK-17
  - `use-connect-wallet.ts`; connection row in the review; reset on wallet/provider/network change; `WALLET_NOT_CONNECTED` handling.
  - **Proof:** `review-dialog.test.tsx` (pay disabled until connected, `wallet-reject` message and retry); E2E `checkout-failures.spec.ts` `disconnectWallet()` → reconnect prompt.

- [ ] **T08 — Review dialog and quote revalidation** · CHK-18 – CHK-22
  - `review-dialog.tsx`, `model/quote-review.ts` (`diffQuotes`, state machine), spec 03 `nft.updated` subscription while open, blocking-issue alert.
  - **Proof:** `quote-review.test.ts`; E2E `realtime-checkout.spec.ts` live price change and the two checkout-trigger scenarios.

- [ ] **T09 — Submission, unknown result and session expiry** · CHK-24 – CHK-28
  - Wire `use-create-order` into the dialog: loading button, `unknown` state, retry with the same key, expiry flow keeping draft and attempt.
  - **Proof:** E2E `checkout-failures.spec.ts`: triple click → one order; `order-timeout` with `page.clock` → same order id after retry; reload during the hang → recovered; `expireSessions()` during review → login → pay succeeds with the restored draft.

- [ ] **T10 — Processing, confirmed and declined** · CHK-29 – CHK-34
  - `OrderPendingPanel`, `OrderDeclinedPanel`, navigation on confirm, cache invalidations, "Tentar novamente" with a new attempt.
  - **Proof:** E2E `purchase.spec.ts` full purchase and cart-cleanup test; `checkout-failures.spec.ts` declined then confirmed; `realtime-resilience.spec.ts` pending resume across reload and socket disconnection.

- [ ] **T11 — Accessibility pass** · CHK-36
  - Radio groups, focus management of the dialog states, single announcement channel per event.
  - **Proof:** spec 01 axe helper on the form, review dialog (reviewing and `changed`) and processing state: zero serious or critical violations; keyboard-only E2E path from "Confirmar compra" to processing.

## Coverage

| Requirement | Tasks |
|---|---|
| CHK-01 – CHK-04 | T04 |
| CHK-05 – CHK-09 | T02, T05 |
| CHK-10 – CHK-13 | T05 |
| CHK-14 – CHK-17 | T07 |
| CHK-18 – CHK-22 | T08 |
| CHK-23 – CHK-28 | T03, T09 |
| CHK-29 – CHK-34 | T01, T10 |
| CHK-35 | T06 |
| CHK-36 | T11 |
