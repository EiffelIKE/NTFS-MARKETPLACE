# 13 — Lighthouse · Requirements

> Status: Draft — see [Open questions](#open-questions). Scores depend on specs 05 and 06; the analysis section is written after the first real runs.

Audit home and NFT details with Lighthouse CI on the optimized build, in mobile and desktop profiles, three runs each, and report the median per category together with LCP, CLS and TBT. Commit the configuration, a summary and the representative reports, and explain every result below target with its cause. Optimizations must improve the real app; nothing is removed or faked only for the audit.

Brief coverage: §10 (home and details, mobile and desktop, optimized build, default mock scenario, three runs, medians, HTML/JSON reports, tool versions, environment, LCP/CLS/TBT, explanation of misses, no score-only simplifications), §12 (Lighthouse command).

## User stories

- **US-1** — As an evaluator, I run one command and get median scores and Core Web Vitals for each page and profile, plus the reports behind them.
- **US-2** — As an evaluator, I read why a score misses its target and what was done about it, with evidence from the reports.
- **US-3** — As a visitor on a mid-range phone, the home and details pages show their main artwork quickly and without layout jumps.

## Acceptance criteria

### Runs

- **PERF-01** — THE SYSTEM SHALL audit `/` and `/nfts/emerald-ape-042` on the production build served by `vite preview`, with mocks enabled and the `default` scenario, in a mobile profile (Lighthouse default mobile emulation and simulated throttling) and a desktop profile (`desktop` preset), three runs per page and profile.
- **PERF-02** — THE SYSTEM SHALL use a pinned Chromium (Playwright's) through `CHROME_PATH`, and SHALL record the Lighthouse, LHCI and Chromium versions, the OS, CPU, Node version, throttling settings and benchmark index of each run.
- **PERF-03** — THE SYSTEM SHALL start each run with cleared storage (Lighthouse default), so every run pays the first-visit cost, including Service Worker registration.
- **PERF-04** — THE SYSTEM SHALL also audit the deployed URL once per page and profile after each release, as a report-only comparison. *(Needs the user's Vercel deploy.)*

### Targets and metrics

- **PERF-05** — THE SYSTEM SHALL assert the brief's targets on the median run: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- **PERF-06** — THE SYSTEM SHALL record LCP, CLS and TBT for every run and report their medians, with reference thresholds LCP ≤ 2.5 s, CLS ≤ 0.1 and TBT ≤ 200 ms reported as warnings, not failures.

### Reports

- **PERF-07** — WHEN `pnpm lighthouse` finishes, THE SYSTEM SHALL write the HTML and JSON report of every run and a summary (`summary.md` and `summary.json`) with the medians per page × profile × category, the metric medians and the environment from PERF-02.
- **PERF-08** — THE SYSTEM SHALL commit the configuration, the summary and the representative (median) run's HTML and JSON for each page and profile in `docs/lighthouse/`. Raw run output stays git-ignored.
- **PERF-09** — WHEN a category or metric misses its target, THE SYSTEM SHALL document in `docs/lighthouse/analysis.md` the failing audits, their measured cost, the cause and the action taken or the reason none was taken.

### Optimizations without simplification

- **PERF-10** — THE SYSTEM SHALL serve NFT images through `srcset`/`sizes` with the 250/750/1000 variants (spec 02), explicit `width`/`height`, `fetchpriority="high"` and eager loading for the LCP image only, and lazy loading below the fold.
- **PERF-11** — THE SYSTEM SHALL preload the Latin subset of the self-hosted Roboto Mono font, so text does not wait on CSS discovery.
- **PERF-12** — THE SYSTEM SHALL serve a valid `robots.txt` and per-route meta descriptions, so SEO audits pass on the real routes.
- **PERF-13** — THE SYSTEM SHALL measure the mock layer's boot cost (worker registration and `worker.start`) with User Timing marks visible in the Lighthouse trace, and report it in the analysis.
- **PERF-14** — THE SYSTEM SHALL NOT disable mocks, images, fonts, realtime or features, nor detect Lighthouse, to raise a score.

## Out of scope

- Authenticated pages (cart, checkout): the brief asks only for home and details. *(Open question 1.)*
- Field data (CrUX/RUM) and a performance budget in CI.
- Server-side rendering or prerendering: the stack is a client-rendered SPA.

## Open questions

Each has a recommended default that applies unless the user decides otherwise.

1. **Extra pages** — recommended: home and details only. Alternative: add `/cart` with an LHCI `puppeteerScript` that logs in as Ana.
2. **Committed reports (PERF-08)** — recommended: commit only the median run per page × profile (8 files) plus the summary, under `docs/lighthouse/`; spec 00 keeps `reports/` ignored. Alternative: commit all 24 runs.
3. **LCP image preload** — the home LCP is the hero artwork, known only after the highlights request. Recommended: no hard-coded preload (it would couple the HTML to mock data), and rely on `fetchpriority`, early highlights prefetch in the route loader and a fast mock boot. Revisit if mobile Performance stays below 90 and the analysis shows the image request starts late.
4. **Deployed audit (PERF-04)** — recommended: run it once at delivery and include it in the analysis as a comparison. It is blocked until the user deploys to Vercel.
