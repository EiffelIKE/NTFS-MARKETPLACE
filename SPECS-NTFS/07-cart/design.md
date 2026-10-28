# 07 — Cart · Design

> Status: Ready for review

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
  quote: (o: CartOwner, network: NetworkId, version: number) => ['cart', ownerKey(o), 'quote', network, version] as const,
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

- **`use-cart-realtime.ts`:** while `/cart` is mounted (and from spec 09 on, `/checkout`), subscribe through spec 03 to `nft.updated`. When the event's `resource.id` is an `nftId` present in the cached cart, invalidate `cartKeys.detail(owner)`; the quote follows the new version. Spec 03 already drops duplicate and older events; this hook adds nothing on top. The subscription is released on unmount.
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
