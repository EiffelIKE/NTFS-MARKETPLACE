# 11 — Accessibility & responsiveness · Tasks

> Status: Done (2026-10-28). The manual screen-reader pass (T09) is deferred; see the Run log.

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Fixes went into the owner spec's code and are logged in [`audit.md`](audit.md).

## Tasks

- [x] **T01 — Finalize the spec, audit log and inventories** · A11Y-19
  - Requirements, design and tasks rewritten against what specs 04–10 shipped; the open questions decided (requirements, Decisions).
  - `audit.md` with one row per finding.
  - **Proof:** every route in `src/routes/` is a row of design §2 (the two `/dev/*` routes are spec 01 and 03's); every `Dialog`, `Sheet` and `DropdownMenu` file found by `grep` is in design §4.

- [x] **T02 — Test helpers** · A11Y-01, A11Y-05, A11Y-09, A11Y-16
  - `e2e/support/a11y.ts`: the helpers of design §1.
  - **Proof:** each helper is used by `e2e/a11y.spec.ts` and passes there; `recordLiveMessages` saw one entry per toast and per announcement in the live-feedback rows.

- [x] **T03 — Axe matrix** · A11Y-01, A11Y-02, A11Y-03
  - `SCREENS` × axe, both projects, plus the overlays.
  - Fixed: the account menu (`aria-hidden-focus`).
  - **Proof:** `pnpm test:e2e e2e/a11y.spec.ts -g "axe on every route|overlays"` passes; no rule disabled.

- [x] **T04 — Route focus and keyboard paths** · A11Y-04, A11Y-05, A11Y-07
  - `useRouteFocus()` in `app/`; the keyboard purchase, sign-in and filter paths; the fixed-bar focus walk.
  - **Proof:** `keyboard paths and route focus` passes in both projects (the purchase reaches the receipt heading with `Tab` and `Enter` only).

- [x] **T05 — Overlays and forms** · A11Y-06, A11Y-08
  - Overlay rows for each entry of design §4; form rows for sign-up (empty and `EMAIL_TAKEN`), login refusal, profile, wallets and checkout.
  - Fixed: the search dialog's focus return.
  - **Proof:** `overlays` and `forms` pass in both projects.

- [x] **T06 — Live feedback** · A11Y-09, A11Y-10
  - Rows of design §5 with `recordLiveMessages`; the realtime rows use `__mock.updateNft` and `realtime.redeliver`; the heart is inert before its list is known (owner fix, `favorites.spec.ts`).
  - **Proof:** each message once, a redelivered event still once, a reconciliation refetch adds nothing; the two heart rows pass.

- [x] **T07 — Semantics, images, contrast** · A11Y-11 – A11Y-14
  - Heading, title and landmark walk, image alt rules, non-color cue review (`audit.md`), contrast sampling over artwork.
  - Fixed: the details error state's title; the mobile hero card that cut off its copy (found by the sampling).
  - **Proof:** `semantics, titles and images`, `states without color alone` and `contrast over artwork` pass.

- [x] **T08 — Responsive, zoom, reduced motion, fixed bars** · A11Y-15 – A11Y-18
  - Overflow, zoom, text spacing, tablet and reduced-motion rows; `useBottomBarInset` and `scroll-padding-bottom`; toasts on top below `lg`; the 1024–1200 px home composition.
  - **Proof:** the rows pass; screenshots at 390, 768 and 1440 viewed in the browser (home, details, cart, profile, receipt).

- [x] **T09 — Flakes, wrap-up** · A11Y-20
  - The three flakes of design §10 and the zoom pass; amendments to the specs they touch.
  - **Proof:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` and the full `pnpm test:e2e` (see the Run log). The Orca pass is the one item not done.

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `lint` (`--max-warnings 0`), `format:check`, `test` (58 files, 663 tests; no new unit tests, the work is DOM and CSS and Vitest runs in node), `build` all exit 0. `pnpm test:e2e` (last run, after the final code change): **758 results in both projects, 726 passed, 32 skipped by design, 0 failed**; 238 of them are `a11y.spec.ts`.
- The first full run had 3 failures, both mine: `loading-states.spec.ts:194` (the details error `h1` is now "NFT indisponível", and the test was updated, not loosened) and CAT-14 on mobile (the loaded hero measures 198 px at 390, the skeleton 190: the skeleton and frame minimum are now 198, 245 under 380 px). Fixed and re-run in full.
- Known issues: (1) the heart is inert and `aria-busy` until the favorites list loads; (2) one `--bottom-bar-inset` variable and `scroll-padding-bottom` keep focused fields clear of the fixed bars, and toasts are top-center; (3) the three flakes: the cart merge row (waited for the wrong thing), the favorites expired-session row (waits for the live heart and the socket) and the purchase axe patch (replaced by `expectSettledOpacity` inside `expectNoAxeViolations`); (4) 200% zoom and WCAG 1.4.12 text spacing are clean on all 22 cells.
- Residual flake, not fixed: the sort row "three rapid clicks" in the catalog spec failed 2 of 50 runs before this work and 1 of 240 after, under load. Not root-caused.
- Pending: the manual Orca screen-reader pass (no interactive session here). It is marked pending in requirements, audit and README.
- Port 4173 was served by `vite preview` for the runs (`reuseExistingServer` skips the build, so run `pnpm build` first); the server was stopped at the end.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| A11Y-01 | T02, T03 | `axe on every route and state` (22 cells) |
| A11Y-02 | T03, T05 | `overlays` (6) |
| A11Y-03 | T03 | no rule disabled; `expectNoAxeViolations` runs the full tag set |
| A11Y-04 | T04 | keyboard purchase, sign-in and filters |
| A11Y-05 | T02, T04, T08 | `expectFocusVisible` on every `tabTo` stop; the fixed-bar walk; `tablet at 768 px` |
| A11Y-06 | T05 | `overlays` |
| A11Y-07 | T04 | `in-app navigation moves focus…` |
| A11Y-08 | T05 | `forms` (6) |
| A11Y-09 | T06 | `live feedback` (7) |
| A11Y-10 | T06 | the reconciliation row; the two heart rows of `favorites.spec.ts` |
| A11Y-11 | T07 | `semantics, titles and images` (22 cells + landmarks) |
| A11Y-12 | T07 | the alt rows |
| A11Y-13 | T07 | `states without color alone`; the cue table in `audit.md` |
| A11Y-14 | T03, T07 | axe `color-contrast`; `contrast over artwork` |
| A11Y-15 | T08 | `no overflow on every route and state` (22 cells × 6 widths) |
| A11Y-16 | T08 | `zoom and text spacing on every route` (22 cells) |
| A11Y-17 | T08 | `tablet at 768 px`; the fixed-bar walk |
| A11Y-18 | T08 | `reduced motion` |
| A11Y-19 | T01, T09 | `audit.md`; `e2e/a11y.spec.ts` |
| A11Y-20 | T06, T08, T09 | design §10 |
