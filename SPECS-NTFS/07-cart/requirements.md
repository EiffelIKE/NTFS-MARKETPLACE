# 07 — Cart · Requirements

> Status: Ready for review

Build the cart screen (desktop and mobile frames "Carrinho de NFTs") on top of the spec 02 cart, coupon, merge and quote operations: the server cart for signed-in users and the guest cart identified by `X-Guest-Cart-Id`, quantity editing and removal within availability limits, coupons, a quote-driven summary, persistence across refreshes, the merge of guest items on login, and live price and availability changes pushed by spec 03.

Brief coverage: §3 (Cart screen), §3.2 (cart rules, decimal-string ETH, quote as reference), §4 (states, invalidation, stale-response discard, per-user isolation), §7 (`nft.updated` in the cart), §8 (skeleton in the cart summary, responsiveness, accessibility), §9 (E2E scenario 5, share of scenario 12).

## User stories

- **US-1** — As a visitor, I add NFTs to a cart without an account, and they are still there after a refresh and after I log in.
- **US-2** — As a collector, I change quantities and remove lines, and the cart never lets me ask for more than is available or allowed per order.
- **US-3** — As a collector, I apply or remove a promo code and see clearly why a code was refused.
- **US-4** — As a collector, I see subtotal, discount, network fee and total exactly as the API computed them, with no rounding surprises.
- **US-5** — As a collector with the cart open, I am told when a price or availability changes, and the summary updates without a reload.

## Acceptance criteria

### Cart identity and persistence

- **CART-01** — WHEN a visitor without a session adds the first item, THE SYSTEM SHALL store the `cart.id` returned by the API as the guest cart id in `localStorage`, and spec 04's request interceptor SHALL send it as `X-Guest-Cart-Id` on every later guest request.
- **CART-02** — WHEN the API returns a guest cart with `id: null` while a guest cart id is stored, THE SYSTEM SHALL discard the stored id (the cart no longer exists) and show an empty cart.
- **CART-03** — WHEN the page is reloaded, THE SYSTEM SHALL show the same cart lines, quantities and coupon, for a guest and for a signed-in user.
- **CART-04** — WHEN a user logs in or signs up while a guest cart id is stored, THE SYSTEM SHALL call `cart.merge` once, clear the stored id on success, show the merged cart, and tell the user about every adjusted line (`capped` or `unavailable`) in one toast. WHEN the merge fails, THE SYSTEM SHALL keep the id and retry on the next session start.
- **CART-05** — THE SYSTEM SHALL key cart and quote data by owner (user id or guest), so a logout or user switch never shows the previous owner's cart (spec 04 also clears the Query cache).

### Lines

- **CART-06** — THE SYSTEM SHALL show each line with image, name, token id, edition label, unit price, quantity stepper, line total (`lineTotal`) and a remove button, in the order returned by the API.
- **CART-07** — WHEN the quantity is changed, THE SYSTEM SHALL keep it between 1 and `maxQuantity`, disable the decrease control at 1 and the increase control at `maxQuantity`, and explain the limit next to the stepper ("Máximo por pedido: N" or "Disponíveis: N").
- **CART-08** — WHEN the quantity is changed several times quickly, THE SYSTEM SHALL send at most one update request per line at a time and settle on the last value chosen. WHEN a response older than the cached cart arrives (lower `version`), THE SYSTEM SHALL discard it.
- **CART-09** — WHEN an update or removal fails, THE SYSTEM SHALL restore the server quantity, keep the line, and show the API message with a retry action; a 409 `INSUFFICIENT_AVAILABILITY` SHALL refetch the cart so the new limit shows.
- **CART-10** — WHEN a line is removed, THE SYSTEM SHALL remove it after the API confirms, announce "<nome> removido do carrinho", and move focus to the next line's remove button, or to the page heading when no line remains.
- **CART-11** — WHEN the cart has no lines, THE SYSTEM SHALL show an empty state ("Seu carrinho está vazio") with a link to the catalog, and no summary.

### Coupons

- **CART-12** — WHEN a code is submitted, THE SYSTEM SHALL call `cart.applyCoupon` and, on success, show the applied coupon (code and description) with a "Remover" action. Empty input SHALL be rejected on the client without a request.
- **CART-13** — WHEN the API returns `COUPON_INVALID`, `COUPON_EXPIRED` or `COUPON_NOT_APPLICABLE`, THE SYSTEM SHALL show its message as a field error on the code input, keep the typed code and leave the previous coupon state unchanged.
- **CART-14** — WHEN the quote reports a non-blocking `COUPON_EXPIRED` or `COUPON_NOT_APPLICABLE` issue for an applied coupon, THE SYSTEM SHALL show the discount as zero and a notice on the coupon explaining why.

### Summary

- **CART-15** — THE SYSTEM SHALL show subtotal, discount, network fee and total only from `quote.get` (network `ethereum`, spec 02 decision 3), labelled "Taxa estimada" under the fee, and SHALL NOT compute any summary amount on the client.
- **CART-16** — THE SYSTEM SHALL refetch the quote whenever the cart version changes, and SHALL show skeletons in the amount slots while the quote is loading, at the final size of each value (no layout shift).
- **CART-17** — THE SYSTEM SHALL format every ETH amount with `formatEth` from spec 02 (decimal strings, no `number` conversion).
- **CART-18** — WHEN the quote is not purchasable (any blocking issue), THE SYSTEM SHALL disable "Conectar e finalizar" and say why next to it. Otherwise "Conectar e finalizar" SHALL go to `/checkout`, through `/login?redirect=/checkout` for a guest.

### Live changes

- **CART-19** — WHEN spec 03 reports an `nft.updated` for an NFT in the cart, THE SYSTEM SHALL refetch the cart and the quote without a reload.
- **CART-20** — WHEN a line comes back as `price_changed`, THE SYSTEM SHALL show an inline notice with the old and new unit price and an "Entendi" action that calls `cart.updateItem` with `acknowledgePrice: true`.
- **CART-21** — WHEN a line comes back as `limited`, THE SYSTEM SHALL show "Restam apenas N disponíveis." (singular when N is 1) with an "Ajustar quantidade" action that sets the quantity to `maxQuantity`. WHEN a line comes back as `unavailable`, THE SYSTEM SHALL show "Esgotado", exclude it from the totals (the quote does) and offer "Remover".
- **CART-22** — WHEN a line's status changes because of a live update, THE SYSTEM SHALL announce it once through the polite announcer (no toast), and SHALL NOT announce it again for the same NFT version.

### States, layout and accessibility

- **CART-23** — WHILE the cart is loading, THE SYSTEM SHALL show line and summary skeletons in a `LoadingRegion` labelled "Carregando carrinho". WHEN loading fails, THE SYSTEM SHALL show an inline alert with "Tentar novamente".
- **CART-24** — THE SYSTEM SHALL render the desktop frame (table and right summary, "Colecionadores também viram" row) from `lg`, and the mobile frame below `lg`: inner top bar "Carrinho de NFTs", line cards, and a fixed bottom summary that does not hide the last line.
- **CART-25** — THE SYSTEM SHALL label every control with the line it acts on (for example "Aumentar quantidade de Emerald Ape #042, edição 1/50"), and the header cart badge SHALL show `cart.itemCount`.

## Out of scope

- Choosing the payment network, wallet connection and order creation: spec 09. The cart always quotes with Ethereum.
- Saving for later, wishlists from the cart, editing the edition of a line (remove and add again from details).
- Undo after removal.
- The "Colecionadores também viram" carousel behavior beyond showing the related row (dots are decorative).

## Open questions

1. **Network for the estimated fee.** Default: always `ethereum`, as spec 02 decision 3 and the Figma cart (0.016) say. Alternative: the signed-in user's primary wallet network. The default keeps the guest and signed-in carts identical and needs no wallet request.
2. ~~**Who creates `features/cart/api/` first.**~~ Resolved: spec 06 creates `cart-keys.ts`, `cart-queries.ts`, `apply-cart.ts`, `useAddCartItem` and `guest-cart-id.ts` exactly as design §3–§4 describe; spec 07 extends them.
