# 05 — Catalog · Design

> Status: Done (see §15 for what changed while implementing)

Implements [`requirements.md`](requirements.md). Figma: Home desktop `2:2` ([`desktop/home.md`](../../figma_tokens/desktop/home.md)), Home mobile `14:5226` ([`mobile/home.md`](../../figma_tokens/mobile/home.md)), and the screenshots `desktop/Início.png` and `mobile/Início.png`.

## 1. Dependencies

None new. The spec uses:
- TanStack Router (`validateSearch`, `Link`, `useNavigate`) and Query (`queryOptions`, `keepPreviousData`);
- spec 01 components: Tabs, Select, Slider, Checkbox, Sheet, Dialog, Pagination, Skeleton, `LoadingRegion`, Alert, Badge, `UnavailableLink`, and the icon registry;
- spec 02 `catalogApi` and the contracts.

## 2. Layout

```
src/
  routes/index.tsx                     # validateSearch, beforeLoad (favorites guard), loader prefetch, <HomePage/>
  components/nft-image.tsx             # <NftImage image sizes priority?> — shared with 06, 07, 10
  features/catalog/
    api/keys.ts                        # catalogKeys
    api/queries.ts                     # nftListQuery(query), highlightsQuery()
    model/search.ts                    # catalogSearch schema, toListQuery, withChange, isDefaultState
    model/price-range.ts               # Eth ↔ slider steps (hundredths)
    model/labels.ts                    # sort / segment / rarity labels (pt-BR)
    components/
      catalog-section.tsx              # section#mercado: toolbar, results bar, grid, pagination, states
      filters-panel.tsx                # Coleções, Faixa de preço, Rede (desktop sidebar + sheet body)
      filters-sheet.tsx                # mobile Sheet: FiltersPanel + SortSelect
      segment-tabs.tsx  sort-select.tsx  results-bar.tsx  catalog-pagination.tsx
      product-grid.tsx                 # 3-col desktop / staggered 2-col mobile / 3-col md
      product-card.tsx                 # variants: grid | grid-mobile | compact (related, spec 06)
      card-skeleton.tsx  empty-state.tsx
      search-field.tsx                 # mobile top field (debounced)
      search-dialog.tsx                # header / FAB search entry
    home/
      hero-carousel.tsx  featured-banner.tsx  promo-cards.tsx  blog-section.tsx  home-page.tsx
    content/home-copy.ts               # static promo + blog copy (pt-BR)
e2e/
  catalog.spec.ts
  loading-states.spec.ts               # catalog block; specs 06 and 07 add theirs
```

## 3. Route and search params (CAT-01 – CAT-05)

### Schema (`model/search.ts`)

```ts
const csv = <T extends z.ZodEnum>(item: T) =>
  z.string().optional().catch(undefined).transform((s) => {
    const values = [...new Set((s ?? '').split(',').filter((v) => item.safeParse(v).success))].sort()
    return values.length ? values.join(',') : undefined           // canonical, sorted: same state ⇒ same URL
  })

export const catalogSearch = z.object({
  q: z.string().trim().max(80).optional().catch(undefined).transform((v) => v || undefined),
  categories: csv(CategoryId),
  networks: csv(NetworkId),
  minPrice: Eth.optional().catch(undefined),
  maxPrice: Eth.optional().catch(undefined),
  segment: z.enum(['new', 'trending']).optional().catch(undefined),        // 'all' = omitted
  sort: z.enum(['price-asc', 'price-desc', 'popular']).optional().catch(undefined),   // 'recent' = omitted
  page: z.coerce.number().int().min(2).optional().catch(undefined),        // 1 = omitted
  favorites: z.literal(1).optional().catch(undefined),
}).transform(dropInvertedPrice)          // minPrice > maxPrice ⇒ both dropped (CAT-02)
```

- **Comma-joined strings.** Lists are kept as strings in the URL, not as arrays. The router's default JSON search serializer would write arrays as `%5B%22…`, and spec 01's footer links already use `?categories=musica`. `toListQuery(search)` splits them into the `NftListQuery` arrays.
- **Defaults are absent.** No default value is written, so `/` and `/?page=1` both canonicalize to `/` (CAT-01).
- **Out-of-scope params.** spec 02's `startMocks` strips `scenario` and `reset` before the router reads the URL. Unknown params are ignored by Zod's default `strip`.

### Navigation helpers

```ts
type CatalogChange = Partial<Omit<CatalogSearch, 'page'>>
export function withChange(prev: CatalogSearch, change: CatalogChange): CatalogSearch   // also clears page (CAT-04)
export function withPage(prev: CatalogSearch, page: number): CatalogSearch                // keeps the rest
export const CLEARED: CatalogSearch = {}                                                  // "Limpar filtros"
```

Every control navigates with `navigate({ to: '/', search: (prev) => withChange(prev, …), hash: 'mercado', resetScroll: false })`:
- a push for filters, segment, sort and page (CAT-05);
- `replace: true` for the debounced search (300 ms, `useDebouncedCallback` in `search-field.tsx`; the dialog submits immediately).

The input keeps its own text while typing and resyncs from `search.q` when the URL changes from elsewhere, such as back or "Limpar filtros".

### Route (`routes/index.tsx`)

- `validateSearch: catalogSearch`.
- `beforeLoad`: favorites guard (§11).
- `loaderDeps: ({ search }) => ({ query: toListQuery(search) })`.
- `loader`: `void queryClient.prefetchQuery(nftListQuery(query))` and `void queryClient.prefetchQuery(highlightsQuery())`. These are not awaited, so the page renders its skeletons immediately (CAT-14). The router never blocks on the catalog.
- `head`: title "Início · KURIO", or "Lista de interesse · KURIO" in favorites mode.
- `staticData.shell`: `{ nav: 'home', headerDivider: true, mobile: { kind: 'tab', tab: 'home' } }`. The shell switches to the `favorites` tab from the search param, as spec 01 §8 defines.

## 4. Queries (CAT-06, CAT-15, CAT-16)

```ts
export const catalogKeys = {
  all: ['nfts'] as const,
  lists: () => [...catalogKeys.all, 'list'] as const,
  list: (q: NftListQuery) => [...catalogKeys.lists(), q] as const,
  details: () => [...catalogKeys.all, 'detail'] as const,           // used by spec 06
  detail: (id: NftId) => [...catalogKeys.details(), id] as const,
  related: (id: NftId) => [...catalogKeys.all, 'related', id] as const,
  highlights: ['highlights'] as const,
}

export const nftListQuery = (q: NftListQuery) => queryOptions({
  queryKey: catalogKeys.list(q),
  queryFn: ({ signal }) => catalogApi.list(q, { signal }),
  placeholderData: keepPreviousData,
})
```

- **One cache entry per state.** `toListQuery` always produces the same object for the same state: sorted lists, defaults filled, `pageSize: 9`. Each URL state therefore maps to exactly one key, and back/forward hits the cache.
- **Stale responses (CAT-16):**
  - The component reads only the entry for the current key, so a late response for an old key lands in its own entry and is never displayed.
  - The query function consumes `signal`, so when the key changes, the old query loses its observer and TanStack aborts the request. The spec 02 request log shows `aborted`.
  - As a guard, the grid also renders only when `data.applied` equals the current query in development and asserts it otherwise (`console.error`), to catch key/query mismatches.
- **Background state (CAT-15):** `isPlaceholderData` (previous key's data while the new one loads) drives the dimmed state. A background refetch of the same key (focus, reconnect, invalidation from spec 03 or 06) shows no indicator.
- **Cache policy:** the spec 00 defaults apply (`staleTime` 30 s, 2 retries for retryable errors).
- **Realtime:** spec 03 patches or invalidates entries under `catalogKeys.lists()` and `catalogKeys.highlights` when `nft.updated` arrives. This spec relies on the keys above being stable and exported.

## 5. Compositions (CAT-26)

**Desktop** (`lg`+, `PageContainer` 1200):

```
<HeroCarousel/>                                        96
<section id="mercado" aria-labelledby="mercado-title">  (h2 "Mercado", visually hidden; "Lista de interesse" visible in favorites mode)
  <aside 310> <FiltersPanel/> <FeaturedBanner/> </aside>   gap 48
  <div> <Toolbar: SegmentTabs | SortSelect/> <ResultsBar/> <ProductGrid 3 × 258, gaps 34 / 72/> <CatalogPagination right/> </div>
</section>                                             96
<PromoCards/> 96 <BlogSection/>
```

At 1024–1199 the grid columns shrink fluidly (`grid-cols-3`, `gap-x-[34px]`) and the card media stays square.

**Mobile** (< `lg`, gutters 24, from `mobile/home.md`):

```
<SearchField/> + <FilterButton 45 → FiltersSheet/>     16
<HeroCarousel compact 190/>                           16
<section id="mercado"> <SegmentTabs scrollable/> 16 <ResultsBar/> <ProductGrid/> <CatalogPagination centered/> </section>
```

- **Grid at 390–767:** two columns with a 16 gap, the right column offset by +32 (`[&>*:nth-child(even)]:translate-y-8` plus 32 of bottom padding so the offset never overlaps the pagination), and a row gap of 24.
- **Grid at `md`:** three columns, no stagger.
- **Hidden below `lg`:** promos, blog, the featured banner and the footer, as in the Figma mobile frame.

## 6. Filters (CAT-07 – CAT-09)

`FiltersPanel` takes `{ search, facets, onChange }` and holds no data fetching of its own. Its facets come from the list query's current, or placeholder, data.

- **Coleções and Rede:**
  - each row is a `<label>` with a visually hidden native checkbox (spec 01 `Checkbox` keeps focus and keyboard behavior), the label text and `(count)`, styled as the Figma text rows (`body-15`, line-height 40);
  - unselected rows use `text-text-secondary`;
  - selected rows use `text-text-accent font-bold`, plus a `check` drawn icon before the label as the non-color cue (deviation);
  - zero-count rows stay enabled, because selecting one is valid but returns zero results;
  - each group is a `fieldset` with a `legend` (the visible group title).
- **Faixa de preço:**
  - spec 01 `Slider` with two thumbs (`aria-label` "Preço mínimo" / "Preço máximo", `aria-valuetext` "1.19 ETH").
  - `model/price-range.ts` converts between `Eth` and integer hundredths without floats:
    - `toSteps(eth)` uses `eth.times(…)` and truncation on the string;
    - `fromSteps(n)` returns `` `${n / 100 | 0}.${String(n % 100).padStart(2, '0')}` ``;
    - the bounds are `floor(min)` and `ceil(max)` of `facets.price`.
  - The draft range lives in local state and is committed to `minPrice`/`maxPrice` only by "Aplicar" (CAT-09).
  - When the draft equals the full bounds, both params are removed instead of written.
  - The label uses `formatEthAmount` from spec 02: `Preço: 0.02 - 12.30 ETH`.
- **Mobile sheet** (`FiltersSheet`): spec 01 `Sheet side="bottom"` titled "Filtros", containing `FiltersPanel` plus `SortSelect`.
  - Changes apply immediately to the URL, as on desktop, so results update behind the sheet.
  - The footer has "Ver N resultados", which closes the sheet, and "Limpar filtros".
  - The filter button shows a count badge of active filters (`aria-label` "Filtros, 2 ativos").

## 7. Toolbar, results and pagination (CAT-10 – CAT-13)

- **`SegmentTabs`:** spec 01 `Tabs` with tabs only and no panels. The grid sits in one `role="tabpanel"` region labelled by the active tab.
  - Changing the tab navigates with `withChange({ segment })`.
  - Mobile: `overflow-x-auto` with `scroll-snap`, and the active tab scrolled into view.
- **`SortSelect`:** spec 01 `Select` with the visible prefix "Ordenar por:" and the labels from `model/labels.ts`.
- **`ResultsBar`** (CAT-13): shown when `!isDefaultState(search)`.
  - Content: `"<n> NFTs"` (`totalItems`, pt-BR plural "1 NFT") plus "para “<q>”" when searching, and the `link`-variant button "Limpar filtros".
  - It sits above the grid and is not in Figma (deviation).
- **`CatalogPagination`:**
  - Pages are spec 01 `Pagination` links with real `href`s built with `withPage`, so they work with middle-click and without JS routing.
  - Compact window: 1 … p−1 p p+1 … last. "Anterior"/"Próxima" use the `ChevronRightIcon` (Figma draws only "next"; "previous" is added).
  - After navigation, a `useEffect` keyed on `page` scrolls `#mercado` into view and focuses its heading (`tabIndex={-1}`) (CAT-11).
- **Beyond the last page (CAT-12):** `items: []` with `totalItems > 0` shows the empty state "Esta página não existe" plus "Ir para a primeira página".

## 8. Product card and images (CAT-21, CAT-23)

**`ProductCard`** takes `{ nft: NftSummary, variant: 'grid' | 'grid-mobile' | 'compact', actions?: ReactNode, priority?: boolean }`.

- **Structure:**
  - `<article>` with the name as `<h3><Link to="/nfts/$nftId" preload="intent">`;
  - the link's `::after` stretches over the card, so the whole card is clickable while the action buttons stay separate;
  - the image has an empty `alt`, because the link name already describes it and the image only repeats it.
- **Price:**
  - `formatEth(price)` in accent;
  - `previousPrice` as `<s>` in secondary with an `sr-only` "Preço anterior:" prefix, and the current price with an `sr-only` "Preço atual:" prefix.
- **`grid` (desktop):**
  - media box 258 × 300, `surface-card`, artwork 250 square, `rounded-[15px]`, centered.
  - The `actions` slot is a row of 34-square ink buttons overlapping the media bottom, visible on `:hover` and `:focus-within`, and always rendered in the DOM.
  - Spec 05 provides the "Ver detalhes" action (`SearchIcon`, a link to details); spec 06 adds the heart and cart actions.
- **`grid-mobile`:**
  - media 200 tall, `rounded-[20px]`, `gradient.card`, artwork `rounded-[16px]`;
  - rarity badge top-left for `rare | epic | legendary` (spec 01 rarity Badge, labels "RARO", "ÉPICO", "LENDÁRIO");
  - the `actions` slot is in the top-right corner (spec 06 puts the 28 heart there).
- **`compact`:** used by the spec 06 related row and the spec 07 "Colecionadores também viram" row. Width about 219, media square about 212, no actions.
- **Availability:** a card with `available: false` shows an "Esgotado" caption under the price and stays a link.

**`NftImage`** (`components/nft-image.tsx`):

```tsx
<img src={image.url} srcSet={image.srcSet.map((s) => `${s.url} ${s.width}w`).join(', ')}
     sizes={sizes} width={image.width} height={image.height} alt={alt ?? image.alt}
     loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
```

| Slot | `sizes` |
|---|---|
| Hero | `(min-width: 1024px) 450px, 138px` |
| Grid card | `(min-width: 1024px) 250px, (min-width: 768px) 30vw, 168px` |
| Featured banner | `310px` |
| Promo | `290px` |
| Blog | `268px` |
| Compact card (06, 07) | `(min-width: 1024px) 212px, 40vw` |

- The first hero slide gets `priority` (CAT-23). Grid cards are lazy, because they sit below the hero on both compositions.
- Every image box has a fixed `aspect-square` and a `surface-card` background, so nothing shifts while images load.

## 9. Home content (CAT-19, CAT-20, CAT-22)

**`HeroCarousel`** (`highlightsQuery`):
- **Track:** a horizontal `scroll-snap` track with one slide per `hero` item, and `overflow-x: auto` with hidden scrollbars.
- **Dots:** `button`s with `aria-label` "Destaque 2 de 3" and `aria-current` on the active one. Activating a dot scrolls its slide into view; an `IntersectionObserver` updates the active dot after a swipe.
- **No auto-advance** (WCAG 2.2.2), recorded as a deviation.
- **Desktop slide:** eyebrow, `h1` title (only the first slide's title is the page `h1`; the others are `p` styled the same), description, the "EXPLORAR" button as a `Link` to `/nfts/$nftId` (open question 1), and a 450 artwork at `rounded-[24px]`.
- **Mobile slide:** the 366 × 190 card, `shortTitle`, `shortDescription`, the "EXPLORAR →" text link, a 138 main artwork, and a 58 overlapping thumb that uses the next slide's image, decorative with `alt=""`.
- **Empty `hero`** (CAT-19): a single static slide with the Figma slide 1 copy, no image, no dots, and "EXPLORAR" as an `#mercado` link.

**`FeaturedBanner`** (desktop sidebar): "NFT EM DESTAQUE" / "OFERTA LIMITADA" and a 310 × 368 artwork. The whole banner links to the featured NFT. It is hidden when `featured` is `null`. Figma's decorative rectangles are omitted.

**`PromoCards`** (static, `content/home-copy.ts`):

| Card | Copy | "Explorar" → |
|---|---|---|
| 1 | "Lançamentos gênesis de edição limitada" / "Colecione edições escassas diretamente dos criadores antes da revelação pública." | `/?segment=new#mercado` |
| 2 | "Arte digital selecionada e muito mais" / "Explore novos artistas, coleções verificadas e obras digitais que definem a cultura." | `/?categories=arte-digital#mercado` |

The images use artworks 03 and 05 through the `fixtures`-independent artwork module. Spec 05 imports `src/assets/NFTs/*` directly, never `@/mocks` (spec 02 §12). The decorative circles are drawn in CSS.

**`BlogSection`** "Diário da Cunhagem" with the subtitle "Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.":

| Meta | Title | Excerpt |
|---|---|---|
| 12 de setembro · Leitura de 6 min | Como funciona a propriedade de NFTs | Aprenda a colecionar, negociar e verificar ativos digitais. |
| 13 de setembro · Leitura de 2 min | 10 artistas digitais para acompanhar | Conheça criadores que moldam a cultura digital. |
| 15 de setembro · Leitura de 3 min | Raridade, atributos e procedência | Entenda raridade, procedência, direitos autorais e utilidade. |
| 15 de setembro · Leitura de 2 min | Como proteger sua carteira | Proteja sua carteira, seus ativos e sua identidade. |

Each "Ler mais →" is a spec 01 `UnavailableLink`. The 4 × 268 row is centered within the 1200 container (Figma left-aligns 1144; normalized).

## 10. Data states (CAT-14 – CAT-19)

| State | Grid | Facets | Hero / banner |
|---|---|---|---|
| First load (`isPending`) | `LoadingRegion label="Carregando catálogo"`, 9 `CardSkeleton`s with exact card sizes | rows skeleton (9 + 3), slider skeleton | hero and banner skeletons at final size |
| Changing state (`isPlaceholderData`) | previous items, `opacity-60`, `aria-busy="true"`, `announce('Atualizando resultados')` once per change | previous facets, inert | — |
| Success, items | grid | facets | slides |
| Success, no items, filters active | `EmptyState` "Nenhum NFT encontrado" / "Tente ajustar a busca ou os filtros." + "Limpar filtros" | facets with zeros | unaffected |
| Success, no items, default state | `EmptyState` "Nenhum NFT disponível no momento" / "Volte em breve para conferir novos lançamentos." | facets with zeros, slider disabled | static slide (CAT-19) |
| Favorites mode, none | "Você ainda não favoritou nenhum NFT." + `Link` "Explorar o mercado" (`/`) | — | — |
| Error, no data | `Alert` with `error.message` + "Tentar novamente" (`refetch`) in place of the grid | hidden | each has its own compact alert + retry |
| Error with previous data | `Alert` above the dimmed previous items | previous | — |

- **Announcements:** errors go through the alert's own `role="alert"`, the result count through the spec 01 `announce` (polite) after each settled change, as "9 NFTs encontrados". There is one channel per event (spec 01 rule).
- **Retry exhaustion:** a 503 three times exhausts the 2 retries and reaches the error state. The next "Tentar novamente" succeeds in the `errors-then-recover` scenario.

## 11. Favorites mode and search entry (CAT-24, CAT-25)

- **Guard:** `beforeLoad: ({ search, context, location }) => { if (search.favorites && !context.session.isAuthenticated()) throw redirect({ to: '/login', search: { redirect: location.href } }) }`.
  - The session accessor comes from spec 04's router context; this spec only calls it.
  - A session that expires while in favorites mode is handled by spec 04's 401 flow.
- **Query:** in favorites mode the query adds `favorites: true`. Spec 06's favorite toggle invalidates `catalogKeys.lists()` so the list stays correct.
- **Heading:** "Lista de interesse" is shown as a visible `h2`. Segment tabs and filters stay available, because the API combines them.
- **Search entry:** spec 05 implements `onSearch` in `app/app-shell.tsx` (amends spec 01, where the header's `onSearch` was `undefined` until now):
  - on `/` below `lg`: focus `#catalog-search`, scrolling it into view;
  - everywhere else, including desktop `/`: open `SearchDialog` (spec 01 `Dialog`, title "Buscar NFTs", one `Input type="search"` with the label "Buscar por nome, coleção ou criador", and the submit "Buscar").
  - Submitting navigates to `{ to: '/', search: withChange({}, { q }), hash: 'mercado' }`, which resets the other filters, and the dialog closes. Focus then lands on the catalog heading, not back on the trigger, because the context changed.

## 12. Accessibility (CAT-27)

- **Landmarks:** `section#mercado[aria-labelledby]`, an `aside[aria-label="Filtros"]` (desktop), and the hero as `section[aria-roledescription="carrossel"][aria-label="Destaques"]` with slides as `group`s with the `aria-roledescription` "slide".
- **Focus order:** desktop runs filters → toolbar → grid → pagination; mobile runs search → filter button → hero → tabs → grid.
- **Hover-only content:** the card action row also shows on `:focus-within`, so keyboard users reach it.
- **Contrast:** inactive filter rows in `text-secondary` and counts both meet the spec 01 contrast table.
- **Overflow:** checked at 320, 390, 768 and 1440 (spec 01 overflow test extended to filtered states).

## 13. Testing (CAT-28)

### Unit (Vitest)

| File | Cases |
|---|---|
| `model/search.test.ts` | Defaults omitted. `page=abc`, `sort=foo` and `categories=nope,musica` give `{ categories: 'musica' }`. `minPrice > maxPrice` drops both. CSV values are sorted and deduplicated. `withChange` clears `page`; `withPage` keeps the rest. `toListQuery` is stable (same state gives a deep-equal object). |
| `model/price-range.test.ts` | `0.02` ↔ 2; `12.30` ↔ 1230; a 4-decimal bound (`1.2345`) floors or ceils correctly; `fromSteps(5)` gives `"0.05"`; no float math (`0.1 + 0.2` case). |

### E2E (`e2e/catalog.spec.ts`, both projects, against the spec 02 mocks)

| Test | Proves |
|---|---|
| `/` shows the nine grid anchors in Figma order, prices `1.19 ETH`…`0.39 ETH`, and Neon Vessel's struck previous price | CAT-06, CAT-21 |
| Search "ape" (and "música" without accent → "musica" matches) → URL `q=ape`, results only contain matches, page reset | CAT-05, CAT-07 |
| Select Música + Polygon + segment Em alta → URL contains all three. Counts change by facet. Reload → same state and checked rows | CAT-03, CAT-07, CAT-08 |
| Sort "Menor preço" → first card `Penny Pixel #001` `0.02 ETH`; "Maior preço" → `Crown Relic #999` | CAT-10 |
| Page 2 → URL `page=2`, heading focused. Then change a filter → `page` gone | CAT-04, CAT-11 |
| Back ×2 / forward → URL and grid restored each step (cache, no skeleton) | CAT-05 |
| Price range via keyboard on the thumbs + "Aplicar" → `minPrice`/`maxPrice` in the URL, label `Preço: … ETH` with dots | CAT-09 |
| `/?page=abc&sort=foo&categories=nope` → defaults, no error. `/?page=99` → "Esta página não existe" + action | CAT-02, CAT-12 |
| Search "zzzz" → "Nenhum NFT encontrado" → "Limpar filtros" → `/` | CAT-13, CAT-17 |
| `?scenario=empty` → "Nenhum NFT disponível no momento", static hero, no banner | CAT-17, CAT-19 |
| `?scenario=out-of-order`: change category twice quickly → the grid shows the last selection's `applied` results. The request log shows the first request `aborted` | CAT-16 |
| Guest `/?favorites=1` → `/login?redirect=%2F%3Ffavorites%3D1`. Ana signed in → "Lista de interesse" with her 5 favorites | CAT-24 |
| Footer "Música" (desktop) → `/?categories=musica#mercado`, row checked | CAT-07 |
| Desktop: header search → dialog → "neon" → `/?q=neon`, Neon Vessel listed | CAT-25 |
| Mobile: FAB focuses `#catalog-search`. Filter button → sheet → select Arte 3D + sort → results update. "Ver N resultados" closes. Tabs scroll horizontally | CAT-25, CAT-26 |
| Hero dots: activate dot 2 → slide 2 visible, `aria-current` moves. "EXPLORAR" → `/nfts/emerald-ape-042` on slide 1 | CAT-20 |
| axe on `/` (default, filtered, empty) — no serious or critical violations | CAT-27 |

### E2E (`e2e/loading-states.spec.ts`, catalog block)

| Test | Proves |
|---|---|
| `?scenario=slow` → 9 skeleton cards inside `[aria-busy=true]` before data. The first card's bounding box is equal before and after load (±1 px) | CAT-14 |
| `slow` + change sort → previous cards stay visible and dimmed, region busy, then new results | CAT-15 |
| `?scenario=errors-then-recover` with `page.clock` advancing through retries → alert "Tentar novamente" → click → grid | CAT-18 |
| `?scenario=offline` after a successful load → refetch error shows the alert above the old results | CAT-18 |

## 14. Figma references

| Element | Node |
|---|---|
| Hero (desktop) / mobile hero card | `70347:239` / `70395:240` |
| Filters / featured banner | `70485:381` / `70410:3791` |
| Product grid, toolbar, pagination | `70342:2830`, `70342:2825` |
| Mobile search / filter button / tabs / grid | `70395:239`, `70410:4122`, `70395:241`, `70395:242` |
| Mobile favorite button / rarity badge | `15:5465` / `15:5496` |
| Promos / blog | `70353:241` / `70343:253` |

## 15. Deviations and notes for `ARCHITECTURE.md` (spec 14)

1. Price filter label uses a dot (`0.02 - 12.30 ETH`), not Figma's comma (spec 02 decision 4).
2. Filter rows are checkboxes; the selected state adds bold and a check icon (non-color cue). Counts come from fixtures, not Figma's numbers.
3. Previous price is struck through, with a text alternative.
4. Card media is normalized to a centered artwork. The Golden Frequency card has a name and price (Figma omits them).
5. Hero has no auto-advance. Slides 2 and 3 use the promo headlines (spec 02 §9). Static fallback when highlights are empty.
6. Results bar, "Limpar filtros", and the empty, error and beyond-last-page states are not drawn.
7. Mobile: pagination below the grid, sort inside the filter sheet, filter sheet not drawn, and promos and blog hidden. Tablet (768–1023) uses the mobile composition with 3 columns.
8. Desktop search is a dialog. The tab bar's center button focuses the mobile search field or opens the dialog.
9. Pagination adds "Anterior".
10. Blog "Ler mais" links are unavailable. Promo body copy 2 is completed ("…que definem a cultura."), because it is truncated in Figma.
11. Catalog list params are comma-joined strings in the URL (readable, shareable), not the router's JSON arrays.
12. **Router-level search serializer** (`app/router.ts`): plain strings, no JSON, for every route. The default serializer would write `categories=musica,music` as `%22musica%2C…%22` and break the shared URLs of the footer links. Other routes only use string params, so nothing else changes.
13. **The router merges raw URL params under the validated ones.** A key the schema drops (`page=abc`, `sort=foo`) must stay present as `undefined` in the validated output, or the raw value comes back and the API answers 422. `catalogSearch`'s final transform keeps dropped keys as `undefined` and `search.test.ts` asserts it.
14. **Schema shape:** each param is `z.unknown().transform(...).optional()` (a transform's output is "non-optional" in Zod 4). `favorites` accepts `1`, `'1'` or `true`. `page` is coerced to 2..10000.
15. **One responsive card** (`ProductCard`) instead of three components: `cornerAction` and `actions` slots carry the mobile heart and the desktop hover row. Variants only change media shape and padding.
16. **Facet rows are never disabled:** each stays a real checkbox, even with a count of 0, so a combination that returns nothing is reachable and the empty state explains it. Counts come from `shown.facets` of the response on screen.
17. **`lastShown`:** when a refetch fails with results already on screen, the alert goes above the old cards (dimmed, `data-outdated="true"`) and "Tentar novamente" refetches. A first load that fails shows the alert alone.
18. **Focus after pagination moves only on a click** on a pagination link, not on a URL change from back/forward, so history navigation does not steal focus.
19. **The `h1`** is the first hero slide's title only. When highlights fail, a hidden `h1` "KURIO" keeps one heading. In favorites mode the `h2#mercado-title` ("Lista de interesse") becomes visible.
20. **The carousel track is a `div`**, not `ul > li[role=group]` (axe `list` violation). The active dot comes from a scroll-position listener, because an IntersectionObserver picked the wrong slide. The dots container is `pointer-events-none` with `pointer-events-auto` buttons so it never covers the hero CTA.
21. **`Slider.thumbValueText`** (spec 01 component): each thumb gets `aria-valuetext` ("0.02 ETH") from the price formatter. Spec 01's slider otherwise unchanged.
22. **Home `<title>`** is "Início · KURIO", and the home heading is the hero title; `smoke.spec.ts`, `mocks.spec.ts` and `design-system.spec.ts` follow (shared `e2e/support/home.ts`).
23. **Sticky sheet footer:** "Ver N NFTs" and "Limpar filtros" stay at the bottom of the filter sheet (`sticky -bottom-6`, with the safe-area inset), so they are reachable without scrolling the facets.
24. **Favorites links:** the mobile tab bar heart and the desktop footer "Lista de interesse" link point to `/?favorites=1` (amends spec 01's shell config and spec 04's footer). A guest is sent to login and returns to the list.
25. **No hash on filter changes:** navigation keeps `resetScroll: false` and does not add `#mercado`, so the URL stays canonical and the page does not jump. Promo and footer links that target the catalog do carry `#mercado`.
26. **`queryClient.query()`** replaces `prefetchQuery` in the loader (deprecated in the installed TanStack Query), with `.catch(noop)` so a failed prefetch never blocks the route.
27. **Promo and blog images have `alt=""`** (decorative: the card text names them). The card focus ring is the link's own outline around the name; the stretched `::after` carries no outline, so the design-system "every focus stop shows a 2 px outline" test keeps its meaning.
28. **Pagination "Anterior"** uses the existing `ArrowLeftIcon`; no new icon.
29. **Amended by spec 11 (2026-10-28):** the search dialog remembers its opener and returns focus to it on close (it has no `DialogTrigger`). The Mercado header row wraps (tabs, then the sort select) and the hero text and art shrink between 1024 and about 1200 px, where the desktop composition overflowed sideways. The mobile hero card is `min-h-49.5` (198 px, what the loaded card measures from 385 px up) instead of a fixed 190 px (Figma's frame is 414 wide; at 390 / 360 / 320 the copy wraps one more line and was cut off); the skeleton reserves the same 198 px, and 245 px under 380 px, so CAT-14's no-layout-shift row holds (the card is 216 px at 380 and shifts once on phones in that narrow band), its art is `clamp(5rem, 33vw, 8.625rem)` and the overlapping thumbnail is hidden under 400 px.
## 16. Amendments (Figma fidelity pass, 2026-10-29)

See `SPECS-NTFS/12-visual-regression/fidelity.md` for the full table. Changes and accepted deviations owned by this spec (input for `ARCHITECTURE.md`):

- **Hero:** the title balances its two lines (`text-balance`) and the copy column reserves the dots' height (`lg:pb-13`), so eyebrow, title and button land at Figma's y; the dots sit 34 px above the bottom edge, below the button. **Deviation kept:** the active dot is a 20 px pill and the others are dimmed with 24 px hit areas (Figma: three equal 8 px dots), for the non-color cue (WCAG 1.4.1) and the target size (2.5.8).
- **Toolbar tabs** are 15 px with a 20 px gap and flush with the grid from `lg`; below `lg` they are 14 px with a 16 px gap so the three fit a 390 px screen.
- **Product card text** uses 18 / 20 px line heights (card 356 px, Figma) instead of 22 / 24.
- **Price filter:** label and "Aplicar" are indented 12 px with the list text. **Deviation:** amounts keep the dot decimal separator ("0.02 - 12.30 ETH") like every other amount; Figma writes this one with a comma.
- **Promo cards:** artwork 288 px wide, copy and button at Figma's offsets. **Deviation:** the decorative circles are two 5 % CSS circles, not Figma's mask group.
- **Blog title** is 28 px from `lg`; blog cards stay 282 px wide filling the column (Figma's 268 px row does not fill its own column).
- **Footer features** (spec 01's footer, edited here): titles 17 px, copy 204 px wide.
- **Collections:** Figma shows "Arte digital" active; ours has no selection in the default state (behaviour).

- **Owner's fix list (2026-10-29):** the desktop hover buttons share one light glyph (the heart turns `primary` only when favorited); the mobile card favorite is a solid `surface-card` circle inside the image corner; the mobile hero uses `bg-hero-card`, two 5 % circles and a thumbnail inside the artwork at every width (Figma's brighter card fails 4.5:1 for the copy, a11y wins); `MobileTabBar` always draws filled icons, drops the active dot, and cuts the notch with an `ink` half-disc (47 px) behind a `bg-primary-fab` button. Details in `SPECS-NTFS/12-visual-regression/fidelity.md`.
