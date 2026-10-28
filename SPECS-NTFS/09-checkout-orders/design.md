# 09 — Checkout & orders · Design

> Status: Ready for review

Implements [`requirements.md`](requirements.md). Contracts, operations, error codes, fixtures and scenarios are spec 02's; nothing here adds an endpoint.

## 1. Dependencies

No new packages. Forms use the spec 01 components (`Input`, `Field`, `Select`, `RadioGroup`, `Checkbox`, `Dialog`, `Sheet`, `Alert`, `Breadcrumb`, `DropdownMenu`, `Button loading`) and Zod schemas from `src/contracts`. Form state is plain React state plus a small reducer (§4); no form library is added.

**Spec 01 amendment:** add the shadcn `textarea` component (restyled like `Input`, shown in the gallery) for "Observação do colecionador". The spec 01 inventory has no multi-line field.

## 2. Layout

```
src/
  routes/checkout.tsx                  # beforeLoad: require session (spec 04); loader prefetches; renders <CheckoutPage>
  features/checkout/
    api/checkout-queries.ts            # networks, wallets, walletConnections, profile query options (reuse owners' factories)
    api/use-connect-wallet.ts          # connect/disconnect mutations
    api/use-create-order.ts            # orders.create + attempt handling (§6)
    model/form.ts                      # CheckoutDraft, prefill(), reducer, toCreateOrderBody()
    model/attempt-store.ts             # localStorage attempt (§6)
    model/draft-store.ts               # sessionStorage draft (CHK-09)
    model/quote-review.ts              # diffQuotes(), review state machine (§5)
    components/checkout-page.tsx       # empty/no-wallet/pending gates, then desktop or mobile composition
    components/collector-form.tsx
    components/wallet-picker.tsx       # desktop toggle + mobile cards
    components/provider-picker.tsx
    components/checkout-summary.tsx    # "Seus NFTs" lines + totals from the quote
    components/review-dialog.tsx       # review, connect, pay, processing, declined
  features/orders/
    api/order-queries.ts               # orderKeys, orderQuery(id), pendingOrdersQuery()
    api/use-order-status.ts            # realtime + polling tracking (§7); reused by spec 10
    components/order-pending-panel.tsx # "Processando pagamento"; reused by spec 10
    components/order-declined-panel.tsx# "Pagamento recusado"; reused by spec 10
```

Spec 10 owns `routes/orders/$orderId.tsx` and the receipt; it imports `features/orders/*`.

## 3. Route and data loading

- `beforeLoad`: spec 04's session guard (`redirect=/checkout`).
- `loader` (non-blocking for the UI, `ensureQueryData` in parallel): cart (spec 07 query options), profile (spec 08), wallets (spec 08), `networks.list`, `walletConnections.list`, `pendingOrdersQuery()` (`orders.list?status=pending`).
- `pendingComponent`: the checkout skeleton (form fields, summary rows, wallet cards) so the page has its final geometry from the first paint (CHK-04).
- Each region renders its own error with "Tentar novamente" (`refetch`); a failed `networks.list` disables the "Rede" select only.

Gate order in `CheckoutPage` (first match wins):
1. a pending order exists (from the pending query or a resolved attempt, §6) → `OrderPendingPanel` (CHK-30);
2. empty cart → empty state (CHK-02);
3. no wallets → no-wallet state (CHK-03);
4. otherwise → the form.

### Query keys

| Data | Key | Owner | Notes |
|---|---|---|---|
| Quote | spec 07's quote factory with `network` | 07 | `staleTime: 0` in checkout; refetch on window focus |
| Order | `['orders', 'detail', orderId]` | 09 | `refetchInterval` while pending (§7) |
| Pending orders | `['orders', 'list', { status: 'pending' }]` | 09 | |
| Networks | `['networks']` | 09 | `staleTime: Infinity` (static fixture) |
| Wallet connections | `['wallet-connections']` | 09 | |

Every private key is cleared by spec 04 on logout and user switch.

## 4. Form model (`model/form.ts`)

```ts
interface CheckoutDraft {
  walletId: WalletId
  provider: WalletProvider
  network: NetworkId
  collector: CollectorDetails          // walletAddress mirrors the wallet, read-only
  note: string
  touched: ReadonlySet<keyof CollectorDetails | 'note'>   // fields the user edited
}
```

- **Prefill (CHK-06):** `prefill(profile, wallet)` maps:
  - profile → `displayName`, `username`, `email`, `ensName`;
  - wallet → `profileName`, `walletAddress` (= `address`), `alternateWallet`, `referralCode`, `provider`, `network`.

  A refetch or wallet switch reapplies prefill only to fields not in `touched`; a wallet switch always replaces `walletAddress`.
- **Default wallet:** primary if present, otherwise secondary.
- **Validation (CHK-07):** `CollectorDetails.extend({ note: z.string().max(500) })` from `src/contracts`. Errors render with the spec 01 field pattern (`aria-invalid`, `aria-describedby`); first invalid field gets focus.
- **API errors (CHK-08):** `fields` keys `collector.<f>` map to `<f>`; `note` maps to the textarea; any other key goes into the form alert.
- **Draft (CHK-09):** `sessionStorage['kurio.checkout.draft.<userId>']`, written on change (debounced 300 ms), read before prefill, removed when an order is created. Wrapped in try/catch; a missing storage only loses the draft.
- **Body:** `toCreateOrderBody(draft, quoteId)` builds `CreateOrderBody`; `note` omitted when blank.

### Field mapping to Figma

| Figma field | Draft field | Control |
|---|---|---|
| Nome de exibição* | `collector.displayName` | `Input` |
| Nome de usuário* | `collector.username` | `Input` |
| Rede* | `network` | `Select`, options filtered by wallet family (CHK-11) |
| Nome do perfil* | `collector.profileName` | `Input` |
| Endereço da carteira* | `collector.walletAddress` | `Input readOnly`, from the wallet (CHK-10) |
| ENS ou carteira secundária (opcional) | `collector.alternateWallet` | `Input` |
| Tipo de carteira* | `provider` | `Select`, mirrors the provider radio list (open question 1) |
| Código de indicação* | `collector.referralCode` | `Input`, upper-cased on blur |
| E-mail* | `collector.email` | `Input type="email"` |
| Nome ENS* | `collector.ensName` | spec 08's ENS field (name input + static `.eth` suffix) |
| Usar outra carteira? | `walletId` | `Checkbox` styled as the Figma radio; checked = secondary (open question 2) |
| Observação do colecionador (opcional) | `note` | `Textarea`, counter at 400+ |

## 5. Review step (`review-dialog.tsx`, `model/quote-review.ts`)

The review is a spec 01 `Dialog` from `lg`, a bottom `Sheet` (full height) below it, titled "Revise seu pedido". It is a small state machine:

```
reviewing ──pay──▶ submitting ──201/200 pending──▶ processing ──confirmed──▶ navigate /orders/$id
   ▲  │                │                                  └──declined──▶ declined ──retry──▶ reviewing (new attempt)
   │  └─quote id changed─▶ changed ──"Aceitar novos valores"──┘
   │                     submitting ──409 QUOTE_CHANGED──▶ changed
   │                     submitting ──timeout/network──▶ unknown ──"Tentar novamente"──▶ submitting (same key)
   └─────────────────────submitting ──409 WALLET_NOT_CONNECTED / WALLET_REJECTED──▶ reviewing (connection reset)
```

**Content:**
- Lines (image, name, edition label, `(x N)`, line total), subtotal, discount (with coupon code), "Taxa de rede", total — all from the quote.
- Wallet nickname + short address (`0xA91F…E82C`), network name, provider.
- Connection row: "Carteira desconectada" + "Conectar <Provider>" button, or "Conectada" + "Desconectar" link (CHK-14 – CHK-17). While connecting, the button is `loading` with "Conectando…" (delay from the scenario, 600 ms by default).
- Pay button "Confirmar pagamento", disabled until connected and the quote is `purchasable`.

**Quote freshness (CHK-18 – CHK-20):**
- Opening the dialog calls `refetch()` on the quote and shows a skeleton for the amounts until it resolves; that quote becomes `acceptedQuote`.
- While open, the spec 03 event hook for `nft.updated` invalidates the quote when `event.resource.id` is in the quote lines; a cart version change does the same.
- When the current quote's `id ≠ acceptedQuote.id`, state goes to `changed`:
  - `diffQuotes(old, new)` marks changed lines and totals; changed cells show old value struck through and the new one in `accent`;
  - an `Alert` "Os valores do pedido mudaram. Confira antes de pagar." and `announce(…, 'assertive')`;
  - the pay button is replaced by "Aceitar novos valores"; activating it sets `acceptedQuote = current` and returns to `reviewing`.
- `QUOTE_CHANGED` from `orders.create` puts `details.quote` into the quote cache (`setQueryData`) and goes to `changed` the same way.
- Blocking issues or `INSUFFICIENT_AVAILABILITY` (CHK-21): an `Alert` listing the affected lines by name and edition, pay disabled, "Voltar ao carrinho" link. The quote cache is invalidated so the cart shows the same state.

**Focus:** opening focuses the dialog title; `changed` moves focus to the alert; closing returns focus to "Confirmar compra". While `submitting` or `processing`, `Esc` and outside click do not close the dialog (the order must not be orphaned visually); `processing` offers "Fechar" which leaves the page in the pending gate (§3).

## 6. Idempotent creation (`use-create-order.ts`, `attempt-store.ts`)

```ts
interface CheckoutAttempt {
  userId: UserId
  key: string                 // crypto.randomUUID(), 36 chars [0-9a-f-]
  body: CreateOrderBody
  fingerprint: string         // canonical JSON of body
  orderId: OrderId | null     // known once a response arrived
  createdAt: number
}
```

- **Storage:** `localStorage['kurio.checkout.attempt.<userId>']`, written **before** the request is sent, so a refresh during the request still knows the key (CHK-26). Spec 04's logout clears it with the other private keys.
- **Key rule (CHK-23):** `pay()` compares `canonicalJson(body)` with the stored attempt. Same → reuse the key. Different (new quote id, other wallet, edited field) and no `orderId` → new key, overwrite. Different with an `orderId` of a non-terminal order cannot happen, because the pending gate hides the form.
- **In-flight guard (CHK-24):** the mutation's `isPending` disables the button, and a module-level `inFlight` ref short-circuits a second call in the same tick (double click before React re-renders).
- **Responses:**

  | Response | Action |
  |---|---|
  | 201 / 200 `Order` | store `orderId`; clear the draft; seed `['orders','detail',id]`; go to `processing` (or straight to the terminal handling if a replay returns a settled order) |
  | 409 `QUOTE_CHANGED` | §5 `changed`; attempt kept (its body will change, so the next pay uses a new key) |
  | 409 `INSUFFICIENT_AVAILABILITY` | §5 blocking alert |
  | 409 `ORDER_PENDING` / `IDEMPOTENCY_CONFLICT` | track `details.orderId` (CHK-27) |
  | 409 `WALLET_NOT_CONNECTED` | mark connection disconnected, invalidate `['wallet-connections']`, message "Sua carteira foi desconectada. Conecte novamente para pagar." |
  | 422 `VALIDATION_FAILED` | close the dialog, map fields (CHK-08) |
  | `timeout` / `network` | `unknown` state: "Não conseguimos confirmar se o pedido foi criado." + "Tentar novamente" (same key and body, CHK-25) |
  | 401 `SESSION_EXPIRED` | spec 04 flow; draft and attempt stay (CHK-28) |
  | other | form alert with the envelope message; attempt kept |

- **Recovery on load (CHK-26, CHK-30):** if an attempt exists for the user:
  - with `orderId` → track that order;
  - without `orderId` → replay `orders.create` once with the stored key and body ("Verificando seu pedido anterior…"). 200/201 → track it. `QUOTE_CHANGED`, `INSUFFICIENT_AVAILABILITY` or 422 → the order was never created; drop the attempt and show the form. Network failure → keep the attempt and show the `unknown` state on the page.
- **Clearing:** when the tracked order reaches a terminal state and has been handled (navigation or declined panel shown).

## 7. Order tracking (`features/orders/api/use-order-status.ts`)

```ts
function useOrderStatus(orderId: OrderId): { order: Order | undefined; status: 'loading' | Order['status'] | 'error' }
```

- Query `['orders','detail',orderId]` with `refetchInterval: (q) => q.state.data?.status === 'pending' ? 5000 : false`. The interval is the fallback when no event arrives (socket down, event lost); settlement in the mock is lazy, so any request also advances it.
- Spec 03's `order.updated` subscription updates this key through its version guard; this hook only reads the cache (CHK-33).
- Spec 03's reconnection reconciliation invalidates `['orders']`, which covers "settled while disconnected".
- On the transition to `confirmed`: invalidate spec 07's cart key and `['orders']`, then `navigate({ to: '/orders/$orderId', params, replace: true })` (CHK-31). The cart then reflects the server's per-line decrement (CHK-34).
- On `declined`: `OrderDeclinedPanel` with `declineReason.message`, "Tentar novamente" (clears the attempt and reopens `reviewing` with a fresh quote and a new key) and "Voltar ao carrinho" (CHK-32). The cart query is invalidated to pick up released availability.
- `OrderPendingPanel`: a `surface-card` panel with the spinner icon, "Processando pagamento", "Pedido <id> · aguardando confirmação da rede <network>", polite announcement once on mount.

## 8. Desktop composition (from `lg`, Figma "Pagamento")

- Breadcrumb "Início / Mercado / Pagamento" (spec 01 `Breadcrumb`), header nav `market`.
- Two columns: form (2 × 370 field grid, gap per screens.md) and right column ~405:
  - "Seus NFTs" with header "NFTs / Subtotal", rows from the quote lines (cart line image, name, "ID do token: #…", `(x N)`, line total in `accent`);
  - "Tem um código promocional? Aplique aqui" → reveals spec 07's coupon field inline;
  - Subtotal / Desconto do lançamento / Taxa de rede + "Taxa estimada" / Total;
  - "Carteira e rede": compatible-wallets chip as caption (open question 5), then a `RadioGroup` of WalletConnect, MetaMask, Coinbase Wallet as 405 × 45 bordered cards;
  - "Confirmar compra" 405 × 44 primary — validates the form, then opens the review.
- Footer as in spec 01.

## 9. Mobile composition (below `lg`, Figma "Pagamento com carteira")

- Shell `inner` "Pagamento com carteira" (spec 01), no tab bar.
- "Carteira conectada" + link "Trocar carteira" (→ `/wallets`).
- Wallet cards as a `RadioGroup` (title = `nickname`, line 2 = ENS or short address, line 3 = "Rede <network name>", `MoreVerticalIcon` menu with "Editar carteira" → `/wallets`).
- "Carteira e rede": provider rows with the 40 circle avatars (W, M, wallet icon) as a `RadioGroup`.
- Collapsed "Dados do colecionador" (`<details>`-like disclosure button with `aria-expanded`): the full form of §4 in one column, including "Rede". Opens automatically and focuses the first invalid field when validation fails (open question 3).
- "Total: <total>" from the quote; fixed bottom area with the gradient "Confirmar compra" pill and safe-area padding.
- Tablet (768) uses this composition, as decided for the shell.

## 10. Accessibility

- Wallets and providers are `RadioGroup`s with visible labels ("Carteira", "Carteira e rede"); arrow keys move selection.
- Required marker "*" is `aria-hidden`; inputs carry `required` / `aria-required`.
- One channel per event (spec 01 rule): quote change → assertive announce (inline alert visible); connection result → polite announce; order confirmed → navigation (receipt `h1` gets focus, spec 10); declined → assertive announce with the panel visible; wallet rejected → inline alert, no toast.
- The review dialog always has a `DialogTitle`; the processing state keeps it ("Processando pagamento").

## 11. Testing

### Unit (Vitest)

| File | Proves |
|---|---|
| `features/checkout/model/form.test.ts` | Prefill from Ana's fixtures; touched fields survive re-prefill; wallet switch replaces address; body omits blank note; API `fields` mapping |
| `features/checkout/model/attempt-store.test.ts` | Same body → same key; changed body → new key; attempt written before send; per-user keys |
| `features/checkout/model/quote-review.test.ts` | `diffQuotes` marks changed lines and totals; state machine transitions of §5 including `changed` → accept → `reviewing` |

### Component (Vitest + Testing Library + `msw/node`, `*.test.tsx`)

| File | Proves |
|---|---|
| `review-dialog.test.tsx` | Pay disabled until connected; `wallet-reject` → message and retry; double click sends one `orders.create` (request log) |

### E2E (both projects; helpers from spec 02 `e2e/support/mock.ts`, spec 04 `loginAs` UI helper)

| File · test | Proves |
|---|---|
| `purchase.spec.ts` · catalog → details → add → cart → checkout (Ana) → connect → pay → processing → receipt | CHK-05, CHK-06, CHK-14, CHK-18, CHK-29, CHK-31 (with spec 10) |
| `purchase.spec.ts` · after confirmation the cart holds only lines added while pending (`payment-manual`, add `golden-signal-160` via `apiFetch`, then `settleOrder`) | CHK-34 |
| `purchase.spec.ts` · guest at `/checkout` → login → back at checkout; Carla → no-wallet state; empty cart state | CHK-01 – CHK-03 |
| `checkout-failures.spec.ts` · `payment-declined` → "Pagamento recusado", cart unchanged; `configure({ payment: { outcome: 'confirm' } })` → "Tentar novamente" → confirmed | CHK-32 |
| `checkout-failures.spec.ts` · triple click on "Confirmar pagamento" → one `orders.create` in `requests()`, one order in `snapshot()` | CHK-24 |
| `checkout-failures.spec.ts` · `order-timeout` with `page.clock`: advance past `VITE_API_TIMEOUT_MS` → unknown state → "Tentar novamente" → same order id, one order | CHK-25 |
| `checkout-failures.spec.ts` · `order-timeout`, reload during the hang → "Verificando seu pedido anterior…" → pending of the same order | CHK-26 |
| `checkout-failures.spec.ts` · `wallet-reject` → message; `disconnectWallet()` before pay → reconnect prompt; invalid referral code → field error and focus; draft survives reload | CHK-07, CHK-09, CHK-15, CHK-16 |
| `checkout-failures.spec.ts` · `session-short` / `expireSessions()` during review → login → back with draft → pay succeeds | CHK-28 |
| `realtime-checkout.spec.ts` · review open, `updateNft('emerald-ape-042', { price: '1.29' })` → highlighted change, "Aceitar novos valores" required, order total equals the new quote | CHK-19, CHK-20 |
| `realtime-checkout.spec.ts` · `price-change-on-checkout` → 409 path to `changed`; `sold-out-on-checkout` → blocking alert, "Voltar ao carrinho" | CHK-20, CHK-21 |
| `realtime-checkout.spec.ts` · change network to Polygon → fee 0.002 and total from the quote | CHK-11, CHK-12 |
| `realtime-resilience.spec.ts` · `payment-manual` → pending; reload → pending panel, no second order; socket down (spec 03 helper) → `settleOrder` → reconnect → receipt | CHK-29, CHK-30, CHK-33 |
| `a11y` check (spec 01 axe helper) on the form, the review dialog and the processing state | CHK-36 |

## 12. Figma references

- Desktop: `figma_tokens/screenshots/desktop/Pagamento.png`; notes in `figma_tokens/screens.md` § Checkout.
- Mobile: `figma_tokens/screenshots/mobile/Pagamento.png`.
- No frame for the review step, the processing and declined states, or errors.

## 13. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Review step is a dialog/sheet** not drawn in Figma (open question 4).
- **One provider value, two desktop controls** ("Tipo de carteira" select mirrors the "Carteira e rede" radio list); the "METAMASK • WALLETCONNECT • COINBASE" option is a caption; WalletConnect is listed on desktop too, as on mobile.
- **Wallet address is read-only** in checkout: payments use registered wallets only (brief §3.3).
- **Mobile collector form** is a collapsed section not present in the mobile frame.
- **Mobile wallet line 3** is "Rede <name>" for both wallets (Figma writes "Rede principal Ethereum" on one).
- **Idempotency key lifecycle:** one key per attempt, persisted before sending, replayed after refresh; `ARCHITECTURE.md` explains why a timeout never creates a second order.
- **Pending tracking uses events plus 5 s polling** as a fallback; the poll stops at a terminal state.
- **Checkout draft in `sessionStorage`, attempt in `localStorage`**, both per user and cleared on logout; they hold collector details of fictitious users only.
