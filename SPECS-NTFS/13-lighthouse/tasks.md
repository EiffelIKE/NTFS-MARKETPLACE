# 13 — Lighthouse · Tasks

> Status: Draft — see [Open questions](requirements.md#open-questions).

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 05 and 06 are Done (spec 11 ideally too, since its fixes affect the Accessibility score).

## Blockers (user-provided)

- **B1 — Vercel deploy** for PERF-04 (T06). Every other task runs locally.

## Carried over

- **Build chunk warning (from spec 01).** `pnpm build` warns that `index-*.js` is over 500 kB (661 kB minified after spec 01; later specs add to it). Decide here between vendor chunk splitting (`build.rolldownOptions.output.codeSplitting`), lazy-loading heavy modules, or raising `chunkSizeWarningLimit` with a recorded reason, so the done gate runs with zero warnings again.

## Tasks

- [ ] **T01 — Configs and runner** · PERF-01 – PERF-03, PERF-05, PERF-06
  - Complete `lighthouse/{desktop,mobile}.json` (design §2); `scripts/lighthouse-run.mjs` with `CHROME_PATH` from Playwright; `pnpm lighthouse` points to it.
  - **Proof:** `pnpm lighthouse` runs 12 audits (2 pages × 2 profiles × 3) and writes `reports/lighthouse/{desktop,mobile}/manifest.json`; the LHRs show the Playwright Chromium version in `environment.hostUserAgent`.

- [ ] **T02 — Summary** · PERF-02, PERF-07, PERF-08
  - `scripts/lighthouse-summary.mjs` and the `--publish` copy step (design §3).
  - Unit test `scripts/lighthouse-summary.test.ts` (Vitest `include` gains `scripts/**/*.test.ts`) with three fixture LHRs: median picks the middle value per metric; environment fields present.
  - **Proof:** test passes; `summary.md` renders tables with targets and versions.

- [ ] **T03 — App changes** · PERF-10 – PERF-13
  - Verify `NftImage` props on hero and details; font preload plugin; `public/robots.txt`; per-route meta descriptions; boot marks; highlights prefetch (design §4).
  - **Proof:** `dist/index.html` contains one font preload pointing to an existing file; `curl localhost:4173/robots.txt` returns text; an LHR shows `kurio:mocks` in `user-timings`; in a mobile Lighthouse run the details page requests the 750 variant (`network-requests` audit).

- [ ] **T04 — First runs and analysis** · PERF-05, PERF-09, PERF-14
  - Run `pnpm lighthouse`, write `docs/lighthouse/analysis.md` per design §6 for each miss, apply fixes, re-run.
  - Review every fix against PERF-14.
  - **Proof:** `analysis.md` has one section per miss (or states that every target was met), each with before/after values.

- [ ] **T05 — Publish** · PERF-08
  - `node scripts/lighthouse-run.mjs --publish`.
  - **Proof:** `docs/lighthouse/` holds the summary, `analysis.md` and 8 report files; `reports/` stays ignored.

- [ ] **T06 — Deployed comparison** · PERF-04 · *blocked by B1*
  - `pnpm lighthouse:deployed <url>`; add the column and its explanation to the analysis.
  - **Proof:** summary shows local and deployed medians side by side.

- [ ] **T07 — Wrap-up**
  - Add design §7 notes to the spec 14 list. Update the spec 13 status in [`../README.md`](../README.md).
  - **Proof:** `pnpm lint`, `pnpm typecheck`, `pnpm test` clean.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| PERF-01 | T01 | 12 runs |
| PERF-02 | T01, T02 | Chromium pin; environment in summary |
| PERF-03 | T01 | default storage reset |
| PERF-04 | T06 | deployed column |
| PERF-05 | T01, T04 | median-run assertions |
| PERF-06 | T01, T02 | metric warnings; medians |
| PERF-07 | T02 | summary files |
| PERF-08 | T02, T05 | `docs/lighthouse/` |
| PERF-09 | T04 | `analysis.md` |
| PERF-10 | T03 | image variant check |
| PERF-11 | T03 | preload in `dist/index.html` |
| PERF-12 | T03 | `robots.txt`; meta descriptions |
| PERF-13 | T03, T04 | user timings; analysis |
| PERF-14 | T04 | fix review |
