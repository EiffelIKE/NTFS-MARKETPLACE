# 10 — Order confirmation · Requirements

> Status: Final (2026-10-28) — decisions in the Decisions section

Show the receipt of a confirmed order at `/orders/$orderId`. The receipt is rendered only from the order snapshot returned by `orders.get`, so later catalog changes never alter it. It shows the result, simulated transaction id, date, total, wallet, purchased lines, network fee and an explorer link that opens a simulated block explorer inside the app (amendment, 2026-10-28). Pending and declined orders reuse spec 09's panels; confirmation is never shown for an order the simulation has not confirmed.

Brief coverage: §3 (Order confirmation screen, mobile without frame), §3.3 (confirmation only for confirmed orders; receipt from the snapshot; simulated references), §4 (direct access, per-user isolation), §9 scenario 6 (with spec 09).

## User stories

- **US-1** — As a collector, after paying I see a receipt that tells me the purchase is done and lists what I bought and what I paid.
- **US-2** — As a collector, I can open the receipt again later by its address, and its amounts are the ones I paid even if prices changed since.
- **US-3** — As a collector, if I open an order that is still processing or was declined, I see that state, not a receipt.
- **US-4** — As a collector, nobody else can see my receipt.

## Acceptance criteria

### Access

- **RCPT-01** — WHEN a visitor without a session opens `/orders/$orderId`, THE SYSTEM SHALL follow spec 04's login redirect and return to the same order.
- **RCPT-02** — WHEN `orders.get` answers 404, THE SYSTEM SHALL render the not-found view (spec 00) with the URL unchanged.
- **RCPT-03** — WHEN `orders.get` answers 403, THE SYSTEM SHALL render "Você não tem acesso a este pedido." with a link to the catalog, and SHALL NOT render any order data.
- **RCPT-04** — WHILE the order loads, THE SYSTEM SHALL show a receipt-shaped skeleton; WHEN the request fails for another reason, THE SYSTEM SHALL show an inline error with "Tentar novamente".

### Status

- **RCPT-05** — THE SYSTEM SHALL render the receipt only WHEN the order's `status` is `confirmed`.
- **RCPT-06** — WHEN the order is `pending`, THE SYSTEM SHALL render spec 09's processing panel and track the order (events plus polling); WHEN it becomes `confirmed`, THE SYSTEM SHALL replace the panel by the receipt in place.
- **RCPT-07** — WHEN the order is `declined`, THE SYSTEM SHALL render spec 09's declined panel with `declineReason.message`, "Tentar novamente" (back to the payment screen) and "Voltar ao carrinho".

### Receipt content

- **RCPT-08** — THE SYSTEM SHALL render the receipt from the `Order` response only: lines (image, name, token id, edition label, quantity, line total), subtotal, discount when non-zero, network fee and total, all formatted with spec 02's `formatEth`. It SHALL NOT request catalog data to render it.
- **RCPT-09** — THE SYSTEM SHALL show the summary band with "ID da transação" (shortened hash, full hash available to assistive technology and as a tooltip), "Data" (`settledAt`, pt-BR date), "Total" and "Carteira" (provider label).
- **RCPT-10** — THE SYSTEM SHALL show the note "Transação confirmada na <network name>. A propriedade foi transferida para sua carteira conectada e registrada na rede." using the order's network.
- **RCPT-11** — THE SYSTEM SHALL render "Ver no <explorerName>" as a link to `transaction.explorerUrl`, which is an in-app path (`/explorer/<network>/tx/<hash>`). It opens in the same tab through the router, with text stating that the explorer is simulated. An address outside the app keeps opening in a new tab, announced in the link's accessible name.

_Amended 2026-10-28: it was an external link to a reserved domain that does not resolve, which opened a browser error page._
- **RCPT-12** — WHEN catalog prices or availability change after the order was confirmed, THE SYSTEM SHALL show the same amounts on every later visit.

### Simulated explorer (amendment, 2026-10-28)

- **RCPT-17** — THE SYSTEM SHALL serve a public page at `/explorer/$network/tx/$txHash` (no session needed) that renders, from `explorer.getTransaction` only: hash, network and explorer name, status, block number, date and time, the payer address ("De"), a fictitious marketplace contract ("Para"), value and network fee as decimal-string ETH, and the transferred items (name, token id, edition, quantity).
- **RCPT-18** — THE SYSTEM SHALL NOT show or return the collector's name, e-mail, profile data, wallet nickname, order id, coupon or any other private data on that page or in that response.
- **RCPT-19** — THE SYSTEM SHALL show on the page, always, the banner "Explorador simulado — ambiente de demonstração".
- **RCPT-20** — WHEN the hash is unknown, belongs to another network, or the network does not exist, THE SYSTEM SHALL render a not-found state with the URL unchanged; WHEN the request fails for another reason, an inline error with "Tentar novamente".
- **RCPT-21** — THE SYSTEM SHALL keep the page usable by direct access and after a refresh, and without horizontal scroll at 390, 768 and 1440 px.

### Layout and accessibility

- **RCPT-13** — THE SYSTEM SHALL render, from `lg`, the Figma "Confirmação de Pedido" modal as the content of the routed page: a centered card ~580 wide with the thank-you illustration, primary rules, close button and bottom bar, inside the normal app shell (no `Dialog`, no scrim).
- **RCPT-14** — Below `lg` (390 and 768), THE SYSTEM SHALL render a full-width single-column page of the same content (`design.md` §6), usable at 390 px without horizontal scroll, with the explorer action in a fixed bottom area.
- **RCPT-15** — THE SYSTEM SHALL give the page one `h1` (the Figma heading "Seus NFTs agora estão na sua carteira"), move focus to it when arriving from checkout, and expose the lines as a table with column headers.
- **RCPT-16** — THE SYSTEM SHALL offer a close action ("Fechar", the Figma ×) that navigates to the catalog, and a "Continuar explorando" link.

## Decisions

Taken on 2026-10-28; the reasons are in `design.md` §2 and §11.

1. **Route, not modal.** The receipt is a real route page at `/orders/$orderId` (orchestrator decision): it needs direct access, refresh and recovery (brief §3.3, §4). From `lg` the page renders the Figma modal as a centered card (the approach of spec 04 for login and sign-up); below `lg` the same content is a full-width page.
2. **Mobile layout.** There is no frame; `design.md` §6 follows the mobile style of the cart and checkout (390 / 768). It is recorded as a Figma deviation for spec 14.
3. **Date format.** `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })` instead of Figma's "29 Jul, 2026".
4. **Subtotal and discount rows** are added to the totals ("Subtotal", and "Desconto (<code>)" only when non-zero), so the total is explainable.
5. **Forbidden vs not found.** A distinct "sem acesso" view for 403 (RCPT-03), revealing nothing about the order.

## Out of scope

- Order history list, downloads, sharing or printing the receipt.
- A real block explorer; the explorer is a simulated page of this app (RCPT-17 – RCPT-21). It does not list addresses, blocks or other transactions.
- Copy-to-clipboard for the transaction id (not drawn).
- Creating or tracking orders (spec 09); this spec reuses its tracking hook and panels.
