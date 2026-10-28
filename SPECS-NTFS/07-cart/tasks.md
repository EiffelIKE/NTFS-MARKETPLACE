# 07 — Cart · Tasks

> Status: Ready for review

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 03, 04 and 06 are Done (realtime subscription, session and post-login hook, `QuantityStepper` and related card). Spec 06 creates `cart-keys.ts`, `cart-queries.ts`, `apply-cart.ts`, `useAddCartItem` and `guest-cart-id.ts` with this spec's design; T01–T03 extend them instead of creating them.

## Blockers (user-provided)

None.

## Tasks

- [ ] **T01 — Keys, queries, version-guarded writes** · CART-05, CART-08, CART-16
  - `cart-keys.ts` (owner-scoped), `cart-queries.ts` (`cartQueryOptions`, `quoteQueryOptions` keyed by cart version, network `ethereum`), `apply-cart.ts`.
  - `useCartCount()` and the `cartCount` wiring in `app/app-shell.tsx`.
  - **Proof:** `apply-cart.test.ts` green; header badge shows `3` for Ana in a dev run.

- [ ] **T02 — Mutations and quantity queue** · CART-07 – CART-10, CART-12, CART-13
  - The five hooks of design §5 with their error handling; `quantity-queue.ts`.
  - **Proof:** `quantity-queue.test.ts` green.

- [ ] **T03 — Guest cart id and merge** · CART-01, CART-02, CART-04
  - `guest-cart-id.ts` (from spec 06): add the clear on `id: null`.
  - Export `get()` for spec 04's interceptor (check it sends `X-Guest-Cart-Id` only without a bearer).
  - `merge-guest-cart.ts` registered on spec 04's post-login hook, before the redirect resolves.
  - **Proof:** `guest-cart-id.test.ts`, `merge-guest-cart.test.ts` green.

- [ ] **T04 — Route and desktop screen** · CART-06, CART-11, CART-15, CART-17, CART-18, CART-23, CART-24
  - `routes/cart.tsx` (head, shell config, non-blocking loader).
  - `cart-page`, `cart-table`, `cart-summary`, `cart-empty`, `cart-skeleton`, `related-row`; states table of design §8.
  - **Proof:** E2E rows "Ana logs in → summary", "Remove …", "Guest Conectar e finalizar" pass on desktop.

- [ ] **T05 — Coupon form** · CART-12 – CART-14
  - `coupon-form.tsx`, applied-coupon row, non-blocking issue notice.
  - **Proof:** E2E coupon rows pass.

- [ ] **T06 — Mobile composition** · CART-24
  - `cart-line-card.tsx`, fixed bottom summary with measured padding, static under `max-height: 560px`; tablet centered column.
  - **Proof:** E2E mobile row passes; manual check at 390 × 844, 768 × 1024 and 390 at 200 % zoom (no covered content, no horizontal scroll).

- [ ] **T07 — Live changes** · CART-19 – CART-22
  - `use-cart-realtime.ts` on spec 03's subscription, `line-notices.ts`, `cart-line-notice.tsx`, announce dedupe.
  - **Proof:** `line-notices.test.ts` green; E2E rows with `__mock.updateNft` pass.

- [ ] **T08 — Accessibility labels and focus** · CART-10, CART-25
  - Labels of design §9, focus after removal, axe checks.
  - **Proof:** E2E axe row passes with no violations; focus assertions in the removal row pass.

- [ ] **T09 — E2E suites** · all
  - `e2e/cart.spec.ts` (design §10) and the cart rows of `e2e/loading-states.spec.ts`, in both Chromium projects.
  - **Proof:** `pnpm test:e2e e2e/cart.spec.ts e2e/loading-states.spec.ts` green; `pnpm typecheck && pnpm lint` clean.

- [ ] **T10 — Notes for spec 14** · —
  - Copy design §12 into the spec 14 deviation list (or its working notes file).
  - **Proof:** entries present.

## Coverage

| Requirement | Tasks | Proof |
|---|---|---|
| CART-01, CART-02 | T03 | `guest-cart-id.test.ts`, E2E merge row |
| CART-03 | T04 | E2E reload row |
| CART-04 | T03 | `merge-guest-cart.test.ts`, E2E merge rows |
| CART-05 | T01 | E2E logout / user switch row |
| CART-06 | T04 | E2E summary row |
| CART-07 | T02 | E2E max-per-order row |
| CART-08 | T01, T02 | `apply-cart.test.ts`, `quantity-queue.test.ts`, E2E fast-clicks row |
| CART-09 | T02 | `quantity-queue.test.ts`; E2E with `__mock.addRule` 503 on `cart.updateItem` (in the fast-clicks describe) |
| CART-10 | T02, T08 | E2E removal row |
| CART-11 | T04 | E2E removal row (empty state) |
| CART-12 – CART-14 | T05 | E2E coupon rows |
| CART-15 – CART-17 | T01, T04 | E2E summary rows, loading-states slow row |
| CART-18 | T04 | E2E guest CTA row, limited row |
| CART-19 – CART-22 | T07 | `line-notices.test.ts`, E2E live rows |
| CART-23 | T04 | loading-states rows |
| CART-24 | T04, T06 | E2E mobile row, manual check |
| CART-25 | T08 | E2E axe row |
