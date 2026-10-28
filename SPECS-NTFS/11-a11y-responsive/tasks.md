# 11 — Accessibility & responsiveness · Tasks

> Status: Draft — see [Open questions](requirements.md#open-questions).

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 05–10 are Done. Fixes go into the owner spec's code and are logged in `audit.md`.

## Tasks

- [ ] **T01 — Audit log and inventories** · A11Y-19
  - Create `audit.md` with the columns from design §9.
  - Reconcile design §2–§5 with what specs 04–10 actually shipped (routes, overlays, live messages); update the tables.
  - **Proof:** every route in `src/routes/` appears in design §2; every `Dialog`, `Sheet`, `AlertDialog` and `DropdownMenu` usage (`grep`) appears in design §4.

- [ ] **T02 — Test helpers** · A11Y-01, A11Y-05, A11Y-09, A11Y-16
  - `e2e/support/a11y.ts` with the helpers in design §1.
  - **Proof:** a throwaway test on `/dev/ui-kit` uses each helper and passes; `liveMessages` records one message per `announce` call in the gallery.

- [ ] **T03 — Axe matrix** · A11Y-01, A11Y-02, A11Y-03
  - Data-driven tests over design §2, both projects.
  - Fix or log every serious/critical violation; any disabled rule is documented per A11Y-03.
  - **Proof:** `pnpm test:e2e e2e/a11y.spec.ts -g axe` passes; `audit.md` lists each fix.

- [ ] **T04 — Route focus and keyboard paths** · A11Y-04, A11Y-05, A11Y-07
  - `useRouteFocus()` in `app/` (design §3).
  - Keyboard purchase test and the per-flow paths in design §3.
  - **Proof:** keyboard purchase reaches the confirmed receipt in both projects; route-focus test passes; `expectFocusVisible` passes on every stop.

- [ ] **T05 — Overlays and forms** · A11Y-06, A11Y-08
  - Overlay tests for each row in design §4, including fallback targets.
  - Form tests for sign-up, checkout, profile, password and wallet.
  - **Proof:** tests pass in both projects.

- [ ] **T06 — Live feedback** · A11Y-09, A11Y-10
  - Assert design §5 rows with `liveMessages`; realtime rows use `__mock.updateNft` (spec 02) so events go through the Socket.IO client (spec 03).
  - **Proof:** each message once, duplicate event → still once; unchanged refetch → none.

- [ ] **T07 — Semantics, images, contrast** · A11Y-11 – A11Y-14
  - Heading walk, title pattern, image alt rules (design §6), non-color cue review per screen, hero text sampling.
  - **Proof:** tests pass; `audit.md` has one row per non-color cue reviewed.

- [ ] **T08 — Responsive, zoom, reduced motion** · A11Y-15 – A11Y-18
  - Apply the tablet rules in design §7 where screens differ; `scroll-padding-bottom` for fixed bars.
  - Overflow sweep, zoom, text spacing, reduced-motion tests.
  - **Proof:** tests pass; screenshots at 768 of home, details, cart and checkout attached to `audit.md` for the user's review.

- [ ] **T09 — Manual pass and wrap-up** · A11Y-19
  - Orca smoke pass over the purchase flow (open question 1), results in `audit.md`.
  - Copy design §9 adjustments into the spec 14 deviation list.
  - **Proof:** `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` clean. Update the spec 11 status in [`../README.md`](../README.md).

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| A11Y-01 | T02, T03 | axe matrix |
| A11Y-02 | T03 | overlay scans |
| A11Y-03 | T03 | documented exceptions |
| A11Y-04 | T04 | keyboard purchase |
| A11Y-05 | T02, T04 | `expectFocusVisible` |
| A11Y-06 | T05 | overlay tests |
| A11Y-07 | T04 | route-focus test |
| A11Y-08 | T05 | form tests |
| A11Y-09 | T06 | `liveMessages` |
| A11Y-10 | T06 | unchanged refetch |
| A11Y-11 | T07 | heading walk |
| A11Y-12 | T07 | alt rules |
| A11Y-13 | T07 | cue review |
| A11Y-14 | T03, T07 | axe contrast; hero sampling |
| A11Y-15 | T08 | overflow sweep |
| A11Y-16 | T08 | zoom, text spacing |
| A11Y-17 | T08 | fixed-bar focus |
| A11Y-18 | T08 | reduced motion |
| A11Y-19 | T01, T09 | `audit.md`; `e2e/a11y.spec.ts` |
