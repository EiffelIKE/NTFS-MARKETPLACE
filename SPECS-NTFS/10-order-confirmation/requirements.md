# 10 — Order confirmation · Requirements

> Status: Draft — see Open questions

Show the receipt of a confirmed order at `/orders/$orderId`. The receipt is rendered only from the order snapshot returned by `orders.get`, so later catalog changes never alter it. It shows the result, simulated transaction id, date, total, wallet, purchased lines, network fee and an explorer link that is visibly simulated. Pending and declined orders reuse spec 09's panels; confirmation is never shown for an order the simulation has not confirmed.

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
- **RCPT-07** — WHEN the order is `declined`, THE SYSTEM SHALL render spec 09's declined panel with `declineReason.message` and links "Voltar ao carrinho" and "Ir para o pagamento".

### Receipt content

- **RCPT-08** — THE SYSTEM SHALL render the receipt from the `Order` response only: lines (image, name, token id, edition label, quantity, line total), subtotal, discount when non-zero, network fee and total, all formatted with spec 02's `formatEth`. It SHALL NOT request catalog data to render it.
- **RCPT-09** — THE SYSTEM SHALL show the summary band with "ID da transação" (shortened hash, full hash available to assistive technology and as a tooltip), "Data" (`settledAt`, pt-BR date), "Total" and "Carteira" (provider label).
- **RCPT-10** — THE SYSTEM SHALL show the note "Transação confirmada na <network name>. A propriedade foi transferida para sua carteira conectada e registrada na rede." using the order's network.
- **RCPT-11** — THE SYSTEM SHALL render "Ver no <explorerName>" as a link to `transaction.explorerUrl` opening in a new tab, with text stating that the explorer is simulated.
- **RCPT-12** — WHEN catalog prices or availability change after the order was confirmed, THE SYSTEM SHALL show the same amounts on every later visit.

### Layout and accessibility

- **RCPT-13** — THE SYSTEM SHALL render the desktop composition of the Figma "Confirmação de Pedido" frame (centered card ~580 wide, thank-you illustration, primary rules and bottom bar) from `lg`.
- **RCPT-14** — Below `lg`, THE SYSTEM SHALL render a single-column composition of the same content (proposal in `design.md` §6), usable at 390 px without horizontal scroll.
- **RCPT-15** — THE SYSTEM SHALL give the page one `h1` (the Figma heading "Seus NFTs agora estão na sua carteira"), move focus to it when arriving from checkout, and expose the lines as a table with column headers.
- **RCPT-16** — THE SYSTEM SHALL offer a close action ("Fechar", the Figma ×) that navigates to the catalog, and a "Continuar explorando" link.

## Open questions

1. **Route or modal.** Figma draws the confirmation as a modal over an empty page. *Default:* a route `/orders/$orderId` whose page renders the modal-styled card centered, inside the normal shell, not a Radix `Dialog` (reasons in `design.md` §2).
2. **Mobile layout.** No frame. *Default:* the proposal in `design.md` §6. This is why the spec is a draft; confirm when spec 09 is done.
3. **Date format.** Figma writes "29 Jul, 2026". *Default:* `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })` → "29 de jul. de 2026".
4. **Discount and subtotal rows.** The Figma receipt shows only fee and total. *Default:* add "Subtotal" and, when non-zero, "Desconto (<code>)" above the fee, so the total is explainable.
5. **Forbidden vs not found.** Spec 02 returns 403 for another user's order. *Default:* a distinct "sem acesso" message (RCPT-03) that reveals nothing about the order.

## Out of scope

- Order history list, downloads, sharing or printing the receipt.
- A real block explorer; the link targets the reserved `explorer.kurio.example` domain.
- Copy-to-clipboard for the transaction id (not drawn).
- Creating or tracking orders (spec 09); this spec reuses its tracking hook and panels.
