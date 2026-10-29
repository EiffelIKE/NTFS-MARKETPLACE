# 07 — Cart · Design

> Status: Done

Implements [`requirements.md`](requirements.md). Contracts, operations, error codes and fixtures are spec 02's; this spec adds the cart feature (queries, mutations, guest id, merge), the `/cart` screen and its tests.

## 1. Dependencies

None new. Uses spec 01 components (`Button`, `InputGroup`, `Field`, `Skeleton`, `LoadingRegion`, `Alert`, `Badge`, `Tooltip`, toasts and announcer), spec 02 (`cartApi`, `quoteApi`, `catalogApi.related`, `lib/money`, `isApiError`), spec 03 (realtime subscription to `nft.updated`), spec 04 (session, request interceptor, post-login hook, `redirect` param) and spec 06 (`QuantityStepper`, NFT card for the related row).

## 2. Layout

```
src/features/cart/
  api/
    cart-keys.ts            # cartKeys (owner-scoped)
    cart-queries.ts         # cartQueryOptions, quoteQueryOptions
    cart-mutations.ts       # useAddCartItem, useUpdateCartItem, useRemoveCartItem, useApplyCoupon, useRemoveCoupon
    apply-cart.ts           # version-guarded cache write (CART-08)
  model/
    guest-cart-id.ts        # localStorage store (CART-01, CART-02)
    merge-guest-cart.ts     # post-login merge (CART-04)
    line-notices.ts         # status → notice copy, announce dedupe (CART-20 – CART-22)
    quantity-queue.ts       # per-line latest-value-wins sender (CART-08)
    use-cart-realtime.ts    # nft.updated → invalidate (CART-19)
  components/
    cart-page.tsx           # composes desktop/mobile
    cart-table.tsx          # desktop rows (lg+)
    cart-line-card.tsx      # mobile cards
    cart-line-notice.tsx
    cart-summary.tsx        # coupon + amounts + CTA (both layouts)
    coupon-form.tsx
    cart-empty.tsx
    cart-skeleton.tsx
    related-row.tsx         # "Colecionadores também viram"
src/routes/cart.tsx         # head, staticData.shell, loader prefetch
```

## 3. Queries and cache

```ts
type CartOwner = { kind: 'user'; userId: string } | { kind: 'guest' }
export const cartKeys = {
  all: ['cart'] as const,
  detail: (o: CartOwner) => ['cart', ownerKey(o)] as const,                 // 'user:usr_ana' | 'guest'
  quote: (o: CartOwner, network: NetworkId, version: number) => ['cart', ownerKey(o), 'quote', network, version] as const,  // child of `detail`
}
```

- **`cartQueryOptions(owner)`:** `cartApi.get({ signal })`, `staleTime: 30_000`. The owner comes from spec 04's session; while the session is restoring, the query is disabled.
- **`quoteQueryOptions(owner, 'ethereum', cart.version)`:** enabled when the cart has at least one line. Putting `version` in the key makes every cart write produce a new quote (CART-16) and lets an older quote response land in an older key, never the current one. `placeholderData: keepPreviousData` keeps the previous amounts visible behind skeleton overlays only for the amounts that change; the first load shows plain skeletons.
- **Cache writes (`applyCart`):** every cart mutation returns the full `Cart`. `applyCart(qc, owner, next)` writes it only when `next.version >= cached.version` and otherwise drops it (CART-08). Mutations never invalidate the cart; they write the response.
- **Header badge:** `useCartCount()` reads `cart.itemCount` from the same query (`select`) and is passed by `app/app-shell.tsx` as `cartCount` (spec 01 §8).
- **Route loader:** `/cart` calls `ensureQueryData(cartQueryOptions(owner))` without awaiting, so navigation is instant and the skeleton shows.

## 4. Guest cart id and merge

**Store (`guest-cart-id.ts`, created by spec 06):** `getGuestCartId(): string | null`, `setGuestCartId(id)`, `clearGuestCartId()` on `localStorage['kurio.guestCartId']`, wrapped in try/catch (private mode falls back to memory). Spec 04's interceptor reads `getGuestCartId()` and sends `X-Guest-Cart-Id` only when no bearer is attached.

- `useAddCartItem` (guest) calls `setGuestCartId(cart.id)` when the response carries an id and none is stored (CART-01).
- `cartApi.get` for a guest returning `id: null` while an id is stored calls `clearGuestCartId()` (CART-02).

**Merge (`merge-guest-cart.ts`):** registered on spec 04's post-login hook (login, sign-up, and session restore at boot).

1. No stored id → nothing.
2. `cartApi.merge({ guestCartId })` → `clearGuestCartId()`, `applyCart` into the user's key, remove the `guest` cart key.
3. `adjustments.length > 0` → one `notify.info` listing the lines: "Emerald Ape #042 (1/10): quantidade ajustada para 3" / "… indisponível, removido".
4. Failure (network or 5xx) → keep the id; the next session start retries. 401 is spec 04's to handle.

Merge runs before the login redirect resolves, so landing on `/checkout` after `?redirect=/checkout` already sees the merged cart.

## 5. Mutations

| Hook | Operation | Success | Error handling |
|---|---|---|---|
| `useAddCartItem` | `cart.addItem` | `applyCart`; spec 06 shows its own toast | 409 `INSUFFICIENT_AVAILABILITY` / `EDITION_UNAVAILABLE`: spec 06 shows the message and refetches details |
| `useUpdateCartItem` | `cart.updateItem` | `applyCart` | restore server quantity, `notify.error(message, { action: 'Tentar novamente' })`; 409 → also invalidate the cart |
| `useRemoveCartItem` | `cart.removeItem` | `applyCart`, announce, move focus (CART-10) | same as update; the line stays |
| `useApplyCoupon` | `cart.applyCoupon` | `applyCart`, clear the input | `COUPON_*` → `fields.code` message on the field (CART-13); others → toast |
| `useRemoveCoupon` | `cart.removeCoupon` | `applyCart` | toast |

**Quantity queue (`quantity-queue.ts`, CART-08):** the stepper writes a local draft per line and calls `queue.set(itemId, quantity)`. The queue waits 300 ms of quiet, then sends one `updateItem`. While a request is in flight, later values only replace the pending value; when the request settles, the queue sends the pending value if it differs from the server's. The displayed value is the draft while one exists, otherwise the server quantity. Unmounting the line flushes nothing (the page is leaving; the server keeps its last value).

`maxQuantity` comes from the line. The limit text (CART-07) is "Disponíveis: N" when stock is the binding limit (`available !== null && maxQuantity === available`), otherwise "Máximo por pedido: N". Increase at the limit is `aria-disabled` with a tooltip carrying the same text.

## 6. Summary (`cart-summary.tsx`)

| Row (pt-BR) | Value |
|---|---|
| Subtotal | `formatEth(quote.subtotal)` |
| Desconto do lançamento (-) | `formatEth(quote.discount)`; with a coupon, the code is shown under the label |
| Taxa de rede | `formatEth(quote.networkFee)` + caption "Taxa estimada" |
| Total | `formatEth(quote.total)`, accent bold |

- Each value slot has a fixed min-width per layout and `tabular-nums`, so the skeleton and the value occupy the same box (CART-16).
- **Issues line (CART-18):** blocking issues map to one sentence above the CTA: `UNAVAILABLE` "Remova os itens esgotados para continuar.", `INSUFFICIENT_AVAILABILITY` "Ajuste as quantidades indisponíveis para continuar.", `CART_EMPTY` hides the summary. The CTA is a real disabled `Button` with `aria-describedby` pointing at that sentence.
- **CTA:** "Conectar e finalizar" → `Link to="/checkout"`; a guest gets `to="/login" search={{ redirect: '/checkout' }}`. "Continuar explorando" → `/#mercado`.
- **Quote failure:** the amounts area shows an `Alert` "Não foi possível calcular o total." with "Tentar novamente" (`refetch`), and the CTA is disabled.

**Coupon form:** `InputGroup` with input "Digite o código promocional..." and attached "Aplicar". Submit trims and upper-cases; empty → client error "Informe um código.". With a coupon applied, the form is replaced by a row "Cupom KURIO10 — 10% de desconto" + "Remover" (ghost link). A non-blocking coupon issue (CART-14) adds `text-error` notice "Cupom expirado: desconto não aplicado." / "Cupom não aplicável ao subtotal atual." under that row.

## 7. Live changes (CART-19 – CART-22)

- **`use-cart-realtime.ts`:** while `/cart` is mounted (and from spec 09 on, `/checkout`), subscribe through spec 03 to `nft.updated`. When the event's `resource.id` is an `nftId` present in the cached cart, invalidate `cartKeys.detail(owner)`; the quote is refreshed with it (§13, decision 1). Spec 03 already drops duplicate and older events; this hook adds nothing on top. The subscription is released on unmount.
- **Notices (`line-notices.ts`):** the line's `status` drives the notice; the server is the only source of truth.

  | Status | Notice (pt-BR) | Action |
  |---|---|---|
  | `price_changed` | "Preço atualizado: de 1.19 ETH para 1.31 ETH." (`addedUnitPrice` → `unitPrice`) | "Entendi" → `updateItem({ acknowledgePrice: true })` |
  | `limited` | "Restam apenas N disponíveis." (singular "Resta apenas 1 disponível.") | "Ajustar quantidade" → `updateItem({ quantity: maxQuantity })` |
  | `unavailable` | "Esgotado." | "Remover" |

- **Announcements (CART-22):** after each cart refetch, diff statuses against the previous cart; for each line whose status changed to a non-`ok` value, `announce('<nome>: <notice>', 'polite')`. A `Set` of `nftId@nft-version` (the version comes from the event) prevents a second announcement for the same change. Visual notices have no toast (spec 01 one-channel rule).
- **Scenario from the brief §7:** an NFT is in the cart → `__mock.updateNft` raises its price → the line shows the notice and the summary's subtotal and total update → checkout (spec 09) revalidates with the new quote id.

## 8. Screen

**Route `/cart`:** `head` title "Carrinho · KURIO"; `staticData.shell = { nav: 'market', headerDivider: false, mobile: { kind: 'inner', title: 'Carrinho de NFTs' } }` (spec 01). Public route: guests have a cart.

**Desktop (`lg`+), per `figma_tokens/screens.md` → Cart:**
- Breadcrumb "Início / Mercado / Carrinho" (current item last, `aria-current`).
- `h1` "Carrinho de NFTs", visually hidden (Figma has no visible title on desktop; on mobile the top bar shows it and is `aria-hidden`, spec 01).
- Left (~780): `<table>` with caption (visually hidden) "Itens do carrinho", headers "NFTs / Preço / Edições / Total" and a hidden header for the remove column. Rows 70 tall on `surface-card`, gap 12 (`border-separate border-spacing-y-3`): 70² image, name + "ID do token: #0042" + "Edição: 1/50" (added: lines of the same NFT differ only by edition; deviation), unit price, stepper, line total, trash button. Notices render as a full-width row under their line (`<tr>` with one `colspan` cell).
- Right (~330): "Resumo da carteira" summary.
- Below: "Colecionadores também viram" with `nfts.related` of the first line's NFT, using spec 06's related card; hidden when the cart is empty or the request fails (decorative content, no error UI).

**Mobile (< `lg`):**
- Line cards (`surface-card`, radius ~16, 100² image flush left): name, "Edição: 1/50", line total, stepper on the right; trash as a 40 icon button at the card's top right (Figma overlaps it with the stepper; deviation).
- Fixed bottom summary sheet (`surface-card`, top radius ~30, safe-area padding) with coupon pill + gradient "Aplicar", the four rows and gradient "Conectar e finalizar". `main` gets `padding-bottom` equal to the sheet's measured height (CSS variable set by a `ResizeObserver`), so the last line is reachable (CART-24). Under `@media (max-height: 560px)` (landscape, 200 % zoom) the sheet becomes static at the end of the content.
- No related row (not in the mobile frame).

**Tablet (768):** mobile composition (README open decision), cards in one column, max width 640 centered.

**States:**

| State | Rendering |
|---|---|
| Loading | `LoadingRegion` "Carregando carrinho": 2 line skeletons with the final row/card size + summary skeleton |
| Error | `Alert` "Não foi possível carregar o carrinho." + "Tentar novamente" (`refetch`) |
| Empty | `cart-empty.tsx`: `bag` icon, "Seu carrinho está vazio", "Explorar NFTs" → `/#mercado` |
| Background refetch | content stays; no spinner (summary amounts show skeletons only when the quote key changes) |
| Mutation pending | the acting line's controls show `loading` on the pressed button; other lines stay interactive |

## 9. Accessibility

- Stepper (spec 06 `QuantityStepper`): `role="group"` labelled "Quantidade de <nome>, edição <label>"; buttons "Diminuir quantidade" / "Aumentar quantidade"; the value is an `<output>` (announced by the group on change only via the queue settling, not per click).
- Trash: `aria-label="Remover <nome>, edição <label>"`.
- Coupon field: visible label "Código promocional" (Figma label); errors through `FieldError`.
- Line notices: plain text in the row plus the polite announcement (§7); the action buttons name the line.
- Focus after removal: next line's remove button, else `h1` (`tabIndex={-1}`).

## 10. Testing

### Unit (Vitest)

| File | Proves |
|---|---|
| `features/cart/api/apply-cart.test.ts` | Older `version` is dropped; equal or newer is written (CART-08) |
| `features/cart/model/quantity-queue.test.ts` | Fake timers: 5 clicks in 200 ms → one request with the last value; a change during flight sends one follow-up; no request when the final draft equals the server value (CART-08) |
| `features/cart/model/guest-cart-id.test.ts` | Set/get/clear; `localStorage` throwing falls back to memory (CART-01, CART-02) |
| `features/cart/model/merge-guest-cart.test.ts` | No id → no call; success clears id and writes the user key; adjustments → one toast text; failure keeps the id (CART-04) |
| `features/cart/model/line-notices.test.ts` | Copy per status with `formatEth`; diff announces only changed lines, once per `nftId@version` (CART-20 – CART-22) |

### E2E (`e2e/cart.spec.ts`, brief scenario 5; Chromium desktop + mobile projects)

Uses fixtures only: Ana's cart is `emerald-ape-042` open × 1 + `golden-beat-207` limited-50 × 2 → subtotal `3.17 ETH`, fee `0.016 ETH`, total `3.186 ETH`.

| Test | Proves |
|---|---|
| Ana logs in → `/cart` shows both lines and the summary 3.17 / 0.00 / 0.016 / 3.186 | CART-06, CART-15, CART-17 |
| Increase golden-beat to 3 → total `4.176 ETH`; at 5 (max per order) the increase control is disabled with "Máximo por pedido: 5" | CART-07, CART-16 |
| Five fast clicks → `__mock.requests({ op: 'cart.updateItem' })` has ≤ 2 entries and the final quantity is the last clicked | CART-08 |
| Remove emerald → line gone, focus on the remaining remove button; remove the last → empty state | CART-10, CART-11 |
| `XPTO` → the API's `COUPON_INVALID` message on the field; `VERAO25` → expired message; `KURIO10` → discount `0.317 ETH`, total `2.869 ETH`; "Remover" → back to 3.186 | CART-12, CART-13 |
| Guest adds `penny-pixel-001` → `COLECAO05` → not applicable message | CART-13 |
| Reload → same lines and coupon (guest and Ana) | CART-03 |
| Guest adds `violet-nomad-314` 1/50 (available 1) → log in as Bruno → merged line visible; guest id gone from storage | CART-01, CART-04 |
| Guest adds `emerald-ape-042` ABERTA × 10 → log in as Ana (already has 1) → line capped at 10 and a "quantidade ajustada" toast | CART-04 |
| Cart open, `__mock.updateNft('golden-beat-207', { price: '1.09' })` → notice "de 0.99 ETH para 1.09 ETH", subtotal `3.37 ETH`; "Entendi" → notice gone | CART-19, CART-20 |
| `updateNft` with `available: { editionId: 'limited-50', value: 1 }` → "Resta apenas 1 disponível.", CTA disabled with reason; "Ajustar quantidade" → enabled | CART-18, CART-21 |
| `available: 0` → "Esgotado", line excluded from subtotal | CART-21 |
| Ana logs out → `/cart` is empty (guest); log in as Bruno → no trace of Ana's lines | CART-05 |
| Guest "Conectar e finalizar" → `/login?redirect=%2Fcheckout` | CART-18 |
| Mobile project: top bar "Carrinho de NFTs", no tab bar, bottom summary visible, last line's remove button scrollable into view and not covered | CART-24 |
| axe on loaded, empty and notice states | CART-25 |

### E2E (`e2e/loading-states.spec.ts`, cart share of brief scenario 12)

| Test | Proves |
|---|---|
| Scenario `slow` → skeletons in rows and summary, `aria-busy="true"`, then content with no layout shift (bounding boxes of summary values equal before/after) | CART-16, CART-23 |
| Scenario `errors-then-recover` → error alert after retries, "Tentar novamente" → cart | CART-23 |

## 11. Figma references

- `figma_tokens/screenshots/desktop/Carrinho de NFTs.png`, `figma_tokens/screenshots/mobile/Carrinho de NFTs.png`.
- `figma_tokens/screens.md` → Cart (sizes, copy, colors). Tokens from `figma_tokens/tokens.json` via spec 01 utilities.

## 12. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Edition shown on desktop rows:** Figma rows show only the token id; lines of the same NFT in different editions would be indistinguishable.
- **Mobile trash position:** Figma overlaps the trash icon with the plus button on one card; it moves to the card's top right.
- **Figma copy ignored:** token ids per row and the mobile subtotal (8.92 vs lines 8.14) are design copy; fixtures follow item data. "Desconto do lançamento (-) 00.00" renders as `0.00 ETH`.
- **Estimated fee:** the cart always quotes Ethereum (spec 02 decision 3), labelled "Taxa estimada"; the final fee depends on the network picked at checkout.
- **Cart state policy:** server-owned; mutations write responses (version-guarded) instead of optimistic updates; the quote is keyed by cart version; live events invalidate, never patch, the cart.
- **Guest cart:** id in `localStorage`, merged once after login; adjustments are reported, never silent.
- **Quote refresh:** the quote is keyed by cart version but refreshed by invalidating the cart key on a live change, because the cart version does not move with the NFT (§13, decisions 1–2).
- **Notice placement:** desktop notices are a row under the line; the limit text shows only at the limit; amounts dim while a new quote loads (§13, decisions 2, 7, 10).

## 13. Implementation decisions (2026-10-28)

Decisions taken while implementing, where the design was silent or had to give way to what the code showed.

**Amendments to earlier specs (applied in those documents):**

| Spec | Change |
|---|---|
| 01 | `components/ui/sonner.tsx`: toast descriptions get `whitespace-pre-line`, so the merge toast can list one adjusted line per row. |
| 01 / 06 | `QuantityStepper` takes `decreaseLabel`, `increaseLabel` and `describedBy` (the cart names the line each button acts on, CART-25). The defaults are the old texts, so details is unchanged. |
| 06 | `RelatedRow` (`nft-details`) takes `title` and `hideOnError`: the cart reuses it as "Colecionadores também viram" and shows nothing when the request fails. |
| 00 / 01 | `e2e/smoke.spec.ts`: `/cart` is a real screen now. Its `h1` is "Carrinho de NFTs" and the title stays "Carrinho · KURIO", so the routes table has an optional `title`. |
| 04 | `app/boot.ts` registers the merge task with `session.onSignedIn` (the hook spec 04 left for it). |

**Cache and live changes**
1. **The cart `version` does not change when an NFT does.** The mock (and a real API) bumps it only on cart writes, so a quote keyed by `version` alone would stay stale after `nft.updated`. The quote key is still a child of the cart key, and the live hook invalidates `cartKeys.detail(owner)`, which refetches the cart and the current quote. A cart write still opens a new quote entry.
2. **Quote while the amounts change:** the first load shows skeletons; afterwards the previous amounts of the *same owner* stay (placeholder data checks the owner in the key), dimmed (`opacity-60`, `data-outdated`), and the checkout button stays disabled until the new quote arrives. No skeleton overlays: the amounts do not blink on every click. A refetch in flight (live change, window focus) is treated the same way.
3. **Stale reads:** `cartQueryOptions` discards a read whose `version` is lower than the cached cart (CART-08), in addition to `applyCart` for mutations. A mutation also cancels the cart read before it writes.
4. `useQuote` returns the query as is. The summary derives `outdated` itself (`isPlaceholderData || isFetching`).

**Lines and quantity**
5. **Only one composition is mounted** (`useMediaQuery('(min-width: 1024px)')`, as spec 06 does for the gallery), so every control and test id exists once.
6. **`QuantityQueue`** gets its callbacks through `bind()` after each render (the lint rule for refs in render forbids closing over them in the constructor) and `reset()` on unmount instead of a final `dispose()`, so StrictMode's mount, unmount, mount cycle leaves a usable queue. A failed request drops the draft (the line shows the server's quantity) and calls `onError`, which offers "Tentar novamente".
7. **Limit text** ("Máximo por pedido: N" / "Disponíveis: N") shows only while the quantity is at the limit, under the stepper, and describes the group (`aria-describedby`). A `limited` line whose quantity is above its limit shows it too.
8. **Unavailable lines** keep their price and total, dimmed, the total struck through with a hidden "(não incluído no total)"; the stepper is disabled.
9. **Line names link to the NFT**, with `?edition=` set to the line's edition.
10. **Desktop notices** are a `<tr>` of their own right under the line (a `colSpan` cell with a border), not inside the line's row; the mobile card holds its notice under the line. Notice buttons carry the line in their name ("Ajustar quantidade de Golden Beat #207, edição 1/50"), and the notice text has a hidden name prefix, which is also what the E2E tests filter on.
11. **Announcements:** a notice is announced when its *text* changes (so a second price change is announced, and a refetch with the same text is not). The first cart only sets the baseline. All messages of one cart are joined into one announcement, because the region keeps only the last message of a frame. The dedupe key is `nftId@eventVersion:text`, with the cart version standing in when no event was seen.
12. **Focus after removal:** the target (next line's remove button, else the previous one, else the `h1`) is recorded before the request and applied once the line is gone from the rendered cart; the hook lives in `CartPage`, so it survives the switch to the empty state.

**Merge and coupons**
13. **Merge toast:** title "Carrinho ajustado ao entrar" and one description line per adjusted line. The name and edition come from the merged cart; a line that did not make it in is named through the catalog query. "capped" lines read "quantidade ajustada para N" with the *final* line quantity; "unavailable" ones read "indisponível, não foi adicionado". Overlapping runs of the task (restore and sign-in) share one request.
14. **Coupon form:** the code is upper-cased on submit; a refused code keeps what was typed and the message comes from `fields.code` (`role="alert"`). Applying and removing a coupon are announced ("Cupom KURIO10 aplicado", "… removido"); no toast. The mobile sheet hides the "Código promocional" label visually (Figma shows none) but keeps it for assistive tech.
15. **Summary rows:** the label "Desconto do lançamento" with the value "(-) 0.00 ETH" (Figma puts the sign in the value column); with a coupon the code is shown under the label. The value slot is a 128 px `dd` with a 24 px minimum height, equal to the skeleton's, so no row moves when the amounts arrive.
16. **Mobile sheet padding:** the page's bottom padding is the sheet's measured height plus 16 px (CSS variable written by a `ResizeObserver`); at `max-height: 560px` the sheet is static and the padding is 24 px.

**Tests**
17. **CART-14 in E2E** lowers two prices with `updateNft` until the subtotal falls under COLECAO05's minimum; no fixture coupon expires while an applied coupon exists.
18. **Guest carts in E2E** are created through `POST /cart/items` and the id is stored under `kurio.guestCartId`, as the details page would; the add-to-cart UI itself is covered by spec 06 (one test here uses it for the first guest add and the reload).
19. `mocks.spec.ts` ("another browser context starts from the seed") and `nft-details.spec.ts` (share targets) hard-code `http://localhost:4173`; they fail only when the suite runs on another port.

20. **Amended by spec 11 (2026-10-28):** the cart sheet publishes its height through `useBottomBarInset` (`--bottom-bar-inset` on `<html>`) instead of a local `--cart-sheet-h`, so focus scrolls clear of it; the guest-merge report toast lasts 12 s; the merge row of `cart.spec.ts` checks the toast before the cart (it waited wrongly).
## 14. Amendments (fix batch, 2026-10-28)

- **R1 — the cart refreshes without its page.** `bootApp` registers an always-on `nft.updated` listener (`{ known: true }`, see spec 03 §14) that calls `refreshCartForNft` (`model/refresh-cart.ts`): when the current owner's cached cart holds a line of that NFT, the cart entry (and its quote, by key prefix) is invalidated. An active observer, such as the header badge, refetches at once; otherwise the next mount does. `useCartLive` keeps only the announcements and the per-line event version. Tests: `refresh-cart.test.ts`; E2E `cart.spec.ts` ("a price that changes while the cart page is closed…").
- **R5 — a failed merge is visible.** On a non-401 failure while the session is still current, `createMergeGuestCartTask` shows an error toast ("Não foi possível juntar o seu carrinho de visitante", action "Tentar novamente") that runs the merge again. The guest id is kept, and the next session start still retries. Tests: `merge-guest-cart.test.ts`; E2E `cart.spec.ts` ("a merge that fails says so…").

## 15. Amendments (Figma fidelity pass, 2026-10-29)

See `SPECS-NTFS/12-visual-regression/fidelity.md`. Changes and accepted deviations owned by this spec (input for `ARCHITECTURE.md`):

- **Summary (desktop and sheet):** labels 15 px, values 18 px from `lg` (16 px in the sheet), rows 32 px apart, value column `min-w-28`, button 40 px, "Continuar explorando" 14 px. **Deviation:** a rule above "Total" (Figma has none).
- **Mobile sheet button** is `bg-primary-cta` (new utility in `theme.css`: `primary` to a 12 % deeper tone, left to right); `primary-soft` stays on "Aplicar".
- **Mobile cards:** 20 px apart, "Edição:" 14 px regular. **Deviation kept:** trash top-right and stepper bottom-right (Figma's stepper is mid-right and its trash is lost under a stepper).
- **Desktop rows** keep the edition line and 12 px secondary text (Figma: token id at 14 px and no edition).
