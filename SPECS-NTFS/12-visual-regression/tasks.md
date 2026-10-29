# 12 — Visual regression · Tasks

> Status: Done.

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes.

## Tasks

- [x] **T01 — Config and helpers** · VR-04 – VR-08, VR-10, VR-11
  - `playwright.config.ts` (`snapshotPathTemplate`, `toHaveScreenshot` defaults), `e2e/support/visual.ts`, `e2e/support/visual.css`.
  - **Proof:** `pnpm typecheck` and `pnpm lint` clean; the spec runs in both projects.

- [x] **T02 — Scripts** · VR-09, VR-12
  - `test:visual` and `test:visual:update` in `package.json`. The draft's container script is dropped (design §0).
  - **Proof:** `pnpm test:visual:update` writes the baselines; `pnpm test:visual` compares them.

- [x] **T03 — Baselines** · VR-01 – VR-03
  - `e2e/visual.spec.ts` with every row of design §4. Baselines reviewed by eye against `figma_tokens/screenshots/` (findings in the Run log).
  - **Proof:** 16 files under `e2e/__screenshots__/{desktop,mobile}-chromium/`; `--repeat-each=6` at 8 and at 3 workers: 72 + 72 runs passed.

- [x] **T04 — Sensitivity check** · VR-11
  - Changed `--color-text-accent` and a cart card padding, rebuilt, ran `pnpm test:visual`.
  - **Proof:** 8 of 12 failed with expected, actual and diff images and a trace each; reverted, rebuilt, 12 of 12 pass.

- [x] **T05 — Wrap-up**
  - Design §8 notes for spec 14, spec 00 design §15 and spec 14 design (tests item) amended, README status Done.
  - **Proof:** see the Run log.

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `lint` (`--max-warnings 0`), `format:check`, `test` (58 files, 663 tests; none added, the work is E2E only), `build` exit 0. Full `pnpm test:e2e` after the last change: **770 results in both projects, 738 passed, 32 skipped by design, 0 failed** (7.9 min), of which 12 are the new visual tests (6 per project).
- Stability: after the final `settle` change, `--repeat-each=6` at 8 workers and at 3 workers: 72 + 72 passed. Before it, 2 failures in about 84 runs: the desktop home was captured while the catalog was dimmed (`data-outdated`) by the refetch that follows the first socket connection; `settle` now waits for the connection and for no `data-outdated`.
- Findings while building it: Playwright's clock does not tick after `install` (timers fire only on `runFor`); `setFixedTime` hides the router's pending view because it reads `Date.now`, so skeleton tests skip it; `--color-primary` is barely used in the UI, so the sensitivity check used `--color-text-accent`.
- Baselines reviewed by eye against `figma_tokens/screenshots/` (desktop home and details): same composition, order and spacing. Known differences, none changed here: Figma shows a cart badge ("6") for a guest and ours shows none; the Figma gallery thumbnails repeat one image while ours show the four fixture images; Figma's details related row has pager dots and boxed cards, ours is a plain row; Figma's collection counts and pagination (1 2 3 4) differ from the seeded data (17, 6, 33 … and `1 2 … 14`); the home hero shows pager dots in a different place. These come from the fixtures and the owner specs' decisions, not from this spec.
- Port 4173 was served by `vite preview` from `dist` for the runs; the server was stopped at the end.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| VR-01 | T03 | four screens × two projects |
| VR-02 | T03 | full-page shots; mobile viewport shots for home and details |
| VR-03 | T03 | `home-loading`, `details-loading` |
| VR-04 | T01 | `prepare()`: fresh context, `?reset=1` |
| VR-05 | T01 | `clock.install` + `setFixedTime` |
| VR-06 | T01 | `settle()` |
| VR-07 | T01 | config + `visual.css` + reduced motion |
| VR-08 | T03 | mask table: none needed |
| VR-09 | T01, T02 | `{platform}` in the path; Playwright's Chromium |
| VR-10 | T01, T03 | path template; baselines committed (not ignored) |
| VR-11 | T01, T04 | tolerance; sensitivity check |
| VR-12 | T02 | scripts; visual tests in the default run |
