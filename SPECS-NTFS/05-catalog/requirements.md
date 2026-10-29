# 05 — Catalog · Requirements

> Status: Done

Build the home screen: hero carousel, featured banner, the "Mercado" catalog with search, combinable filters, segments, sorting and pagination kept in the URL, and the static promo and blog bands. Desktop and mobile follow their own Figma compositions. The catalog reads only the spec 02 endpoint functions (`nfts.list`, `highlights.get`). It handles loading, empty, error, background-refresh and out-of-order responses without showing stale results.

Brief coverage: §3 (Home), §3.1 (search, filters, sorting, pagination in the URL, page reset, empty, failure and out-of-order responses), §4 (loading, empty, error, success and background states; stale-response discard), §8 (Figma fidelity at 390 / 768 / 1440, skeletons), §9 (E2E scenario 1 and part of scenario 12).

## User stories

- **US-1** — As a collector, I search, filter by collection category, network and price, pick a segment and a sort order, and page through results, combining all of them.
- **US-2** — As a collector, I copy the URL or use the browser's back and forward buttons and get exactly the same results, page and controls.
- **US-3** — As a collector on a slow or failing network, I see skeletons first, then results. A failure gives me a message and a retry, and a late response never replaces newer results.
- **US-4** — As a signed-in collector, I open my favorites list ("Lista de interesse") from the mobile tab bar or the footer.
- **US-5** — As a mobile collector, I search from the top field or the tab bar's center button, and filter and sort from a bottom sheet.

## Acceptance criteria

### URL state

- **CAT-01** — THE SYSTEM SHALL keep the catalog state in the `/` route's search params: `q`, `categories`, `networks`, `minPrice`, `maxPrice`, `segment`, `sort`, `page` and `favorites`. Every param SHALL be optional, and a param with its default value SHALL be omitted from the URL.
- **CAT-02** — WHEN a search param is malformed or unknown (e.g. `page=abc`, `sort=foo`, `categories=nope`, or `minPrice` greater than `maxPrice`), THE SYSTEM SHALL drop that value, fall back to the default and render without error.
- **CAT-03** — WHEN the user opens a URL with catalog params directly, or reloads, THE SYSTEM SHALL render the same results and control states as before.
- **CAT-04** — WHEN the user changes a filter, the segment, the sort or the search, THE SYSTEM SHALL reset `page` to 1. WHEN only the page changes, THE SYSTEM SHALL keep every other param.
- **CAT-05** — WHEN the user changes a filter, the segment, the sort or the page, THE SYSTEM SHALL push a history entry, so that back and forward restore the previous state. Search typing SHALL update the URL after a 300 ms pause and SHALL replace the current entry instead of pushing one per keystroke.

### Search, filters, sorting, pagination

- **CAT-06** — THE SYSTEM SHALL send the URL state to `nfts.list` with `pageSize` 9, and render the returned page in the grid.
- **CAT-07** — THE SYSTEM SHALL let the user combine the following, and SHALL send them together:
  - several categories ("Coleções");
  - several networks ("Rede");
  - one price range ("Faixa de preço");
  - one segment ("Todos os NFTs", "Novos lançamentos", "Em alta");
  - a search term.
- **CAT-08** — THE SYSTEM SHALL show each category and network with the count from the response facets, including zero counts. A selected row SHALL show a non-color cue.
- **CAT-09** — THE SYSTEM SHALL set the price range with a two-handle slider bounded by the facets' price range, in 0.01 ETH steps. The label SHALL read `Preço: <min> - <max> ETH` with a dot decimal separator. The range SHALL be applied only when "Aplicar" is pressed. WHEN the facets have no price range, THE SYSTEM SHALL disable the slider.
- **CAT-10** — THE SYSTEM SHALL offer the sort orders "Listados recentemente" (default), "Menor preço", "Maior preço" and "Mais populares".
- **CAT-11** — THE SYSTEM SHALL show pagination below the grid with the current page marked, plus previous and next controls. Pagination SHALL be hidden when there is only one page. WHEN the page changes, THE SYSTEM SHALL scroll to the top of the catalog and move focus to its heading.
- **CAT-12** — WHEN `page` is beyond the last page, THE SYSTEM SHALL show the empty state with a "Ir para a primeira página" action. It SHALL NOT redirect silently.
- **CAT-13** — WHILE any filter, segment, search or favorites mode is active, THE SYSTEM SHALL show the result count and a "Limpar filtros" action that returns to the default URL state.

### Data states

- **CAT-14** — WHEN the catalog loads for the first time, THE SYSTEM SHALL show nine card skeletons the size of real cards, plus skeleton facet rows, inside a busy region. The hero and the featured banner SHALL have their own skeletons. Content SHALL replace the skeletons without layout shift.
- **CAT-15** — WHILE a new page of results is loading after a change, THE SYSTEM SHALL keep the previous results visible and dimmed, mark the region busy and announce "Atualizando resultados". It SHALL NOT clear the grid.
- **CAT-16** — WHEN responses arrive out of order, THE SYSTEM SHALL show only the results of the current URL state, and SHALL abort requests for states the user has left.
- **CAT-17** — WHEN a search returns no items, THE SYSTEM SHALL show "Nenhum NFT encontrado", a hint and "Limpar filtros". WHEN the catalog itself is empty (no filters active), THE SYSTEM SHALL show "Nenhum NFT disponível no momento" instead.
- **CAT-18** — WHEN the catalog request fails after its retries, THE SYSTEM SHALL show an alert with the error message and "Tentar novamente". IF previous results exist, they SHALL stay visible under the alert. The hero, featured banner and catalog SHALL fail and retry independently.
- **CAT-19** — WHEN highlights are empty, THE SYSTEM SHALL render the hero with the static welcome copy and no artwork or dots, and SHALL hide the featured banner when `featured` is `null`.

### Home content

- **CAT-20** — THE SYSTEM SHALL render the hero as a carousel of `highlights.hero` slides with one dot button per slide, swipeable on touch, without auto-advance. Desktop SHALL use `title` and `description`; mobile SHALL use `shortTitle` and `shortDescription`. "EXPLORAR" SHALL open the slide's NFT.
- **CAT-21** — THE SYSTEM SHALL render each product card as a link to `/nfts/$nftId` with artwork, name, price, and the previous price when present (struck through, with a text alternative). The mobile card SHALL show the rarity badge for non-common NFTs ("RARO", "ÉPICO", "LENDÁRIO"). The desktop card SHALL reveal the Figma action buttons on hover and on keyboard focus.
- **CAT-22** — THE SYSTEM SHALL render the promo cards and the "Diário da Cunhagem" blog band from static copy. Promo "Explorar" buttons SHALL link to catalog states; blog "Ler mais" links SHALL be unavailable links that do not fake success.
- **CAT-23** — THE SYSTEM SHALL render every NFT image from the `Image` contract with `srcset` and a per-slot `sizes`, intrinsic `width`/`height`, and lazy loading below the fold. The first hero image SHALL load eagerly with high fetch priority.

### Favorites mode and search entry points

- **CAT-24** — WHEN `favorites=1` and the user is signed in, THE SYSTEM SHALL list only their favorites under the heading "Lista de interesse", and the mobile tab bar SHALL mark the favorites tab. WHEN the user is a guest, THE SYSTEM SHALL redirect to `/login` with a `redirect` back to the same URL.
- **CAT-25** — WHEN the user activates the header search button or the tab bar's center button, THE SYSTEM SHALL focus the catalog search field on mobile home, and otherwise open a search dialog. Submitting the dialog SHALL navigate to `/?q=<term>` with the catalog in view.

### Responsive and accessibility

- **CAT-26** — THE SYSTEM SHALL use these compositions:
  - from `lg` (1024): the desktop composition, with the sidebar (filters and featured banner), segment tabs plus a sort select, and a 3-column grid;
  - below `lg`: the mobile composition, with search field plus filter button, a compact hero, horizontally scrollable segment tabs, and a staggered 2-column grid at 390 or a 3-column grid from `md` (768).

  The filter button SHALL open a bottom sheet with the same filters plus the sort select.
- **CAT-27** — THE SYSTEM SHALL meet these accessibility requirements:
  - every control has a pt-BR accessible name;
  - filters are checkbox semantics;
  - segment tabs are a tablist;
  - the catalog section is a labelled landmark with `id="mercado"`;
  - the page has no horizontal scrolling at 320, 390, 768 and 1440 except inside the tab scroller.

### Verification

- **CAT-28** — THE SYSTEM SHALL include unit tests for the search schema, URL ↔ query conversion, page reset and the price-slider conversion, plus the E2E suite `e2e/catalog.spec.ts` (brief scenario 1) and the catalog part of `e2e/loading-states.spec.ts` (scenario 12), in both Playwright projects.

## Out of scope

- Favorite toggling (card heart action, optimistic update, rollback) and the card's quick add to cart: spec 06. Spec 05 renders the card's action slot; spec 06 fills it.
- Realtime price and availability patches of catalog caches: spec 03. Spec 05 renders whatever is in the cache.
- Login and the session guard used by favorites mode: spec 04.
- Blog articles, "Criadores", "Aprenda": out of scope for the challenge (unavailable links).
- Visual baselines (spec 12) and Lighthouse runs (spec 13).

## Open questions

Defaults are applied in `design.md`; change them on review if needed.

1. **Hero "EXPLORAR" target.** Figma does not say. Default: the slide's NFT details. Alternative: scroll to `#mercado`.
2. **Mobile pagination.** Figma's mobile frame shows four cards and no pagination. Default: the same numbered pagination below the grid, so the URL stays the single source of truth. Alternative: "Carregar mais" (infinite list), which breaks CAT-03 for deep pages.
3. **Desktop search.** Figma draws only the header icon. Default: a dialog with one search field.
