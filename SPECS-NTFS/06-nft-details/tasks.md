# 06 — NFT details · Tasks

> Status: Ready for review

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom, and check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 05 is Done and spec 04 provides the session accessor and the auth/guest-cart request interceptor. The live-update proofs (T09) need spec 03.

## Blockers (user-provided)

None. The share row icons were delivered on 2026-10-27 in `src/assets/share_icons/` (`linkedin`, `twitter`, `mail`).

## Tasks

- [ ] **T01 — Selection and error models** · DET-10, DET-11, DET-13, DET-14, DET-18, DET-24
  - `model/purchase.ts` and `model/add-errors.ts`.
  - **Proof:** `purchase.test.ts` and `add-errors.test.ts` (design §11).

- [ ] **T02 — Queries, cart seed, guest cart id** · DET-04, DET-16, DET-19
  - `nftDetailQuery` (explicit `retry`) and `relatedQuery`.
  - `features/cart` with spec 07 §2–§4 names: `cart-keys.ts`, `cart-queries.ts`, `apply-cart.ts`, `guest-cart-id.ts`. Replace the `() => null` placeholder in spec 04's `session-bridge.ts` with `getGuestCartId`.
  - Wire `cartCount` in `app/app-shell.tsx` for the header and the tab bar.
  - **Proof:** a Vitest case with `createMockServer()`:
    - a guest's first `cartApi.addItem` returns `g_…`;
    - after `setGuestCartId`, `cartApi.get` returns that cart.

- [ ] **T03 — Route, skeleton, error, not found** · DET-01, DET-02, DET-03
  - `routes/nfts/$nftId.tsx` with id-format check, loader, `pendingComponent`, `errorComponent`, `notFoundComponent`, `head` and `staticData`.
  - `details-skeleton.tsx`, `details-error.tsx`, `nft-not-found.tsx`. Replace the spec 00 placeholder.
  - **Proof:**
    - `nft-details.spec.ts` rows: direct access + reload; 404 and bad id;
    - `loading-states.spec.ts` rows: `slow` skeleton; `errors-then-recover`.

- [ ] **T04 — Desktop and mobile composition** · DET-05, DET-06, DET-08, DET-26
  - `details-page.tsx`, `gallery.tsx`, `zoom-dialog.tsx`, `price-rating.tsx`, `meta-list.tsx`, `related-row.tsx`.
  - The mobile content sheet and the top bar trailing slot.
  - **Proof:**
    - `nft-details.spec.ts` rows: gallery/zoom; related;
    - the spec 01 overflow test extended to `/nfts/emerald-ape-042` at 320, 390, 768 and 1440;
    - `loading-states.spec.ts` row: related failure.

- [ ] **T05 — Editions and quantity** · DET-10 – DET-14
  - `edition-picker.tsx` (new `outline` chip variant, added to the `/dev/ui-kit` gallery), `components/quantity-stepper.tsx` (`md` and `sm` sizes, in the gallery), `hooks/use-purchase-selection.ts`.
  - **Proof:** `nft-details.spec.ts` rows: Obsidian, Cosmic plus `?edition=`, Violet, Ana's ABERTA limit.

- [ ] **T06 — Add to cart** · DET-15 – DET-19
  - `cart-mutations.ts` (`useAddCartItem`), `purchase-actions.tsx`, `mobile-buy-bar.tsx`.
  - Loading and duplicate-click guard, the error mapping wired to inline messages and toasts, and the success toast with "Ver carrinho".
  - **Proof:** `nft-details.spec.ts` rows: guest add plus reload plus double click; mobile toast; `EDITION_UNAVAILABLE` rule.

- [ ] **T07 — Tabs, reviews, share** · DET-07, DET-09
  - `details-tabs.tsx` (correct `dl` order), `reviews-list.tsx`, `share-row.tsx` with the `share_icons/` set.
  - **Proof:** `nft-details.spec.ts` rows: tabs/specs/reviews; share `href`s.

- [ ] **T08 — Favorites** · DET-20 – DET-23
  - `features/favorites`: keys and query (enabled by session), `use-toggle-favorite.ts` (per-NFT scope, undo-this-intent rollback, final reconcile), and `favorite-button.tsx` with its four variants and the guest redirect.
  - Mount the `circle` variant in the mobile top bar trailing slot.
  - **Proof:** `use-toggle-favorite.test.ts`; `favorites.spec.ts` (all rows except the card one).

- [ ] **T09 — Live updates** · DET-24
  - Connect the version effect in `usePurchaseSelection` to `announce` and clamping.
  - **Proof:** `nft-details.spec.ts` live row (`__mock.updateNft`), run once spec 03 is Done. Until then, the row triggers the refetch itself after `updateNft`, by dispatching a window `focus` event (the refetch-on-focus default), which exercises the same cache-driven path.

- [ ] **T10 — Catalog card actions** · DET-25
  - Fill spec 05's card `actions` slot: the `card-desktop` heart plus `CardCartAction` on desktop, and the `card-mobile` heart on mobile.
  - **Proof:**
    - `favorites.spec.ts` card row;
    - a `nft-details.spec.ts` row: the desktop card cart action on Golden Beat adds one unit of the first available edition and shows the toast.

- [ ] **T11 — Accessibility pass** · DET-27
  - Headings, radio group, `aria-pressed` thumbnails, the stepper `output`, tablist, the buy bar region and its tab order.
  - **Proof:** `nft-details.spec.ts` axe row; a keyboard-only purchase row (Tab to an edition, arrow keys, `+`, Enter on "COMPRAR").

- [ ] **T12 — Close-out** · DET-28
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green in both projects.
  - Record design §13 deviations for spec 14.
  - Set spec 06 to **Done** in [`../README.md`](../README.md).

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| DET-01 | T03 | direct access + reload E2E |
| DET-02 | T03 | 404 + bad id E2E |
| DET-03 | T03 | skeleton / error-retry E2E |
| DET-04 | T02, T04 | related failure E2E |
| DET-05 | T04 | gallery + zoom E2E |
| DET-06 | T04 | anchor content E2E |
| DET-07 | T07 | tabs E2E |
| DET-08 | T04 | related E2E |
| DET-09 | T07 | share `href` E2E |
| DET-10 | T01, T05 | edition order |
| DET-11 | T01, T05 | `?edition=` E2E; `defaultEditionId` unit |
| DET-12 | T05 | Obsidian / Cosmic E2E |
| DET-13 | T05 | Violet caption E2E |
| DET-14 | T01, T05 | `addableMax` unit; Ana ABERTA E2E |
| DET-15 | T06 | COMPRAR → `/cart`; mobile toast E2E |
| DET-16 | T02, T06 | guest add + reload E2E |
| DET-17 | T06 | double click → one request |
| DET-18 | T01, T06 | `add-errors.test.ts`; 409 rule E2E |
| DET-19 | T02, T06 | header count E2E |
| DET-20 | T08 | optimistic E2E |
| DET-21 | T08 | rollback, rapid toggles (unit + E2E) |
| DET-22 | T08 | guest redirect E2E |
| DET-23 | T08 | reload + user switch E2E |
| DET-24 | T01, T09 | `diffNft` unit; live E2E |
| DET-25 | T10 | card actions E2E |
| DET-26 | T04 | mobile layout; overflow test |
| DET-27 | T11 | axe; keyboard purchase |
| DET-28 | T12 | full suite green |
