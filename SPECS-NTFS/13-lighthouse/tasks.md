# 13 — Lighthouse · Tasks

> Status: Done — deployed comparison (T06) waits for the user's Vercel deploy.

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Started after specs 05–12 were Done.

## Blockers (user-provided)

- **B1 — Vercel deploy** for PERF-04 (T06). Every other task ran locally.

## Carried over

- [x] **Build chunk warning (from spec 01).** Resolved by real changes, not by raising the limit (PERF-16): vendor `codeSplitting` groups (`react`, `tanstack`) take the entry chunk from 376 to 127 kB, and `tldts` is aliased to the equivalent `tldts-experimental`, which takes the lazy mock chunk from 511 to 351 kB (189 → 124 kB gzip). **Proof:** `pnpm build` prints no warning; the largest chunk is `browser-*.js` at 351 kB.

## Tasks

- [x] **T01 — Configs and runner** · PERF-01 – PERF-03, PERF-05, PERF-06
  - `lighthouse/{desktop,mobile}.json` complete (design §2); `scripts/lighthouse-run.ts` takes `CHROME_PATH` from Playwright and clears stale raw output; `pnpm lighthouse`, `lighthouse:publish`, `lighthouse:deployed` in `package.json`.
  - **Proof:** `pnpm lighthouse` ran 12 audits (2 pages × 2 profiles × 3) and wrote `reports/lighthouse/{desktop,mobile}/manifest.json`; the summary shows `Google Chrome for Testing 156.0.8078.4` (Playwright's) as the browser.

- [x] **T02 — Summary** · PERF-02, PERF-07, PERF-08
  - `scripts/lighthouse-summary.ts` and the `--publish` copy step (design §3). Vitest `include` gains `scripts/**/*.test.ts`; `tsconfig.node.json` includes `scripts`.
  - **Proof:** `scripts/lighthouse-summary.test.ts` (7 tests: median of odd and even lists, per-category and per-metric medians, `kurio:` timings only, representative run, targets, rendered tables with environment and thresholds); `lighthouse/reports/summary.md` renders tables with targets, versions and conditions.

- [x] **T03 — App changes** · PERF-10 – PERF-13, PERF-15, PERF-16
  - `NftImage` props verified (design §4); `preloadCriticalAssets()` plugin (font preload + mock-chunk `modulepreload`); `public/robots.txt`; boot marks and shell-first boot (`main.tsx`, `lib/backend-ready.ts`, `mocks/url-params.ts`); vendor chunk groups; `tldts` alias.
  - **Proof:** `dist/index.html` has one `rel="preload" as="font"` for `roboto-mono-latin-wght-normal-*.woff2`, which exists in `dist/assets`; `modulepreload` for `browser-*.js` and its imports; `curl localhost:4173/robots.txt` returns the three lines as text; the LHRs list `kurio:mocks`, `kurio:mocks-chunk` and `kurio:mocks-worker` in `user-timings`; the details LCP `<img>` has `fetchpriority="high"`, `loading="eager"` and the 750 variant is requested at 412 px (`network-requests`); `src/lib/backend-ready.test.ts` (request held until the gate opens) and the unchanged mock/auth/realtime E2E (738 passed) cover PERF-15.
  - **Deviations:** first catalog card not eager (CAT-23, an E2E test enforces it); meta description stays the static default of `index.html` (design §9, decision 7).

- [x] **T04 — First runs and analysis** · PERF-05, PERF-09, PERF-14
  - First run: mobile Performance 72 / 71, SEO 92, desktop 97–98. Applied: `robots.txt`, shell-first boot, mock preload, vendor chunks, `tldts-experimental`; each step measured (analysis, "Before and after"). Reviewed against PERF-14: nothing disabled, no Lighthouse detection, no fixtures in HTML, no deferral past first paint.
  - **Proof:** `lighthouse/reports/analysis.md` has before/after values and a section for the one miss (mobile Performance 76), including the mock start-up cost and a mocks-off diagnostic labelled as such.

- [x] **T05 — Publish** · PERF-08
  - `pnpm lighthouse:publish`.
  - **Proof:** `lighthouse/reports/` holds `summary.{md,json}`, `analysis.md` and 8 report files (5.6 MB); `git check-ignore reports/lighthouse` matches, `git check-ignore lighthouse/reports` does not.

- [ ] **T06 — Deployed comparison** · PERF-04 · *blocked by B1*
  - Mechanism done and exercised against a local server in place of the deployed origin (`--deployed <url>` clears `startServerCommand`, writes `reports/lighthouse/deployed/`). Remaining: run it on the Vercel URL and add the numbers and their explanation to the analysis ("Local vs. deployed").

- [x] **T07 — Wrap-up**
  - Design §7 notes are for spec 14; spec 13 status and the amendments to specs 00, 01, 02 and 04 are in [`../README.md`](../README.md) and their documents.
  - **Proof:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` (no warning) and `pnpm test:e2e` (both projects) clean; see the run log.

## Run log (2026-10-28)

- Gate on the final code: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (60 files, 672 tests), `pnpm build` (no warnings), `pnpm test:e2e` (738 passed, 32 skipped by design, desktop-chromium and mobile-chromium, visual baselines from spec 12 unchanged).
- Audit: `pnpm lighthouse:publish` ran 12 Lighthouse runs (2 pages × 2 profiles × 3) on the optimized build. Accessibility, Best Practices and SEO are 100 everywhere; desktop Performance 98 / 99; mobile Performance 76 / 76 (target 90). The cause and what was tried are in `lighthouse/reports/analysis.md`. LCP: mobile 4.4 s (above 2.5 s), desktop 0.9–1.0 s. CLS 0. TBT: mobile 52–60 ms, desktop 0 ms.
- A mocks-off build (`VITE_ENABLE_MOCKS=false`, API failing) was measured once as a diagnostic only: mobile Performance 79–83, FCP 3.0 s. It is not part of the audit and was not kept.
- The first full E2E run after the shell-first boot failed one test: the grid test `only the first hero image is eager (CAT-23)`, which my first idea (priority on the first catalog card) broke. The idea was reverted.
- Pre-existing, found while changing `vite.config.ts`: `src/styles/no-raw-colors.test.ts` flagged `Emerald Ape #042` (comments and sample data) as hex colors on a fresh run. The regex now ignores a `#` after a word and a space.
- The unit test for the summary lives next to the script; the `--deployed` mechanism was run once against a local `vite preview` standing in for the deployed origin and the output deleted.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| PERF-01 | T01 | 12 runs: 6 per `lhci autorun`, one per config |
| PERF-02 | T01, T02 | Chromium pin; environment in `summary.md` |
| PERF-03 | T01 | Lighthouse default storage reset; the mock cost shows every run |
| PERF-04 | T06 | mechanism tested locally; deployed run pending B1 |
| PERF-05 | T01, T04 | median-run assertions in both configs; `--strict` |
| PERF-06 | T01, T02 | metric `warn` assertions; medians in the summary |
| PERF-07 | T02 | `summary.{md,json}` |
| PERF-08 | T02, T05 | `lighthouse/reports/` |
| PERF-09 | T04 | `analysis.md` |
| PERF-10 | T03 | `NftImage` review; 750 variant on mobile; E2E CAT-23 |
| PERF-11 | T03 | font preload in `dist/index.html` |
| PERF-12 | T03 | `robots.txt`; static description; SEO 100 |
| PERF-13 | T03, T04 | user timings in the LHRs; analysis table |
| PERF-14 | T04 | fix review in the analysis and design §5 |
| PERF-15 | T03 | `backend-ready.test.ts`; E2E mocks, auth, realtime |
| PERF-16 | Carried over | `pnpm build` prints no warning |
