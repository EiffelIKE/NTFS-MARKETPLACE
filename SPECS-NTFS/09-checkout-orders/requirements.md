# 09 — Checkout & orders · Requirements

> Status: Ready for review

Turn the cart into an order. The collector fills or confirms their details, picks a registered wallet, a payment network and a wallet provider, connects the wallet (simulated), reviews a fresh API quote, and submits. The order is created idempotently, starts `pending`, and becomes `confirmed` or `declined` through `order.updated` with a REST fallback. The flow survives repeated clicks, timeouts, refreshes, reconnections and session expiry without creating a second order. The receipt itself is spec 10; this spec owns everything up to the moment an order is known to be confirmed, plus the pending and declined states.

Brief coverage: §3 (Checkout screen), §3.3 (all bullets), §4 (no duplicate operations, background states, per-user isolation), §6 (declined payment, timeout after order creation, price change and sold-out during purchase, wallet rejection), §7 (`order.updated`, `nft.updated` during checkout, pending order across disconnection), §9 scenarios 6, 7, 9 and the pending-order half of 10.

## User stories

- **US-1** — As a collector, I open checkout from the cart and find my details and my registered wallet already filled in, so I only confirm or adjust them.
- **US-2** — As a collector, I choose which registered wallet pays, on which network and through which provider, and I see the network fee change the total before I commit.
- **US-3** — As a collector, I connect my wallet (simulated) and I am told clearly when the wallet rejects the connection or gets disconnected.
- **US-4** — As a collector, I review exactly what I will pay. If price, availability, coupon or fee changes before I submit, I must look at the new values and confirm again.
- **US-5** — As a collector, clicking "Confirmar compra" twice, losing the response, or refreshing never buys twice; I get back to the same order.
- **US-6** — As a collector, I see my order as processing, then confirmed or declined. A decline keeps my cart; a confirmation removes only what I bought.

## Acceptance criteria

### Access and entry

- **CHK-01** — WHEN a visitor without a session opens `/checkout`, THE SYSTEM SHALL redirect to the login flow with `redirect=/checkout` (spec 04) and return to checkout after login.
- **CHK-02** — WHEN the cart is empty, THE SYSTEM SHALL show an empty state "Seu carrinho está vazio" with a link to the catalog, and SHALL NOT render the form or the submit button.
- **CHK-03** — WHEN the user has no registered wallet, THE SYSTEM SHALL show "Cadastre uma carteira para finalizar a compra" with a link to `/wallets`, and SHALL NOT allow submission.
- **CHK-04** — WHILE the cart, quote, profile, wallets or networks are loading, THE SYSTEM SHALL show skeletons in the place of each region without layout shift; WHEN any of them fails, THE SYSTEM SHALL show an inline error with "Tentar novamente" for that region.

### Collector details

- **CHK-05** — THE SYSTEM SHALL render the "Perfil do colecionador" fields of `CollectorDetails` (Nome de exibição, Nome de usuário, Rede, Nome do perfil, Endereço da carteira, ENS ou carteira secundária, Tipo de carteira, Código de indicação, E-mail, Nome ENS) and "Observação do colecionador (opcional)", with required fields marked and labelled.
- **CHK-06** — WHEN checkout loads, THE SYSTEM SHALL prefill display name, username, email and ENS name from the profile, and profile name, wallet address, alternate wallet, referral code, provider and network from the selected wallet. Values the user edited SHALL NOT be overwritten by a later refetch.
- **CHK-07** — THE SYSTEM SHALL validate the form with the same Zod schema as the contract (`CollectorDetails`, `note ≤ 500`) on submit and on blur after the first submit, show pt-BR messages next to each field, and move focus to the first invalid field.
- **CHK-08** — WHEN `orders.create` answers 422 `VALIDATION_FAILED`, THE SYSTEM SHALL map `fields['collector.<field>']` to the matching inputs and show any unmapped message in the form-level alert.
- **CHK-09** — THE SYSTEM SHALL keep a draft of the form (values and selections) per user for the browser session, so it is restored after a refresh or a re-login, and SHALL discard it after an order is created.

### Wallet, network and provider

- **CHK-10** — THE SYSTEM SHALL let the user choose between the registered primary and secondary wallets (desktop "Usar outra carteira?", mobile wallet cards). The wallet address SHALL come from the chosen wallet and SHALL NOT be editable in checkout.
- **CHK-11** — THE SYSTEM SHALL offer in "Rede" only the networks whose `walletFamily` matches the chosen wallet, defaulting to the wallet's registered network.
- **CHK-12** — WHEN the network changes, THE SYSTEM SHALL fetch `quote.get` for that network and show its subtotal, discount, network fee (caption "Taxa estimada") and total. All amounts SHALL come from the quote, never from client arithmetic.
- **CHK-13** — THE SYSTEM SHALL let the user choose the provider (WalletConnect, MetaMask, Coinbase Wallet), defaulting to the chosen wallet's registered provider.
- **CHK-14** — WHEN the user connects, THE SYSTEM SHALL call `walletConnections.connect` with the chosen wallet, provider and network, show a connecting state, and then show the connection as "Conectada".
- **CHK-15** — WHEN the connection answers 409 `WALLET_REJECTED`, THE SYSTEM SHALL show "A carteira recusou a conexão." with a retry action, and SHALL keep every form value.
- **CHK-16** — THE SYSTEM SHALL let the user disconnect (`walletConnections.disconnect`). WHEN the wallet is disconnected outside the UI and `orders.create` answers 409 `WALLET_NOT_CONNECTED`, THE SYSTEM SHALL mark the connection as disconnected, explain it, and offer to reconnect without losing the review.
- **CHK-17** — WHEN the wallet, provider or network changes, THE SYSTEM SHALL treat the previous connection as not applicable and require a connection for the new combination.

### Review and revalidation

- **CHK-18** — WHEN the user activates "Confirmar compra" with a valid form, THE SYSTEM SHALL open a review step showing lines, subtotal, discount, network fee, total, wallet, network and provider, using a quote fetched when the step opens.
- **CHK-19** — WHILE the review is open, WHEN an `nft.updated` event concerns an NFT in the quote, or the cart changes, THE SYSTEM SHALL refetch the quote.
- **CHK-20** — WHEN the reviewed quote is replaced by one with a different `id` (refetch, or 409 `QUOTE_CHANGED` with `details.quote`), THE SYSTEM SHALL show the new values with the changed amounts highlighted, announce "Os valores do pedido mudaram.", and replace the pay button by "Aceitar novos valores" until the user activates it. Only then SHALL the pay button submit, and it SHALL submit the newly shown `quote.id`.
- **CHK-21** — WHEN the quote is not `purchasable`, or `orders.create` answers 409 `INSUFFICIENT_AVAILABILITY`, THE SYSTEM SHALL list the affected lines, disable payment and offer "Voltar ao carrinho".
- **CHK-22** — THE SYSTEM SHALL show non-blocking quote issues (`PRICE_CHANGED`, `COUPON_EXPIRED`, `COUPON_NOT_APPLICABLE`) as notes in the review without blocking payment.

### Order creation and idempotency

- **CHK-23** — THE SYSTEM SHALL create an order only through `orders.create` with an `Idempotency-Key` that belongs to one checkout attempt: the same key for the same body, a new key whenever the body changes.
- **CHK-24** — WHILE an `orders.create` request is in flight, THE SYSTEM SHALL ignore further activations of the pay button (loading state, `aria-busy`). Repeated clicks SHALL produce at most one request.
- **CHK-25** — WHEN `orders.create` fails with `timeout` or `network`, THE SYSTEM SHALL say the result is unknown and offer "Tentar novamente", which resends the same key and body; a replay answered 200 SHALL continue with the returned order.
- **CHK-26** — THE SYSTEM SHALL persist the pending attempt (key, body, user) in local storage until its outcome is known, so that after a refresh it replays the attempt once to learn whether the order exists, instead of creating a new one.
- **CHK-27** — WHEN `orders.create` answers 409 `ORDER_PENDING` or `IDEMPOTENCY_CONFLICT`, THE SYSTEM SHALL resume tracking `details.orderId` instead of showing a generic error.
- **CHK-28** — WHEN any request answers 401 `SESSION_EXPIRED` during checkout, THE SYSTEM SHALL keep the draft and the pending attempt and follow spec 04's expiry flow back to `/checkout`.

### Order status

- **CHK-29** — WHEN an order is created (201 or replayed 200) with status `pending`, THE SYSTEM SHALL show "Processando pagamento" with the order id and a polite live announcement, and SHALL track the order through `order.updated` and, as a fallback, `orders.get` polling while it stays pending.
- **CHK-30** — WHEN the user opens `/checkout` while they have a pending order, THE SYSTEM SHALL show that order's processing state instead of the pay button, including after a refresh or reconnection, and SHALL NOT create another order.
- **CHK-31** — WHEN the tracked order becomes `confirmed`, THE SYSTEM SHALL invalidate the cart and orders caches and navigate (replace) to `/orders/$orderId`.
- **CHK-32** — WHEN the tracked order becomes `declined`, THE SYSTEM SHALL show "Pagamento recusado" with `declineReason.message`, keep the cart unchanged, and offer "Tentar novamente" (a new attempt) and "Voltar ao carrinho".
- **CHK-33** — THE SYSTEM SHALL treat `confirmed` and `declined` as terminal: a later event or response with an older `version` SHALL NOT change the shown status (spec 03 version guard).
- **CHK-34** — AFTER confirmation, THE SYSTEM SHALL show the cart with only the purchased quantities removed, as returned by the API; items added or quantities raised after the order was created SHALL remain.

### Layout and accessibility

- **CHK-35** — THE SYSTEM SHALL render the desktop composition of the Figma "Pagamento" frame (form left, "Seus NFTs" summary and "Carteira e rede" right) from `lg`, and the mobile "Pagamento com carteira" composition below it, with the primary action in the fixed bottom area.
- **CHK-36** — THE SYSTEM SHALL make the whole flow operable by keyboard: radio groups for wallets and providers, focus moved into the review dialog and back to its trigger on close, status changes announced once through the spec 01 announcer or a toast, never both.

## Open questions

Defaults below are applied in `design.md`; confirm or change in review.

1. **Two provider controls on desktop.** Figma has a "Tipo de carteira" select in the form and a "Carteira e rede" radio list on the right. *Default:* both bind to the same `provider` value; the radio list is the main control, the select mirrors it.
2. **Desktop "Usar outra carteira?".** *Default:* a checkbox-like radio that switches to the secondary wallet and refills the wallet fields; disabled with a hint when there is no secondary wallet.
3. **Mobile collector form.** Figma's mobile frame shows only wallets, providers and total. *Default:* the form exists on mobile as a collapsed "Dados do colecionador" section, prefilled, expanded automatically on a validation error; "Rede" lives there too.
4. **Review step.** Figma has no review frame. *Default:* a spec 01 `Dialog` on desktop and full-height `Sheet` from the bottom on mobile.
5. **The "METAMASK • WALLETCONNECT • COINBASE" first option** on desktop. *Default:* rendered as a non-selectable caption of compatible wallets, not as a radio.

## Out of scope

- Real wallet extensions, signatures, chains and payment gateways (brief §1).
- Editing or creating wallets inside checkout ("Trocar carteira" and the card menu link to `/wallets`, spec 08).
- Coupon behavior itself (spec 07); checkout reuses spec 07's coupon form behind "Tem um código promocional? Aplique aqui".
- Order history screen; `orders.list` is used only to find a pending order.
- The receipt layout (spec 10).
- Cancelling a pending order.
