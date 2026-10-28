# 10 — Order confirmation · Tasks

> Status: Draft — see Open questions in requirements.md

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 09 is Done (`features/orders/`: query options, `useOrderStatus`, pending and declined panels; navigation from checkout).

## Blockers (user-provided)

None for desktop. The mobile layout (design §6) is a proposal to confirm before T04.

## Tasks

- [ ] **T01 — Formatting helpers** · RCPT-09
  - `features/receipt/model/format.ts`: `shortHash`, `formatOrderDate`, `providerLabel`.
  - **Proof:** `format.test.ts`.

- [ ] **T02 — Route, loader and status switch** · RCPT-01 – RCPT-07
  - `routes/orders/$orderId.tsx`: spec 04 guard, `ensureQueryData`, 404 → `notFound()`, 403 → `OrderForbidden`, error component, `ReceiptSkeleton` as `pendingComponent`, titles.
  - `order-page.tsx` switching on `useOrderStatus`.
  - **Proof:** E2E `receipt.spec.ts` access tests (guest redirect, Bruno forbidden, unknown id not found) and `pending-order` settle tests (confirmed and declined, in place).

- [ ] **T03 — Desktop receipt card** · RCPT-08 – RCPT-11, RCPT-13, RCPT-15, RCPT-16
  - `receipt-card.tsx`, `receipt-summary-band.tsx`, `receipt-lines.tsx` per design §5; focus on arrival from checkout.
  - **Proof:** `receipt-card.test.tsx`; E2E `receipt.spec.ts` direct access with no `nfts.*` request and close/continue links; manual comparison against the desktop PNG at 1440.

- [ ] **T04 — Mobile composition** · RCPT-14
  - Design §6 below `lg`, after the proposal is confirmed.
  - **Proof:** E2E `receipt.spec.ts` mobile test (no horizontal scroll at 390, bottom action, axe clean).

- [ ] **T05 — Snapshot immutability and purchase hand-off** · RCPT-05, RCPT-12
  - Confirm nothing in the receipt reads catalog queries; finish the receipt assertions in spec 09's `purchase.spec.ts`.
  - **Proof:** E2E `receipt.spec.ts` price change + reload keeps amounts; `purchase.spec.ts` receipt assertions pass.

## Coverage

| Requirement | Tasks |
|---|---|
| RCPT-01 – RCPT-04 | T02 |
| RCPT-05 | T02, T05 |
| RCPT-06, RCPT-07 | T02 |
| RCPT-08 – RCPT-11 | T03 |
| RCPT-12 | T05 |
| RCPT-13 | T03 |
| RCPT-14 | T04 |
| RCPT-15, RCPT-16 | T03 |
