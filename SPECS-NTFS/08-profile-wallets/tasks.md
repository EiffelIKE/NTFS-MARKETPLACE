# 08 — Profile & wallets · Tasks

> Status: Draft — T07 (mobile) waits for the layout decision in requirements Open question 1

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after spec 04 is Done (route guard, session user helper, logout action, form helpers). Spec 05 provides `/?favorites=1` for "Lista de interesse"; until then that item is an `UnavailableLink`.

## Blockers (user-provided)

None. Decision needed before T07: mobile layout (requirements Open question 1).

## Tasks

- [ ] **T01 — Spec 02 amendment: address/network rule** · ACC-17
  - `addressMatchesNetwork` + `superRefine` on `WalletFields` in `contracts/wallets.ts`; the wallet handler parses with it (design §11).
  - **Proof:** spec 02 `contracts.test.ts` gains the EVM/Solana cases and stays green; the spec 02 wallet handler test still returns 422 on `address` with the same message.

- [ ] **T02 — Keys, queries, mutations** · ACC-06, ACC-09, ACC-20, ACC-22
  - `account-keys.ts`, profile and wallet query options and mutations; session user patch via spec 04's helper; wallet list update + background invalidation.
  - **Proof:** `pnpm typecheck` clean; E2E rows "header shows new name" and "Carteira salva → reload" pass (after T04/T06).

- [ ] **T03 — Account layout, menu and routes** · ACC-01, ACC-02
  - `account-layout.tsx`, `account-nav.tsx`, `/profile` and `/wallets` routes with head, shell config and non-blocking loaders.
  - **Proof:** E2E guest-redirect row passes; menu items render with the right targets and `aria-current`.

- [ ] **T04 — Profile form and password section** · ACC-03 – ACC-06, ACC-10 – ACC-14
  - `model/profile-form.ts`, `profile-form.tsx`, `password-section.tsx`, submit sequence of design §4.
  - **Proof:** `profile-form.test.ts` green; E2E profile and password rows pass.

- [ ] **T05 — Avatar field** · ACC-07 – ACC-09
  - `avatar-file.ts`, `avatar-field.tsx` with preview, errors and removal.
  - **Proof:** `avatar-file.test.ts` green; E2E avatar row passes.

- [ ] **T06 — Wallet slots and form** · ACC-15 – ACC-20
  - `model/wallet-form.ts` (`copyFromPrimary`), `wallet-slot.tsx`, `wallet-form.tsx`, error mapping of design §6.
  - **Proof:** `wallet-form.test.ts` green; E2E Bruno and Carla wallet rows pass.

- [ ] **T07 — Mobile and tablet composition** · ACC-23
  - Design §8 once Open question 1 is settled.
  - **Proof:** E2E mobile row passes; manual check at 390, 768 and 390 at 200 % zoom (no horizontal scroll, every action reachable).

- [ ] **T08 — States and accessibility** · ACC-21, ACC-22, ACC-24
  - Skeletons, error alerts, `loading` buttons, required-field text, section labelling.
  - **Proof:** E2E slow, double-click and axe rows pass.

- [ ] **T09 — E2E suite** · all
  - `e2e/account.spec.ts` (design §10) in both Chromium projects; avatar fixtures in `e2e/fixtures/` (a 1 KB PNG and a GIF).
  - **Proof:** `pnpm test:e2e e2e/account.spec.ts` green; `pnpm typecheck && pnpm lint` clean.

- [ ] **T10 — Notes for spec 14** · —
  - Copy design §13 into the spec 14 deviation list (or its working notes file).
  - **Proof:** entries present.

## Coverage

| Requirement | Tasks | Proof |
|---|---|---|
| ACC-01, ACC-02 | T03 | E2E guest-redirect row, menu assertions |
| ACC-03 – ACC-06 | T02, T04 | `profile-form.test.ts`, E2E profile rows |
| ACC-07 – ACC-09 | T02, T05 | `avatar-file.test.ts`, E2E avatar row |
| ACC-10 – ACC-14 | T04 | `profile-form.test.ts`, E2E password rows |
| ACC-15 – ACC-20 | T01, T02, T06 | `wallet-form.test.ts`, E2E wallet rows |
| ACC-21, ACC-22 | T08 | E2E slow and double-click rows |
| ACC-23 | T07 | E2E mobile row, manual check |
| ACC-24 | T08 | E2E axe row |
