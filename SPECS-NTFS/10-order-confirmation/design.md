# 10 — Order confirmation · Design

> Status: Draft — see Open questions in requirements.md

Implements [`requirements.md`](requirements.md). Uses spec 02's `orders.get`, `Order` and `networks.list`, and spec 09's `features/orders/` (query options, `useOrderStatus`, pending and declined panels). No new endpoint or field.

## 1. Dependencies

None new. Uses spec 01's `ThankYouIcon` (80), `Button`, `Tooltip`, `Separator`, `Skeleton`, `Alert`, and spec 02's `formatEth`.

## 2. Route vs modal (open question 1)

`/orders/$orderId` is a page that renders the Figma modal as a centered card, inside the normal app shell.

Why not a `Dialog`:
- The receipt must be reachable by direct access and after refresh (brief §4); a dialog needs a background page that does not exist in Figma (empty `ink` page).
- A modal traps focus and hides the rest of the page from assistive technology while offering nothing behind it; a page keeps the header and footer navigation.
- Spec 01 already declares the shell config for this route (`nav: market`, mobile `inner` "Pedido").

The card keeps the Figma dialog styling (spec 01 "Dialog pattern": `surface-card`, × close in `primary` at top-right, 10 px `primary` bar along the bottom). Deviation recorded in §9.

## 3. Layout

```
src/
  routes/orders/$orderId.tsx            # beforeLoad: spec 04 guard; loader: ensureQueryData(orderQuery(id)); errorComponent maps 404/403
  features/receipt/
    components/order-page.tsx           # status switch: pending / declined / confirmed
    components/receipt-card.tsx         # Figma card
    components/receipt-summary-band.tsx # ID da transação / Data / Total / Carteira
    components/receipt-lines.tsx        # table of lines + totals
    components/receipt-skeleton.tsx
    model/format.ts                     # shortHash(), formatOrderDate(), providerLabel()
```

## 4. Data and status (RCPT-01 – RCPT-07)

- `beforeLoad`: spec 04 session guard with `redirect` = current href.
- `loader`: `queryClient.ensureQueryData(orderQuery(orderId))`.
  - `ApiError` 404 → `throw notFound()` (spec 00 view).
  - 403 → render `OrderForbidden` ("Você não tem acesso a este pedido." + "Voltar ao início"); title "Pedido indisponível · KURIO".
  - other errors → `errorComponent` with "Tentar novamente" (`router.invalidate()`).
- `pendingComponent`: `ReceiptSkeleton` with the card's final dimensions (RCPT-04).
- `OrderPage` reads `useOrderStatus(orderId)` (spec 09), so a pending order keeps polling and listening to `order.updated`, and the same component switches in place:

  | `status` | Renders |
  |---|---|
  | `pending` | spec 09 `OrderPendingPanel` |
  | `declined` | spec 09 `OrderDeclinedPanel` with "Voltar ao carrinho" and "Ir para o pagamento" |
  | `confirmed` | `ReceiptCard` |

- `networks.list` (cached, `staleTime: Infinity`) supplies the network display name for the note; if it is unavailable, the network id capitalized is used, so the receipt never waits on it.
- Title: "Pedido confirmado · KURIO" when confirmed, "Pedido <id> · KURIO" otherwise.

## 5. Desktop receipt (from `lg`, Figma "Confirmação de Pedido")

Card `max-w-[580px]` centered, top margin per screens.md:

1. **Header:** `ThankYouIcon` 80; `h1` "Seus NFTs agora estão na sua carteira" (bold 16 `text-secondary`) — the visible heading is the Figma text, `h1` semantics; × close top-right (`aria-label="Fechar"`, navigates to `/`).
2. **Summary band** between two 1 px `primary` rules, four columns split by `primary` vertical rules, rendered as a `<dl>`:
   - "ID da transação": `shortHash(hash)` → `0x1a2b…9f0e`; the full hash in a `Tooltip` and in a visually hidden span.
   - "Data": `formatOrderDate(settledAt)`.
   - "Total": `formatEth(total)`.
   - "Carteira": provider label (MetaMask, WalletConnect, Coinbase Wallet).
3. **"Detalhes da transação"**: `<table>` with `<caption class="sr-only">`, headers "NFTs / Edições / Subtotal":
   - NFT cell: image 70 (snapshot `image`, smallest `srcSet` variant), name bold, "ID do token: #<tokenId>" and the edition label in `text-secondary`;
   - Edições cell: `(x N)`;
   - Subtotal cell: `lineTotal` in `accent` bold.
4. **Totals** (right-aligned rows): "Subtotal", "Desconto (<code>)" only when `discount` is non-zero, "Taxa de rede", "Total" in `accent`. Rule below.
5. **Note** (`text-secondary`, centered): RCPT-10 copy with the network name.
6. **Actions:** primary "Ver no <explorerName>" as `<a target="_blank" rel="noopener noreferrer">` with a visually hidden "(abre em nova aba)"; caption below "Link de demonstração: o explorador é simulado." (11, `text-secondary`); text link "Continuar explorando" → `/`.
7. **Bottom bar:** 10 px `primary`.

Focus (RCPT-15): when the route is entered from spec 09's navigation (`replace` with `state.fromCheckout`), focus moves to the `h1` after render; on direct access focus stays at the document start.

## 6. Mobile proposal (below `lg`, no Figma frame)

- Shell `inner` "Pedido" (spec 01), no tab bar; the card becomes full width without outer margins, keeping the × only on desktop (the top bar's back button replaces it).
- Header as desktop, illustration 64.
- Summary band becomes a 2 × 2 grid (`ID da transação` / `Data`, `Total` / `Carteira`) with `primary` rules between rows and columns.
- Lines follow the mobile cart card pattern (spec 07): image 64 left, name, token id and edition, `(x N)` and line total right-aligned below the name; the table semantics are kept with `display` overrides, not by switching to a list.
- Totals and note as desktop.
- "Ver no <explorerName>" full-width gradient pill in the fixed bottom area with safe-area padding (same pattern as the other inner screens); "Continuar explorando" above it.
- Tablet (768) uses this composition.

## 7. Formatting (`model/format.ts`)

- `shortHash('0x' + 64 hex)` → first 6 and last 4 characters joined by `…`.
- `formatOrderDate(iso)` → `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })`, in the browser's time zone (E2E runs in `UTC`, spec 00).
- `providerLabel(provider)` → the spec 02 labels.

## 8. Testing

### Unit

| File | Proves |
|---|---|
| `features/receipt/model/format.test.ts` | `shortHash`; `formatOrderDate('2026-07-29T12:00:00Z')` in UTC → "29 de jul. de 2026"; provider labels |
| `features/receipt/components/receipt-card.test.tsx` | Renders only from an `Order` fixture: lines, discount row hidden at `0`, shown with code when non-zero; explorer link `href`, `target`, simulated caption |

### E2E

| File · test | Proves |
|---|---|
| `purchase.spec.ts` · end of the full purchase (spec 09): receipt heading focused, band shows the short hash, total equals the quote total, "Ver no Etherscan" href under `explorer.kurio.example` | RCPT-05, RCPT-08 – RCPT-11, RCPT-15 |
| `receipt.spec.ts` · Ana opens `/orders/ord_000001` directly → receipt; `requests()` contains no `nfts.*` operation | RCPT-08 |
| `receipt.spec.ts` · `updateNft` raises the price of an `ord_000001` line, reload → same amounts | RCPT-12 |
| `receipt.spec.ts` · guest → login → back to the order; Bruno → "Você não tem acesso a este pedido."; `/orders/ord_999999` → "Página não encontrada" | RCPT-01 – RCPT-03 |
| `receipt.spec.ts` · `pending-order` scenario, Ana opens `ord_000002` → processing panel; `settleOrder('ord_000002', 'confirmed')` → receipt in place without reload; `settleOrder(…, 'declined')` variant → declined panel | RCPT-06, RCPT-07 |
| `receipt.spec.ts` · mobile project: no horizontal scroll at 390 (`scrollWidth ≤ clientWidth`), explorer action in the bottom area; axe zero serious or critical | RCPT-13, RCPT-14, RCPT-15 |
| `receipt.spec.ts` · × and "Continuar explorando" go to `/` | RCPT-16 |

## 9. Figma references

- Desktop: `figma_tokens/screenshots/desktop/Confirmação de Pedido.png`; notes in `figma_tokens/screens.md` § Order confirmation.
- Mobile: none.

## 10. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Page, not modal:** the Figma modal is rendered as a centered card on a routed page with the shell (§2).
- **Transaction id:** Figma shows a wallet-like value (`0xA91F…E82C`); the receipt shows the shortened simulated transaction hash.
- **Date:** pt-BR `Intl` format instead of Figma's "29 Jul, 2026".
- **Subtotal and discount rows** added to the totals; edition label added under the token id.
- **Explorer link** points to a reserved, non-resolving domain and says so on the page.
- **Mobile layout** is a proposal (§6), no frame.
- **Pending and declined** orders at this route reuse spec 09's panels; confirmation is shown only for `confirmed` (brief §3.3).
