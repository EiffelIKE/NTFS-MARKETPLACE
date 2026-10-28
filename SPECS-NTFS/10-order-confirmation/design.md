# 10 — Order confirmation · Design

> Status: Final (2026-10-28)

Implements [`requirements.md`](requirements.md). Uses spec 02's `orders.get` and `Order`, and spec 09's `features/orders/` (query options, `useOrderStatus`, pending and declined panels). No new endpoint or field.

## 1. Dependencies

None new. Uses spec 01's `ThankYouIcon` (80), `CloseIcon`, `Button`, `Tooltip`, `Skeleton`, `Alert`, `NftImage`, `PageContainer`, and spec 02's `formatEth`, `NETWORK_LABELS` and `WALLET_PROVIDER_LABELS`.

## 2. Route, not modal (decision 1)

`/orders/$orderId` is a page that renders the Figma modal as a centered card, inside the normal app shell.

Why not a `Dialog`:
- The receipt must be reachable by direct access and after refresh (brief §3.3, §4); a dialog needs a background page that does not exist in Figma (an empty `ink` page).
- A modal traps focus and hides the rest of the page from assistive technology while offering nothing behind it; a page keeps the header, the footer and the Back button.
- A pending or declined order is rendered at the same address (§4); they are states of a page, not of a dialog.
- Spec 01 already declares the shell config for this route (`nav: market`, mobile `inner` "Pedido").

The card keeps the Figma dialog styling (spec 01 "Dialog pattern": `surface-card`, × close in `primary` at top-right, 10 px `primary` bar along the bottom). Same approach as spec 04 for login and sign-up. Deviation recorded in §10.

## 3. Layout

```
src/
  routes/orders/$orderId.tsx            # beforeLoad: spec 04 guard; loader: reads the order; 404 -> notFound(), 403 -> forbidden view
  features/receipt/
    components/order-page.tsx           # status switch: pending / declined / confirmed, per-status <title>
    components/receipt-card.tsx         # Figma card (desktop) and full-width page (mobile)
    components/receipt-lines.tsx        # lines (table on desktop, stacked rows on mobile) and the totals
    components/receipt-states.tsx       # ReceiptSkeleton, OrderForbidden, ReceiptError
    model/receipt.ts                    # receiptView(order): pure view model (summary, lines, totals, note, explorer)
    model/format.ts                     # shortHash(), formatOrderDate()
```

`receipt-card.tsx` does no formatting or decision-making of its own: it renders what `receiptView(order)` returns, so the rules (discount row only when non-zero, note copy, short hash) are unit-tested in node (§8).

## 4. Data and status (RCPT-01 – RCPT-07)

- `beforeLoad`: spec 04 session guard (`requireAuth`), with `redirect` = current href.
- `loader`: `queryClient.query({ ...orderQueryOptions(orderId), staleTime: 'static' })`, the pattern of the details route: the cache (checkout seeds it) is used as is, otherwise the API is asked once with the query's own retries; the page's observer keeps it fresh afterwards.
  - `ApiError` `NOT_FOUND` → `throw notFound()` (the root's "Página não encontrada", URL unchanged).
  - `FORBIDDEN` → the loader returns `{ forbidden: true }` and the component renders `OrderForbidden` ("Você não tem acesso a este pedido." + "Voltar ao início"), no order data. Title "Pedido indisponível · KURIO".
  - other errors → `errorComponent` (`ReceiptError`): inline alert with "Tentar novamente" (`router.invalidate()`); a `NOT_FOUND` that shows up later (a refetch) gets the not-found view.
- `pendingComponent`: `ReceiptSkeleton` with the card's final dimensions (RCPT-04).
- `OrderPage` reads `useOrderStatus(orderId)` (spec 09), so a pending order keeps polling and listening to `order.updated`, and the same component switches in place:

  | `status` | Renders |
  |---|---|
  | `pending` | spec 09 `OrderPendingPanel` |
  | `declined` | spec 09 `OrderDeclinedPanel`; "Tentar novamente" goes to `/checkout`, "Voltar ao carrinho" to `/cart` (§11, 3) |
  | `confirmed` | `ReceiptCard` |
  | `error` (after data was shown) | the last order stays; only an initial failure shows `ReceiptError` |

- The network name comes from `NETWORK_LABELS` (the order carries the network id): the receipt never waits on a second request (§11, 1).
- Title, in the component: "Pedido confirmado · KURIO" when confirmed, "Pedido <id> · KURIO" otherwise (a component `<title>`, not route `head`, because it must follow the in-place status change).

## 5. Desktop receipt (from `lg`, Figma "Confirmação de Pedido")

Card `max-w-[580px]` centered, top margin per screens.md (166 from the top of the page, 40 below the header here):

1. **Header:** `ThankYouIcon` 80; `h1` "Seus NFTs agora estão na sua carteira" (bold 16 `text-secondary`); × close top-right (`aria-label="Fechar"`, link to `/`, 24 px, `primary`).
2. **Summary band** between two 1 px `primary` rules, four columns split by `primary` vertical rules, rendered as a `<dl>`:
   - "ID da transação": `shortHash(hash)` → `0x1a2b3c…9f0e`; the full hash in a `Tooltip` and in a visually hidden span.
   - "Data": `formatOrderDate(settledAt)`.
   - "Total": `formatEth(total)`.
   - "Carteira": provider label (MetaMask, WalletConnect, Coinbase Wallet).
3. **"Detalhes da transação"**: `<table>` with `<caption class="sr-only">`, headers "NFTs / Edições / Subtotal":
   - NFT cell: image 70 (snapshot `image`), name bold (plain text: the order is a snapshot, the NFT may no longer exist), "ID do token: <tokenId>" and "Edição: <label>" in `text-secondary`;
   - Edições cell: `(x N)`;
   - Subtotal cell: `lineTotal` in `accent` bold.
4. **Totals** (right-aligned rows, `<dl>`): "Subtotal", "Desconto (<code>)" only when `discount` is non-zero, "Taxa de rede", "Total" in `accent`. Rule below.
5. **Note** (`text-secondary`, centered): RCPT-10 copy with the network name.
6. **Actions:** primary "Ver no <explorerName>" as `<a target="_blank" rel="noopener noreferrer">` with a visually hidden "(abre em nova aba)"; caption below "Link de demonstração: o explorador é simulado." (11, `text-secondary`); text link "Continuar explorando" → `/`.
7. **Bottom bar:** 10 px `primary`.

Focus (RCPT-15): the `h1` is focusable (`tabIndex=-1`, no outline). It takes focus when the receipt appears after checkout's navigation (router `state.fromCheckout`) or when it replaces the processing panel in place; on direct access focus stays at the document start.

## 6. Mobile (below `lg`, no Figma frame)

Follows the inner-screen style of cart and checkout (spec 01 mobile shell, specs 07 and 09):
- Shell `inner` "Pedido" (spec 01): a back button and the title, no tab bar. The card loses its fill, width and × (the back button replaces it); content sits in the page's 24 px gutters.
- Header as desktop, illustration 64, heading centered.
- Summary band becomes a 2 × 2 grid (`ID da transação` / `Data`, `Total` / `Carteira`) with `primary` rules between rows and columns.
- Lines follow the mobile cart card pattern (spec 07): image 64 left, name, token id and edition, then `(x N)` and the line total on the right; table semantics are kept with `display` overrides, not by switching to a list.
- Totals and note as desktop.
- "Ver no <explorerName>": full-width gradient pill (`primary-soft`, 60 tall, radius 20) in a fixed bottom area with safe-area padding, the same pattern as checkout; "Continuar explorando" and the simulation caption sit above the lines' bottom padding. The page keeps the bar's height as bottom padding.
- Tablet (768) uses this composition, centered at `max-w-150` like the details page.

## 7. Formatting (`model/format.ts`)

- `shortHash('0x' + 64 hex)` → first 8 and last 4 characters joined by `…` (`0x1a2b3c…9f0e`); a value that is not longer than 14 characters comes back unchanged.
- `formatOrderDate(iso)` → `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })`, in the browser's time zone (E2E runs in `UTC`, spec 00).
- Provider label: `WALLET_PROVIDER_LABELS` (spec 02), no helper of our own.

## 8. Testing

Vitest runs in `node` (no DOM), so the component test planned in the draft is replaced by a pure view-model test plus E2E (§11, 2).

### Unit

| File | Proves |
|---|---|
| `features/receipt/model/format.test.ts` | `shortHash`; `formatOrderDate('2026-07-29T12:00:00Z')` in UTC → "29 de jul. de 2026" |
| `features/receipt/model/receipt.test.ts` | `receiptView` from an `Order`: lines and totals as strings, discount row hidden at `0` and shown with code when non-zero, note with the network name, explorer link data, provider label |

### E2E

| File · test | Proves |
|---|---|
| `purchase.spec.ts` · end of the full purchase (spec 09): receipt heading focused, band shows the short hash, total equals the quote total, items and fee, "Ver no Etherscan" href under `explorer.kurio.example` | RCPT-05, RCPT-08 – RCPT-11, RCPT-15 |
| `purchase.spec.ts` · after confirmation `updateNft` changes a bought item's price; reload and the cart-to-receipt amounts are unchanged | RCPT-12 |
| `receipt.spec.ts` · Ana opens `/orders/ord_000001` directly → receipt (discount row with code); `requests()` contains no `nfts.*` operation | RCPT-08 |
| `receipt.spec.ts` · `updateNft` raises the price of an `ord_000001` line, reload → same amounts | RCPT-12 |
| `receipt.spec.ts` · guest → login → back to the order; Bruno → "Você não tem acesso a este pedido." and no order data; `/orders/ord_999999` → "Página não encontrada" | RCPT-01 – RCPT-03 |
| `receipt.spec.ts` · `orders.get` 503 → inline error and "Tentar novamente" | RCPT-04 |
| `receipt.spec.ts` · Ana opens the pending `ord_000002` → processing panel; `settleOrder('ord_000002', 'confirmed')` → receipt in place without reload; a declined variant → declined panel with the message, "Tentar novamente" to `/checkout` and "Voltar ao carrinho" to `/cart` | RCPT-05 – RCPT-07 |
| `receipt.spec.ts` · mobile project: no horizontal scroll at 390, explorer action in the fixed bottom area; axe zero serious or critical (both projects) | RCPT-13, RCPT-14, RCPT-15 |
| `receipt.spec.ts` · × and "Continuar explorando" go to `/` | RCPT-16 |

## 9. Figma references

- Desktop: `figma_tokens/screenshots/desktop/Confirmação de Pedido.png`; notes in `figma_tokens/screens.md` § Order confirmation.
- Mobile: none.

## 10. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Page, not modal:** the Figma modal is rendered as a centered card on a routed page with the app shell (§2), like login and sign-up (spec 04). Reason: direct access, refresh and recovery (brief §3.3, §4).
- **Transaction id:** Figma shows a wallet-like value (`0xA91F…E82C`); the receipt shows the shortened simulated transaction hash.
- **Date:** pt-BR `Intl` format instead of Figma's "29 Jul, 2026".
- **Subtotal and discount rows** added to the totals; the edition label added under the token id.
- **Explorer link** points to a reserved, non-resolving domain (`explorer.kurio.example`) and says so on the page.
- **Mobile layout** is a proposal (§6), no frame.
- **Pending and declined** orders at this route reuse spec 09's panels; confirmation is shown only for `confirmed` (brief §3.3).

## 11. Implementation decisions (2026-10-28)

Decisions taken while finalizing and implementing, where the draft was silent or had to give way to what the code showed.

1. **Network name from `NETWORK_LABELS`**, not from a `networks.list` read: the receipt is built from the order alone (RCPT-08), so it needs no second request and cannot be delayed or broken by one.
2. **No DOM test environment** (as in spec 09): the draft's `receipt-card.test.tsx` becomes `receipt.test.ts`, a pure view model, and the UI is proved by E2E.
3. **Declined at this route:** the panel's "Tentar novamente" navigates to `/checkout`; the order is terminal, so checkout's own flow (spec 09 §14.14) offers the new attempt, and "Voltar ao carrinho" goes to `/cart`. Checkout reopens its form or its own declined panel from the stored attempt, so this page keeps no checkout internals.
4. **Title from the component**, because a route `head` is computed from loader data and would stay stale after the in-place status change.
5. **Focus** moves to the `h1` only when the receipt appears after an event (checkout navigation or in-place settle), never on direct access.
6. **Forbidden is a loader result, not an error**, so the 403 view needs no error boundary and the `FORBIDDEN` response never reaches the receipt component.
7. **Checkout hand-off:** `tracked-order.tsx` (spec 09) navigates with `state: CHECKOUT_ARRIVAL` (`features/receipt/model/arrival.ts`, which also augments the router's `HistoryState`). A reload keeps the history state, so the heading takes focus again after a refresh of that entry; harmless.
8. **Band sizes:** the summary band uses the 12 px caption and the column ratio `1.2fr 1.4fr 1fr 1fr`, because the pt-BR date ("20 de set. de 2026") is longer than Figma's "29 Jul, 2026" and would wrap at 145 px per column.
9. **Line labels:** the quantity and subtotal cells carry a visually hidden "Quantidade:" / "Subtotal:" below `lg`, where the column headers are hidden for readers only; from `lg` the headers name the cells.

**Visual check (2026-10-28, browser, against `figma_tokens/screenshots/desktop/Confirmação de Pedido.png`):** at 1440 the card (580 wide, centered), illustration, heading, band with rules, table, totals, note, primary button and bottom bar match. Differences: the shell header above the card (page, not modal), the added "Subtotal" / "Desconto" rows, the edition line, the 12 px band text, the simulated-explorer caption and "Continuar explorando". Mobile 390 has no frame; checked for no overflow and the fixed bottom action.
