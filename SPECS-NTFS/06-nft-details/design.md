# 06 — NFT details · Design

> Status: Ready for review

Implements [`requirements.md`](requirements.md). Figma: details desktop `10:244` ([`desktop/nft-details.md`](../../figma_tokens/desktop/nft-details.md)), and the screenshots `desktop/Detalhes do NFT.png` and `mobile/Detalhes do NFT.png` ([`screens.md`](../../figma_tokens/screens.md)), which win where they differ from the inferred values.

## 1. Dependencies

None new. The spec uses:
- spec 01 components: RadioGroup (chips), Tabs, Dialog, Breadcrumb, Button (`loading`), Skeleton, `LoadingRegion`, Alert, the toasts and `announce`, the icons, and the mobile top bar's trailing slot;
- spec 02 `catalogApi`, `favoritesApi`, `cartApi`;
- spec 05 `catalogKeys`, `ProductCard`, `NftImage`.

## 2. Layout

```
src/
  routes/nfts/$nftId.tsx               # params/search validation, loader, pending/error/notFound, head, staticData
  components/quantity-stepper.tsx      # shared with spec 07
  features/nft-details/
    api/queries.ts                     # nftDetailQuery(id), relatedQuery(id)
    model/purchase.ts                  # defaultEditionId, lineLimit, addableMax, clampQuantity, diffNft
    model/add-errors.ts                # ApiError → inline message / action
    components/
      details-page.tsx  details-skeleton.tsx  details-error.tsx  nft-not-found.tsx
      gallery.tsx  zoom-dialog.tsx  price-rating.tsx  edition-picker.tsx
      purchase-actions.tsx             # desktop stepper + COMPRAR + Favoritar
      mobile-buy-bar.tsx               # fixed bottom bar
      meta-list.tsx  share-row.tsx  details-tabs.tsx  reviews-list.tsx  related-row.tsx
    hooks/use-purchase-selection.ts    # edition (URL) + quantity (local) + live clamping
  features/favorites/
    api/keys.ts  api/queries.ts        # favoritesKeys, favoritesQuery
    api/use-toggle-favorite.ts         # optimistic mutation, scoped per NFT
    components/favorite-button.tsx     # variants: button | circle | card-desktop | card-mobile
  features/cart/                       # seeded here with spec 07 §2–§4 names, extended by spec 07
    api/cart-keys.ts                   # cartKeys (owner-scoped, spec 07 §3)
    api/cart-queries.ts                # cartQueryOptions(owner)
    api/apply-cart.ts                  # version-guarded cache write (spec 07 §3)
    api/cart-mutations.ts              # useAddCartItem (spec 07 adds the rest)
    model/guest-cart-id.ts             # localStorage "kurio.guestCartId": getGuestCartId/setGuestCartId/clearGuestCartId
    components/card-cart-action.tsx    # catalog card quick add
e2e/
  nft-details.spec.ts  favorites.spec.ts
  loading-states.spec.ts               # details block
```

**Guest cart id.** Spec 02 assigns guest cart id storage to spec 07. Spec 06 is the first to add items, so it creates `guest-cart-id.ts` and the cart query/mutation modules, using the names, keys and `applyCart` rule of spec 07 §3–§4 so spec 07 only extends them. Spec 04's interceptor reads it to send `X-Guest-Cart-Id`, and spec 07 owns the merge and the clearing.

## 3. Route (DET-01 – DET-03, DET-11)

```ts
export const Route = createFileRoute('/nfts/$nftId')({
  params: { parse: ({ nftId }) => ({ nftId }) },          // format checked in the loader, so a bad id is a 404, not an error
  validateSearch: z.object({ edition: EditionId.optional().catch(undefined) }),
  loader: async ({ context: { queryClient }, params: { nftId } }) => {
    if (!NftId.safeParse(nftId).success) throw notFound()
    try { await queryClient.ensureQueryData(nftDetailQuery(nftId)) }
    catch (e) { if (isApiError(e, 'NOT_FOUND')) throw notFound(); throw e }
    void queryClient.prefetchQuery(relatedQuery(nftId))     // not awaited (DET-04)
  },
  pendingComponent: DetailsSkeleton, pendingMs: 150, pendingMinMs: 300,
  errorComponent: DetailsError, notFoundComponent: NftNotFound,
  head: ({ loaderData, match }) => …,                       // "<name> · KURIO" from the cache; "NFT não encontrado · KURIO"
  staticData: { shell: { nav: 'market', headerDivider: false, mobile: { kind: 'inner', trailing: 'favorite' } } },
})
```

- **Loader retries.** `nftDetailQuery` sets `retry` explicitly to the spec 00 policy, so the loader's fetch retries 5xx and network errors like any query.
- **`DetailsError`:**
  - "Não foi possível carregar este NFT." with the error message;
  - "Tentar novamente" calls `reset()` and then `router.invalidate()`, which reruns the loader without a page reload;
  - "Voltar ao mercado".
- **`NftNotFound`:** `h1` "NFT não encontrado", the text "O NFT que você procura não existe ou foi removido." and the link "Voltar ao mercado" (`/#mercado`).
- **Preloading.** Catalog cards preload on intent (spec 05), so most navigations skip the skeleton.
- **Component data.** The page component reads `useSuspenseQuery(nftDetailQuery(nftId))`, so later cache patches (spec 03, refetch on focus) re-render it (DET-24).

## 4. Queries and caches

| Key | Options | Notes |
|---|---|---|
| `catalogKeys.detail(id)` | `nftDetailQuery`: `catalogApi.get(id, { signal })`, spec 00 `staleTime` | Spec 03 patches it on `nft.updated` |
| `catalogKeys.related(id)` | `relatedQuery` | Own skeleton (5 compact cards) and an inline `Alert` + retry |
| `favoritesKeys.all = ['favorites']` | `favoritesApi.list`, `enabled: session.isAuthenticated`, `select: (r) => new Set(r.nftIds)` | Cleared on user switch by spec 04 |
| `cartKeys.detail(owner)` = `['cart', 'user:<id>' \| 'guest']` | `cartQueryOptions(owner)`: `cartApi.get` | Guests without an id get `{ id: null, items: [] }` from the API. Spec 07 adds `cartKeys.quote(owner, network, version)`, keyed by cart version, so a new add needs no quote invalidation |

**Header count (DET-19).** `app/app-shell.tsx` passes `cartCount = useQuery({ ...cartQueryOptions(owner), select: (c) => c.itemCount })` (spec 07's `useCartCount()`) to the spec 01 header and tab bar. Spec 07 keeps this wiring.

## 5. Selection model (DET-10 – DET-14, DET-24)

Pure functions in `model/purchase.ts`:

```ts
lineLimit(e: Edition): number                    // min(available ?? ∞, maxPerOrder)
inCartQuantity(cart: Cart | undefined, nftId, editionId): number
addableMax(e: Edition, inCart: number): number   // max(0, lineLimit(e) − inCart)
defaultEditionId(eds: Edition[], requested?: EditionId): EditionId | null   // requested if available > 0 (or open), else first available, else null
clampQuantity(q: number, max: number): number    // max ≥ 1 ? min(max(q, 1), max) : 1
diffNft(prev: NftDetail, next: NftDetail, selected: EditionId | null): { priceChanged?: Eth; selectedSoldOut?: boolean }
```

`usePurchaseSelection(nft)` combines these:

- **Edition.** The selected edition comes from `search.edition`, normalized through `defaultEditionId`. Choosing one navigates with `{ search: { edition }, replace: true, resetScroll: false }`.
- **Quantity.** It is local state, reset to 1 when the NFT changes, and clamped by `addableMax` whenever the edition, the cart or the NFT data changes.
- **Live changes.** A `useEffect` on `nft.version` compares the previous and next data with `diffNft` and calls spec 01 `announce`:
  - price change: "Preço atualizado para 1.25 ETH", polite;
  - the selected edition sold out: "A edição 1/10 esgotou.", assertive, and the inline message stays;
  - a lower limit that clamps the quantity: "Quantidade ajustada para 1 (disponível: 1).", polite.
- **Sold-out selection.** A selected edition that sells out stays selected but marked "Esgotada", and both buy buttons are disabled, so the user's context is not lost (DET-24).

**Edition caption** (DET-13), under the chips in `text-secondary`:

| Case | Caption |
|---|---|
| Limited edition | "3 de 10 disponíveis · máx. 3 por pedido" |
| Open edition | "Edição aberta · máx. 10 por pedido" |
| Units already in the cart | "· você já tem 1 no carrinho" appended |
| Cart already holds the limit | "Você já tem o máximo desta edição no carrinho.", and adding is disabled |

## 6. Screen composition (DET-05 – DET-09, DET-26)

**Desktop** (`lg`+):

```
Breadcrumb  Início / Mercado / <name>                                12
[Gallery 573: thumbs 100 col gap 16 | main 444 box, art 404, zoom button 32 top-right]  32  [Details 595]
Details: h1 name · row(price [prev], stars + "19 avaliações de colecionadores") · rule 573
         "Sobre este NFT:" (h2 styled as label) + description
         "Edição:" EditionPicker + caption
         row(QuantityStepper | COMPRAR (primary 130×40) + FavoriteButton variant=button (outline, 130×40))
         MetaList: ID do token / Coleção / Atributos · ShareRow
96  DetailsTabs (full width)   96  RelatedRow   96  footer
```

**Mobile** (< `lg`; 768–1023 is the same, centered at `max-w-[600px]`):

```
TopBar: back · trailing FavoriteButton variant=circle (spec 01 slot)
Gallery track (full width − 48, rounded 20, aspect-square, dots if > 1 image)
Content sheet: bg-surface-card rounded-t-[30px], −mt-16 over the image bottom, p-6
  h1 name + rating chip (★ 4.8(19), primary 1px border pill)
  description · "Edição:" EditionPicker + caption · MetaList
  DetailsTabs · RelatedRow (horizontal scroll-snap)
MobileBuyBar (fixed, safe-area): "Qtd." QuantityStepper(size=sm) · price (accent 20)
  "Comprar NFT" (gradient pill, flex-1, h 60) · cart button (60 circle, aria-label "Adicionar ao carrinho")
```

`main` gets bottom padding equal to the bar height, so the last content clears it.

**Pieces:**
- **`Gallery`:**
  - thumbnails are `button`s with `aria-pressed` and `aria-label` "Imagem 2 de 4", using `NftImage sizes="100px"`;
  - the main image uses `sizes="(min-width: 1024px) 404px, calc(100vw - 48px)"` with `priority` (the LCP);
  - mobile is a scroll-snap track, with dot buttons as in spec 05's hero;
  - the zoom button (`SearchIcon`, `aria-label` "Ampliar imagem") opens `ZoomDialog`, titled "<name> — imagem 1 de 4", with `sizes="min(90vw, 1000px)"`.
- **`PriceRating`:**
  - the rating is a `role="img"` group with `aria-label` "Avaliação 4.8 de 5", made of 5 `StarIcon`s in `text-primary`, filled up to `Math.round(rating)`;
  - "19 avaliações de colecionadores" is a link-styled button that selects the reviews tab and scrolls to it.
- **`EditionPicker`:**
  - a spec 01 `RadioGroup` with chip items, `aria-label` "Edição";
  - Figma's selected style is a `primary` border with accent text, not the spec 01 filled chip. That becomes a new `outline` chip variant whose selected state is `border-primary text-text-accent font-bold` (the weight is the non-color cue);
  - a disabled item gets `line-through text-disabled` and the `sr-only` " — esgotada" (DET-12).
- **`QuantityStepper`** (`components/`, shared with spec 07):
  - `{ value, min, max, onChange, size: 'md' | 'sm', label }`;
  - `−`/`+` are `button`s with `aria-label` "Diminuir quantidade" / "Aumentar quantidade", disabled at the bounds;
  - the value is an `<output aria-live="polite" aria-label="Quantidade">`;
  - desktop uses 31 × 49 `primary` pills, mobile 22 squares.
- **`MetaList`:** a `dl`: "ID do token:" `#0042`, "Coleção:" Kurio Apes, "Atributos:" joined with ", ".
- **`ShareRow`** (desktop only, as in Figma):

  | Target | `href` | `aria-label` |
  |---|---|---|
  | LinkedIn | `https://www.linkedin.com/sharing/share-offsite/?url=<enc>` | "Compartilhar no LinkedIn (abre em nova aba)" |
  | E-mail | `mailto:?subject=<name> na KURIO&body=<url>` | "Compartilhar por e-mail" |
  | Twitter | `https://twitter.com/intent/tweet?url=<enc>&text=<name>` | "Compartilhar no Twitter (abre em nova aba)" |

  The web targets have `target="_blank" rel="noopener noreferrer"`. Icons: `ShareLinkedinIcon`, `MailIcon`, `ShareTwitterIcon` from `src/assets/share_icons/` (spec 01 §5 registry), in that order as in Figma, not the footer `social/` set.
- **`DetailsTabs`:** spec 01 `Tabs`.
  - "Detalhes do NFT": the `longDescription` paragraphs, then a `dl`:
    - **Rede:** `specs.network`;
    - **Contrato:** `${shortAddress(contract.address)} • Contrato inteligente ${standard} verificado.`;
    - **Direitos autorais:** `specs.royalty`.

    The values sit under their correct labels; Figma swaps the last two.
  - "Avaliações de colecionadores (19)": `ReviewsList`. Each review is an `article` with the author, stars, the date (`Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' })`) and the comment, followed by "Mostrando 3 de 19 avaliações". With no reviews, it shows "Este NFT ainda não tem avaliações."
- **`RelatedRow`:**
  - `h2` "Mais desta coleção" in accent, with the full-width rule;
  - spec 05 `ProductCard variant="compact"` × ≤ 5;
  - desktop is `grid-cols-5 gap-[26px]`; below `lg` it is a scroll-snap track with cards at `w-[min(219px,60vw)]`;
  - Figma's carousel dots are dropped, since 5 items fit on desktop (deviation);
  - hidden when the list is empty.

## 7. Add to cart (DET-15 – DET-19, DET-25)

```ts
export function useAddCartItem() {
  const owner = useCartOwner()                                                  // from spec 04's session
  return useMutation({
    mutationKey: ['cart', 'add'],
    mutationFn: (body: AddCartItemBody) => cartApi.addItem(body),
    onSuccess: (cart) => {
      applyCart(queryClient, owner, cart)                                       // spec 07 §3 version guard
      if (owner.kind === 'guest' && cart.id && !getGuestCartId()) setGuestCartId(cart.id)   // DET-16
    },
  })
}
```

- **Buy buttons:**
  - "COMPRAR" and "Comprar NFT" call `mutateAsync`, then `navigate({ to: '/cart' })`;
  - the mobile cart button calls `mutate`, then `notify.success('Adicionado ao carrinho', { action: { label: 'Ver carrinho', onClick: () => navigate({ to: '/cart' }) } })`;
  - while `isPending`, both use the spec 01 `Button loading` (aria-disabled, clicks ignored), and the stepper is disabled (DET-17).
- **Errors** (`model/add-errors.ts`), mapped to an inline message under the edition caption (`role="alert"`) or a toast:

  | Error | Action | Message |
  |---|---|---|
  | `EDITION_UNAVAILABLE` | invalidate `catalogKeys.detail(id)` | inline "Esta edição esgotou. Escolha outra edição." |
  | `INSUFFICIENT_AVAILABILITY` | invalidate the detail; clamp the quantity to `details.lines[0].available − inCart` | inline "Restam apenas N unidades desta edição." |
  | `NOT_FOUND` | invalidate the detail, which leads to the 404 view | — |
  | `UNAUTHENTICATED` / `SESSION_EXPIRED` | spec 04 flow | — |
  | Other | — | `notify.error('Não foi possível adicionar ao carrinho.', { action: 'Tentar novamente' })`, retrying the same body |

- **Card quick add** (`CardCartAction`, desktop card slot):
  - `aria-label` "Adicionar <name> ao carrinho";
  - fetches the detail with `queryClient.fetchQuery(nftDetailQuery(id))` (usually cached by hover preload), takes `defaultEditionId`, and adds one unit;
  - success shows the "Adicionado ao carrinho" toast; errors follow the table, as toasts instead of inline messages;
  - with `nft.available === false` the button is disabled with the tooltip "Esgotado".

## 8. Favorites (DET-20 – DET-23, DET-25)

```ts
export function useToggleFavorite(nftId: NftId) {
  return useMutation({
    mutationKey: ['favorite', nftId],
    scope: { id: `favorite:${nftId}` },                 // serial per NFT (DET-21)
    mutationFn: (next: boolean) => (next ? favoritesApi.add(nftId) : favoritesApi.remove(nftId)),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: favoritesKeys.all })
      setFavorite(queryClient, nftId, next)               // optimistic
    },
    onError: (err, next) => {
      setFavorite(queryClient, nftId, !next)              // undo this intent
      if (!isAuthError(err)) notify.error('Não foi possível atualizar seus favoritos.', { action: retry(next) })
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['favorite', nftId] }) <= 1) {     // last one for this NFT
        void queryClient.invalidateQueries({ queryKey: favoritesKeys.all })
        void queryClient.invalidateQueries({ queryKey: catalogKeys.lists(), predicate: isFavoritesList })
      }
    },
  })
}
```

- **Ordering.** `PUT` and `DELETE` are idempotent and the per-NFT scope runs them in click order, so the server ends in the last intent's state. The final invalidation reconciles the cache with it (DET-21).
- **Rollback.** Undoing only the failed intent, instead of restoring a snapshot, keeps later queued toggles intact. If a later intent succeeds, its state wins; if not, the reconcile refetch shows the server truth.
- **`FavoriteButton`:**
  - reads `useQuery({ ...favoritesQuery(), select: (s) => s.has(nftId) })`;
  - is an `aria-pressed` toggle;
  - the `button` variant is labelled "Favoritar" / "Favoritado" (`HeartIcon` / `HeartFilledIcon` in `text-primary`); the icon variants use `aria-label` "Favoritar <name>" / "Remover <name> dos favoritos";
  - for a guest it renders the same control, and activation navigates to `/login?redirect=<location.href>` (DET-22). The redirect param behavior is spec 04.
- **Variants:**

  | Variant | Where | Look |
  |---|---|---|
  | `button` | desktop details | outline 130 × 40 |
  | `circle` | mobile top bar trailing | 40 circle `bg-surface-card` |
  | `card-desktop` | desktop card actions | 34 square on ink |
  | `card-mobile` | mobile card corner | 28 circle |

- **Isolation (DET-23)** comes from the API plus spec 04 clearing the Query cache on user switch. This spec only tests it.

## 9. Live updates (DET-24)

Spec 03 receives `nft.updated` and patches or invalidates `catalogKeys.detail(id)`, `catalogKeys.related(*)` and the catalog lists. This screen has no socket code: it re-renders from the cache, and `usePurchaseSelection` (§5) turns the version change into announcements and clamping. A refetch on focus produces the same effects, so the behavior is identical with or without realtime.

## 10. Accessibility (DET-27)

- **Headings:** `h1` name; `h2` "Sobre este NFT", the tabs region ("Detalhes"), "Mais desta coleção".
- **Breadcrumb:** spec 01 `Breadcrumb`, with `aria-current="page"` on the name.
- **Focus:** route-change focus handling is the shell's (verified in spec 11). The zoom dialog returns focus to its trigger. After an inline add error, the message is announced but focus stays on the button.
- **Fixed bar:** the mobile buy bar is a `region` with `aria-label` "Compra". It sits after the content in DOM order, so tab order matches the visual order. Its controls stay ≥ 44 tall.
- **Overflow:** no fixed widths beyond 320; the long contract address wraps (`break-all`).

## 11. Testing (DET-28)

### Unit (Vitest)

| File | Cases |
|---|---|
| `model/purchase.test.ts` | `lineLimit` for unique/limited/open. `defaultEditionId`: requested available → it; requested sold out → first available; all sold out → `null`. `addableMax` with the cart holding 1 or the limit. `clampQuantity`. `diffNft` detects a price change and the selected edition selling out. |
| `model/add-errors.test.ts` | Each error code maps to the documented action and message. `INSUFFICIENT_AVAILABILITY` computes the remaining units from `details.lines`. |
| `features/favorites/api/use-toggle-favorite.test.ts` | Uses `QueryClient` + spec 02 `createMockServer()`, signed in as Ana:<br>• optimistic add is visible before the response;<br>• a 500 rule rolls back and calls `notify.error`;<br>• three rapid toggles (on, off, on) leave the cache and server `favorites` both "on";<br>• guest → no request. |

### E2E (`e2e/nft-details.spec.ts`, scenario 2, both projects)

| Test | Proves |
|---|---|
| `goto('/nfts/emerald-ape-042')`, `reload()` → h1 "Emerald Ape #042", `1.19 ETH`, 4 editions, title "Emerald Ape #042 · KURIO", desktop breadcrumb current item | DET-01, DET-06 |
| `/nfts/nao-existe` → "NFT não encontrado", URL unchanged, "Voltar ao mercado" → `/#mercado`. `/nfts/BAD!!` → same view, no `nfts.get` in the request log | DET-02 |
| `obsidian-mask-007` → every chip disabled with "esgotada", buy buttons disabled, "Esgotado" | DET-12 |
| `cosmic-bloom-118` → 1/1 disabled, the first available edition selected. `?edition=unique` falls back the same way. `?edition=limited-50` on Emerald preselects 1/50 | DET-11, DET-12 |
| `violet-nomad-314` 1/50 → caption "1 de 50 disponíveis", `+` disabled at 1 | DET-13, DET-14 |
| Ana, Emerald ABERTA (1 in her cart) → `+` disabled at 9, caption mentions the cart | DET-14 |
| Guest: Emerald 1/10 × 2 → "COMPRAR" → `/cart`. The header count reflects it. `reload()` → still there (guest id persisted). Double click → one `cart.addItem` | DET-15, DET-16, DET-17, DET-19 |
| Mobile: cart button → toast "Adicionado ao carrinho" → "Ver carrinho" → `/cart` | DET-15 |
| Rule `cart.addItem` 409 `EDITION_UNAVAILABLE` × 1 → inline message, detail refetched, count unchanged | DET-18 |
| `__mock.updateNft('emerald-ape-042', { price: '1.25' })` → `1.25 ETH` without reload. `available: { editionId: 'limited-10', value: 0 }` while 1/10 is selected → chip "esgotada", buy disabled. `value: 1` with quantity 3 → quantity 1 | DET-24 |
| Thumbnail 2 → `aria-pressed`. Zoom → dialog titled "… imagem 2 de 4", `Esc` returns focus | DET-05 |
| Tabs: the "Contrato" value contains `0x7A42`, "Direitos autorais" contains `5%`. The reviews tab lists 3 and "Mostrando 3 de 19 avaliações". The rating link opens the reviews tab | DET-07 |
| Related: 5 compact cards in Figma order. Clicking Cosmic Bloom → `/nfts/cosmic-bloom-118` | DET-08 |
| Share `href`s (desktop) | DET-09 |
| axe on details (default, sold-out, 404) | DET-27 |

### E2E (`e2e/favorites.spec.ts`, scenario 4)

| Test | Proves |
|---|---|
| Ana, `sage-nomad-009`, latency 1 000: "Favoritar" → pressed "Favoritado" before the response. `reload()` → still pressed. `/?favorites=1` lists it. Toggle off → gone | DET-20, DET-23 |
| Rule `favorites.add` 500 × 1: toggle → pressed, then reverted + toast. "Tentar novamente" → pressed and persisted | DET-21 |
| Three rapid clicks → final pressed. `__mock.snapshot()` favorites include it | DET-21 |
| Desktop card heart (hover/focus) and mobile card corner toggle; the details page reflects the same state | DET-25 |
| Guest → heart → `/login?redirect=%2Fnfts%2Fsage-nomad-009`; not pressed | DET-22 |
| Ana favorites X, logs out; Bruno logs in → X not favorited | DET-23 |
| `__mock.expireSessions()` then toggle → rollback, spec 04 expiry flow, no favorites error toast | DET-21 |

### E2E (`e2e/loading-states.spec.ts`, details block)

| Test | Proves |
|---|---|
| `?scenario=slow` → details skeleton inside `[aria-busy=true]`, then content. The main image box is the same size before and after load | DET-03 |
| `?scenario=errors-then-recover` → "Não foi possível carregar este NFT." → "Tentar novamente" → content | DET-03 |
| Rule `nfts.related` 500 always → page renders, related shows an inline retry | DET-04 |

## 12. Figma references

| Element | Node |
|---|---|
| Breadcrumb | `10:290` |
| Gallery (thumbs, main) | `70342:2682`, `70342:2683` |
| Title / price / rating | `70342:2686`, `11:1210` |
| Editions / actions / stepper | `70342:2696`, `70342:2762`, `11:1238` |
| Meta + share | `70342:2761` |
| Tabs + specs | `70342:2772`, `11:1251` |
| Related row + dots | `70364:239`, `70364:240` |
| Mobile details | screenshot `mobile/Detalhes do NFT.png` (no node extracted) |

## 13. Deviations and notes for `ARCHITECTURE.md` (spec 14)

1. "Contrato" shows the contract address and "Direitos autorais" the royalty. Figma swaps them.
2. The breadcrumb adds the current item, "Início / Mercado / <name>".
3. The reviews tab is not drawn. It lists the ≤ 3 returned reviews with a "Mostrando k de n" note; writing reviews is out of scope.
4. Mobile edition chips use the real editions (Figma repeats "1/10").
5. Edition chips use an outline-selected variant (Figma) instead of the spec 01 filled chip; bold weight is the non-color cue. Sold-out chips are struck through.
6. Edition availability caption and in-cart notice are not drawn.
7. The related row has no carousel dots on desktop (5 items fit); it scrolls horizontally below `lg`.
8. The share row is desktop only, as in Figma. Share targets are real share URLs.
9. "COMPRAR" adds to the cart and opens it; the mobile cart button adds and stays (open question 1).
10. Mobile and desktop use the same `description`; Figma's mobile copy is a shorter variant of it.
11. The cart query, the header count wiring and the guest cart id store are introduced here (the first spec that writes to the cart) and extended by spec 07.
