# 05 — Catalog · Tasks

> Status: Done

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom, and check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 01, 02 and 04 are Done (the favorites guard in T09 uses spec 04's `requireAuth`).

## Blockers (user-provided)

None. The artworks and screenshots were delivered on 2026-10-27.

## Tasks

- [x] **T01 — Search schema and helpers** · CAT-01, CAT-02, CAT-04
  - `features/catalog/model/search.ts`: `catalogSearch`, `toListQuery`, `withChange`, `withPage`, `isDefaultState`, `CLEARED`.
  - `model/labels.ts`: sort, segment and rarity labels.
  - **Proof:** `model/search.test.ts` (design §13).
  - Run: `search.test.ts` (17 tests: defaults omitted, canonical lists, price normalization and inversion, `page` coercion, raw keys kept as `undefined`, `withChange`/`withPage`, `toListQuery`).

- [x] **T02 — Price range conversion** · CAT-09
  - `model/price-range.ts`: `toSteps`, `fromSteps`, `boundsFromFacets`.
  - **Proof:** `model/price-range.test.ts`.
  - Run: `price-range.test.ts` (7 tests: floor/ceil to hundredths, no float drift, degenerate bounds, ends on the bound cleared).

- [x] **T03 — Query keys and options** · CAT-06, CAT-15, CAT-16
  - `api/keys.ts` (`catalogKeys`, exported for specs 03 and 06) and `api/queries.ts` (`nftListQuery` with `keepPreviousData` and `signal`; `highlightsQuery`).
  - Add the development-only `applied` guard.
  - **Proof:** a Vitest case with the spec 02 `createMockServer()` and 1 000 ms latency:
    - two `fetchQuery` calls for different keys, then `cancelQueries` on the first: its request is logged `aborted`;
    - the second resolves with matching `applied`.
  - Run: `api/queries.test.ts` (4 tests, `serveMockApi` + fake clock): the first request is logged `aborted` after `cancelQueries`, the second resolves with its own `applied`; a late response stays in its own cache entry; `isAppliedQuery` compares the echoed query with the asked one; one cache entry per URL state.

- [x] **T04 — `NftImage` and `ProductCard`** · CAT-21, CAT-23
  - `components/nft-image.tsx` with the `sizes` table.
  - `product-card.tsx` (`grid`, `grid-mobile`, `compact`): stretched link, price and previous price, rarity badge, "Esgotado", and the `actions` slot with "Ver detalhes".
  - `card-skeleton.tsx` at exact sizes.
  - Add the card variants and skeletons to the `/dev/ui-kit` gallery (spec 01).
  - **Proof:**
    - gallery axe passes;
    - a gallery E2E row checks `srcset` has three `w` candidates and that `width`/`height` are set.
  - Run: gallery axe passes; `design-system.spec.ts` "catalog cards carry srcset, sizes and intrinsic size" and `catalog.spec.ts` images row pass in both projects.

- [x] **T05 — Route, grid and pagination** · CAT-03, CAT-05, CAT-06, CAT-11, CAT-12, CAT-14, CAT-15
  - `routes/index.tsx` (`validateSearch`, `loaderDeps`, non-blocking prefetch, `head`, `staticData`).
  - `catalog-section.tsx`, `product-grid.tsx` (desktop 3-col, mobile staggered 2-col, `md` 3-col), `catalog-pagination.tsx` with real `href`s and focus on the heading.
  - Loading, placeholder (dimmed, busy, announce) and beyond-last-page states.
  - Replace the spec 00 placeholder home.
  - **Proof:** `catalog.spec.ts` rows: nine anchors; page 2 / reset; back/forward; malformed params; `page=99`.
    `loading-states.spec.ts` rows: skeleton + no shift; dimmed previous results.
  - Run: `catalog.spec.ts` rows (nine cards, page 2 + focus, back/forward from the cache, malformed params, beyond-last page) and `loading-states.spec.ts` rows (skeleton without layout shift, dimmed previous results) pass in both projects.

- [x] **T06 — Filters, tabs, sort, results bar** · CAT-07, CAT-08, CAT-09, CAT-10, CAT-13
  - `filters-panel.tsx` (checkbox rows with counts and non-color cue, slider plus "Aplicar"), `segment-tabs.tsx`, `sort-select.tsx`, `results-bar.tsx`, `empty-state.tsx`.
  - **Proof:** `catalog.spec.ts` rows: search; combined filters plus reload; sort; price range; "zzzz" plus "Limpar filtros".
  - Run: `catalog.spec.ts` rows search, combined filters + reload, sort, price range by keyboard + "Aplicar", "zzzz" + "Limpar filtros" pass.

- [x] **T07 — Error and empty states** · CAT-16, CAT-17, CAT-18, CAT-19
  - Alerts with retry for the grid, hero and banner independently.
  - Empty-catalog copy and the static hero fallback.
  - Out-of-order handling verified end to end.
  - **Proof:**
    - `catalog.spec.ts` rows `scenario=empty` and `scenario=out-of-order`;
    - `loading-states.spec.ts` rows `errors-then-recover` (with `page.clock`) and `offline` after load.
  - Run: `catalog.spec.ts` rows `scenario=empty` and out-of-order; `loading-states.spec.ts` rows 503 retries + recover (with `page.clock`) and failure after a successful load pass.

- [x] **T08 — Hero, featured banner, promos, blog** · CAT-20, CAT-22, CAT-23
  - `home/*` and `content/home-copy.ts`.
  - The scroll-snap carousel with dot buttons and no autoplay; the first slide gets `priority`.
  - Desktop and mobile slide variants (`title`/`shortTitle`).
  - Blog "Ler mais" via `UnavailableLink`.
  - **Proof:**
    - `catalog.spec.ts` hero-dots row;
    - a desktop row checks a promo "Explorar" leads to `/?segment=new#mercado`, and that blog "Ler mais" leaves the URL unchanged with "Disponível em breve".
  - Run: `catalog.spec.ts` hero-dots row and promo / blog row pass.

- [x] **T09 — Favorites mode** · CAT-24
  - `beforeLoad` guard through spec 04's session accessor, `favorites: true` in the query, the "Lista de interesse" heading and title, and the empty-favorites copy.
  - **Proof:** `catalog.spec.ts` favorites rows (guest redirect; Ana sees 5).
  - Run: `catalog.spec.ts` favorites rows (guest redirected to login and back, Ana sees only her favorites, mobile heart and footer link) pass.

- [x] **T10 — Mobile composition and search entry** · CAT-25, CAT-26
  - `search-field.tsx` (debounced, `replace`), `filters-sheet.tsx` (filters plus sort, "Ver N resultados", active-count badge), `search-dialog.tsx`.
  - Wire `onSearch` in `app/app-shell.tsx`, which enables the header search and the tab bar's center button (amends spec 01's `onSearch` stub).
  - **Proof:** `catalog.spec.ts` rows: desktop dialog search; mobile FAB/sheet/tabs.
  - Run: `catalog.spec.ts` rows header search dialog, tab bar button (field focus / dialog), mobile sheet (filter, sort, count badge, "Ver N NFTs") pass.

- [x] **T11 — Accessibility and overflow pass** · CAT-27
  - Landmarks, carousel roles, focus order, `:focus-within` actions.
  - Extend spec 01's overflow test to `/?categories=musica&q=ape` and the empty state.
  - **Proof:** `catalog.spec.ts` axe row; overflow test at 320, 390, 768 and 1440.
  - Run: `catalog.spec.ts` axe rows (default, filtered, empty, favorites, mobile sheet), landmarks row and overflow at 320 / 390 / 768 / 1440 pass.

- [x] **T12 — Close-out** · CAT-28
  - `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green in both projects.
  - Record design §15 deviations for spec 14.
  - Set spec 05 to **Done** in [`../README.md`](../README.md).
  - Run: see the run log below. Deviations are in design §15 (items 12 onward).

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (**525 unit tests** in 36 files, 31 of them new in `features/catalog`), `pnpm build` and `pnpm test:e2e` (**234 passed, 18 skipped** by design, in `desktop-chromium` and `mobile-chromium`) all exit 0. `catalog.spec.ts` and `loading-states.spec.ts` add the catalog rows; the skips are desktop-only or mobile-only rows.
- **Open warning:** `pnpm build` still reports one chunk over 500 kB, owned by spec 13.
- **Found by the E2E run:** the router merges raw URL params under validated ones, so a dropped `page=abc` came back and the API answered 422 (design §15, item 13). The fix and a unit case are in `search.ts` / `search.test.ts`.
- **Found by the design-system suite:** the stretched card link drew its focus ring on `::after`, so the DS-15 test (every focus stop has a 2 px outline) failed. The link keeps its own outline; the test is unchanged.
- **Found by a visual check:** the sticky footer of the mobile filter sheet let the last facet show under it; `sticky -bottom-6` matches the sheet padding (design §15, item 23).
- Existing E2E adapted to the real home (not weakened): `smoke.spec.ts` and `mocks.spec.ts` use the hero heading and the "Início · KURIO" title through `e2e/support/home.ts`; the mobile unavailable-link test in `design-system.spec.ts` uses the gallery, because the home no longer has an unavailable link on mobile.
- Spec 01 (`onSearch`, `Slider.thumbValueText`, favorites links) and spec 04 (favorites guard, tab bar link) docs carry an amendment note.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| CAT-01 | T01 | `search.test.ts` defaults omitted |
| CAT-02 | T01, T05 | `search.test.ts`; malformed-params E2E |
| CAT-03 | T05, T06 | reload / direct URL E2E |
| CAT-04 | T01, T05 | `withChange` unit; page-reset E2E |
| CAT-05 | T05, T10 | back/forward E2E; debounced replace |
| CAT-06 | T03, T05 | anchors E2E |
| CAT-07 | T06 | combined filters E2E; footer link |
| CAT-08 | T06 | facet counts E2E |
| CAT-09 | T02, T06 | `price-range.test.ts`; price E2E |
| CAT-10 | T06 | sort E2E |
| CAT-11 | T05 | page 2 + focus E2E |
| CAT-12 | T05 | `page=99` E2E |
| CAT-13 | T06 | "Limpar filtros" E2E |
| CAT-14 | T05 | skeleton + no-shift E2E |
| CAT-15 | T03, T05 | dimmed previous results E2E |
| CAT-16 | T03, T07 | abort unit; out-of-order E2E |
| CAT-17 | T07 | empty E2E (search, scenario) |
| CAT-18 | T07 | errors-then-recover, offline E2E |
| CAT-19 | T07, T08 | `scenario=empty` hero/banner |
| CAT-20 | T08 | hero dots E2E |
| CAT-21 | T04 | anchors + previous price E2E |
| CAT-22 | T08 | promo / blog E2E |
| CAT-23 | T04, T08 | `srcset` gallery check; hero `fetchpriority` |
| CAT-24 | T09 | favorites E2E |
| CAT-25 | T10 | search dialog / FAB E2E |
| CAT-26 | T05, T10 | mobile E2E; overflow test |
| CAT-27 | T11 | axe; overflow |
| CAT-28 | T12 | full suite green |
