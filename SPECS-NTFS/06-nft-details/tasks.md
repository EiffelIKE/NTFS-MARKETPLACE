# 06 — NFT details · Tasks

> Status: Done

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom, and check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 05 is Done and spec 04 provides the session accessor and the auth/guest-cart request interceptor. The live-update proofs (T09) need spec 03.

## Blockers (user-provided)

None. The share row icons were delivered on 2026-10-27 in `src/assets/share_icons/` (`linkedin`, `twitter`, `mail`).

## Tasks

- [x] **T01 — Selection and error models** · DET-10, DET-11, DET-13, DET-14, DET-18, DET-24
  - `model/purchase.ts` and `model/add-errors.ts`.
  - **Proof:** `purchase.test.ts` and `add-errors.test.ts` (design §11).
  - Run: `purchase.test.ts` (selection, limits, `diffNft`, caption) and `add-errors.test.ts` (the 409 mapping): 28 new unit tests in `cart`, `favorites` and `nft-details` together, all green.

- [x] **T02 — Queries, cart seed, guest cart id** · DET-04, DET-16, DET-19
  - `nftDetailQuery` (explicit `retry`) and `relatedQuery`.
  - `features/cart` with spec 07 §2–§4 names: `cart-keys.ts`, `cart-queries.ts`, `apply-cart.ts`, `guest-cart-id.ts`. Replace the `() => null` placeholder in spec 04's `session-bridge.ts` with `getGuestCartId`.
  - Wire `cartCount` in `app/app-shell.tsx` for the header and the tab bar.
  - **Proof:** a Vitest case with `createMockServer()`:
    - a guest's first `cartApi.addItem` returns `g_…`;
    - after `setGuestCartId`, `cartApi.get` returns that cart.
  - Run: `cart-mutations.test.ts` (a guest's first add returns `g_…`, `setGuestCartId`, then `cartApi.get` returns that cart; a result after a session change is dropped), `apply-cart.test.ts` (older versions never overwrite), `guest-cart-id.test.ts` (storage and memory fallback). The header and tab bar count is covered by the `nft-details.spec.ts` add-to-cart rows.

- [x] **T03 — Route, skeleton, error, not found** · DET-01, DET-02, DET-03
  - `routes/nfts/$nftId.tsx` with id-format check, loader, `pendingComponent`, `errorComponent`, `notFoundComponent`, `head` and `staticData`.
  - `details-skeleton.tsx`, `details-error.tsx`, `nft-not-found.tsx`. Replace the spec 00 placeholder.
  - **Proof:**
    - `nft-details.spec.ts` rows: direct access + reload; 404 and bad id;
    - `loading-states.spec.ts` rows: `slow` skeleton; `errors-then-recover`.
  - Run: `nft-details.spec.ts` direct access, reload, `nao-existe` and `BAD!!` (no API call); `loading-states.spec.ts` slow skeleton (box does not move) and `errors-then-recover`. `smoke.spec.ts` now opens a real NFT instead of the old placeholder.

- [x] **T04 — Desktop and mobile composition** · DET-05, DET-06, DET-08, DET-26
  - `details-page.tsx`, `gallery.tsx`, `zoom-dialog.tsx`, `price-rating.tsx`, `meta-list.tsx`, `related-row.tsx`.
  - The mobile content sheet and the top bar trailing slot.
  - **Proof:**
    - `nft-details.spec.ts` rows: gallery/zoom; related;
    - the spec 01 overflow test extended to `/nfts/emerald-ape-042` at 320, 390, 768 and 1440;
    - `loading-states.spec.ts` row: related failure.
  - Run: `nft-details.spec.ts` gallery, zoom dialog, related, related failure; `design-system.spec.ts` overflow test also visits `/nfts/emerald-ape-042` at 320, 390, 768 and 1440.

- [x] **T05 — Editions and quantity** · DET-10 – DET-14
  - `edition-picker.tsx` (new `outline` chip variant, added to the `/dev/ui-kit` gallery), `components/quantity-stepper.tsx` (`md` and `sm` sizes, in the gallery), `hooks/use-purchase-selection.ts`.
  - **Proof:** `nft-details.spec.ts` rows: Obsidian, Cosmic plus `?edition=`, Violet, Ana's ABERTA limit.
  - Run: `nft-details.spec.ts` Obsidian, Cosmic Bloom with and without `?edition=`, Violet Nomad, Ana's ABERTA limit; the outline chip and both stepper sizes are in `/dev/ui-kit`, covered by the gallery focus-ring and axe rows.

- [x] **T06 — Add to cart** · DET-15 – DET-19
  - `cart-mutations.ts` (`useAddCartItem`), `purchase-actions.tsx`, `mobile-buy-bar.tsx`.
  - Loading and duplicate-click guard, the error mapping wired to inline messages and toasts, and the success toast with "Ver carrinho".
  - **Proof:** `nft-details.spec.ts` rows: guest add plus reload plus double click; mobile toast; `EDITION_UNAVAILABLE` rule.
  - Run: `nft-details.spec.ts` add to cart: guest add, reload, double click (one request), mobile toast, `EDITION_UNAVAILABLE` and limit rules through `realtime.drop`, retry toast.

- [x] **T07 — Tabs, reviews, share** · DET-07, DET-09
  - `details-tabs.tsx` (correct `dl` order), `reviews-list.tsx`, `share-row.tsx` with the `share_icons/` set.
  - **Proof:** `nft-details.spec.ts` rows: tabs/specs/reviews; share `href`s.
  - Run: `nft-details.spec.ts` tabs, spec values under their own labels, reviews list, share `href`s.

- [x] **T08 — Favorites** · DET-20 – DET-23
  - `features/favorites`: keys and query (enabled by session), `use-toggle-favorite.ts` (per-NFT scope, undo-this-intent rollback, final reconcile), and `favorite-button.tsx` with its four variants and the guest redirect.
  - Mount the `circle` variant in the mobile top bar trailing slot.
  - **Proof:** `use-toggle-favorite.test.ts`; `favorites.spec.ts` (all rows except the card one).
  - Run: `use-toggle-favorite.test.ts` (6 cases) and all of `favorites.spec.ts`.

- [x] **T09 — Live updates** · DET-24
  - Connect the version effect in `usePurchaseSelection` to `announce` and clamping.
  - **Proof:** `nft-details.spec.ts` live row (`__mock.updateNft`), run once spec 03 is Done. Until then, the row triggers the refetch itself after `updateNft`, by dispatching a window `focus` event (the refetch-on-focus default), which exercises the same cache-driven path.
  - Run: `nft-details.spec.ts` live rows through `__mock.updateNft` and the real socket.io-client (spec 03 is Done, so no focus-event stand-in): new price, selected edition sells out, limit drops below the quantity.

- [x] **T10 — Catalog card actions** · DET-25
  - Fill spec 05's card `actions` slot: the `card-desktop` heart plus `CardCartAction` on desktop, and the `card-mobile` heart on mobile.
  - **Proof:**
    - `favorites.spec.ts` card row;
    - a `nft-details.spec.ts` row: the desktop card cart action on Golden Beat adds one unit of the first available edition and shows the toast.
  - Run: `favorites.spec.ts` card row; `nft-details.spec.ts` desktop card cart action on Golden Beat #207 (guest cart, one unit, toast, header count).

- [x] **T11 — Accessibility pass** · DET-27
  - Headings, radio group, `aria-pressed` thumbnails, the stepper `output`, tablist, the buy bar region and its tab order.
  - **Proof:** `nft-details.spec.ts` axe row; a keyboard-only purchase row (Tab to an edition, arrow keys, `+`, Enter on "COMPRAR").
  - Run: `nft-details.spec.ts` axe row (details, sold out, not found) and the keyboard-only purchase row; the mobile buy bar row.

- [x] **T12 — Close-out** · DET-28
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green in both projects.
  - Record design §13 deviations for spec 14.
  - Set spec 06 to **Done** in [`../README.md`](../README.md).
  - Run: See the run log below. Deviations are in design §13 (items 12 onward) and the decisions in §14.

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (**553 unit tests** in 42 files, 28 of them new in `cart`, `favorites` and `nft-details`), `pnpm build` and `pnpm test:e2e` (**299 passed, 25 skipped** by design, in `desktop-chromium` and `mobile-chromium`) all exit 0. `nft-details.spec.ts` and `favorites.spec.ts` are new; `loading-states.spec.ts` and `design-system.spec.ts` gain the details rows.
- **Open warning:** `pnpm build` still reports one chunk over 500 kB, owned by spec 13.
- **Found by the E2E run:**
  - Clicking the heart before the favorites list arrived on a fresh load showed "not favorited", so the click asked for "on". Spec 06 left the code unchanged and made the test wait for the pressed state; spec 11 fixed it in the code (the heart is inert until the list is known) and added the E2E rows.
  - The mobile gallery scroller failed axe's `scrollable-region-focusable`; it is now a labelled, focusable region (arrow keys scroll it).
  - The skeleton's gallery box was 24 px off on mobile and 4 px lower on desktop, and the desktop gallery stretched with the right column; the skeleton now uses the page's own box and the box does not stretch (`lg:self-start`).
  - `product-grid.tsx` was missing the card actions until the card test failed; the grid now fills `cornerAction` and `actions`.
- Radix checks a radio on focus only while the arrow key is still down, so the keyboard test holds the key (`keyboard.down`/`up`) instead of `press`.
- Existing E2E adapted (not weakened): `smoke.spec.ts` drops the `/nfts/1` placeholder row and reloads a real NFT.

## Run log (2026-10-29): zoom gallery amendment

- The zoom dialog browses every image (DET-05 amendment, design §17). New: `hooks/use-slide-track.ts`, `components/slide-track.tsx`, `model/slides.ts` (+ unit test); `gallery.tsx` and `zoom-dialog.tsx` use them. E2E: block `zoom gallery (DET-05)` in `e2e/nft-details.spec.ts` (7 tests in both projects).
- Checked by hand in Chrome at 1440 and 390: the viewer fits the viewport on both, arrows sit over the image edges, dots below it.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| DET-01 | T03 | direct access + reload E2E |
| DET-02 | T03 | 404 + bad id E2E |
| DET-03 | T03 | skeleton / error-retry E2E |
| DET-04 | T02, T04 | related failure E2E |
| DET-05 | T04 | gallery + zoom E2E; zoom gallery E2E block and `slides.test.ts` (amendment 2026-10-29) |
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
