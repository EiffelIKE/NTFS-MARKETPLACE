# 13 — Lighthouse · Design

> Status: Draft — see [Open questions](requirements.md#open-questions). §6 lists likely causes to check first; the real analysis is written from the first runs.

Implements [`requirements.md`](requirements.md). Builds on the spec 00 skeleton (§11 there: `lighthouse/{desktop,mobile}.json`, `@lhci/cli`, `pnpm lighthouse`) and spec 02's change of the details URL to `/nfts/emerald-ape-042`. No new dependencies.

## 1. Files

```
lighthouse/
  desktop.json  mobile.json      # LHCI configs (spec 00), completed here
scripts/
  lighthouse-run.mjs             # resolves CHROME_PATH, runs both configs, then the summary
  lighthouse-summary.mjs         # reads reports/lighthouse/*/manifest.json + LHRs → summary.{md,json}
public/
  robots.txt
reports/lighthouse/{desktop,mobile}/   # git-ignored raw output (spec 00)
docs/lighthouse/
  summary.md  summary.json  analysis.md
  {home,details}-{desktop,mobile}.report.{html,json}
```

## 2. LHCI configuration (PERF-01 – PERF-06)

Both configs share:

```jsonc
{
  "ci": {
    "collect": {
      "startServerCommand": "pnpm preview --port 4173 --strictPort",
      "startServerReadyPattern": "Local",
      "url": ["http://localhost:4173/", "http://localhost:4173/nfts/emerald-ape-042"],
      "numberOfRuns": 3,
      "settings": { "chromeFlags": "--headless=new" }   // desktop adds "preset": "desktop"
    },
    "assert": {
      "aggregationMethod": "median-run",
      "assertions": {
        "categories:performance":    ["error", { "minScore": 0.90 }],
        "categories:accessibility":  ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo":            ["error", { "minScore": 0.90 }],
        "largest-contentful-paint":  ["warn",  { "maxNumericValue": 2500 }],
        "cumulative-layout-shift":   ["warn",  { "maxNumericValue": 0.1 }],
        "total-blocking-time":       ["warn",  { "maxNumericValue": 200 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": "reports/lighthouse/<profile>" }
  }
}
```

- Mobile keeps Lighthouse's default emulation (Moto G Power class, simulated 4× CPU slowdown, slow 4G). Desktop uses the `desktop` preset. Both use simulated throttling (the default), so results depend less on the host's network.
- The default scenario is guaranteed because each run starts with empty storage (PERF-03): the mock DB seeds `default` on first load.
- The mock panel and its launcher never show without `?mockPanel=1` (spec 02 decision 2), so they are not part of any audit.

## 3. Runner and summary (PERF-02, PERF-07, PERF-08)

`pnpm lighthouse` becomes `node scripts/lighthouse-run.mjs` (amends spec 00 §2):

1. `pnpm build` (production, mocks on).
2. Resolves Playwright's Chromium (`chromium.executablePath()` from `@playwright/test`) into `CHROME_PATH`, unless already set.
3. Runs `lhci autorun --config=lighthouse/desktop.json`, then mobile. Both are run even if the first fails assertions; the script exits non-zero at the end if either failed.
4. Runs `lighthouse-summary.mjs`, which reads each profile's `manifest.json` (LHCI marks the representative median run) and the LHR JSONs, and writes:
   - `summary.json`: per page × profile, the median category scores, median LCP / CLS / TBT / FCP / SI, the three raw values, and `environment` (`lighthouseVersion`, `environment.hostUserAgent`, `benchmarkIndex`, `configSettings.throttling`, `formFactor`, plus `os.release()`, `os.cpus()[0].model`, `process.version` and the `@lhci/cli` version);
   - `summary.md`: the same as tables, with ✅ / ❌ against targets.
5. With `--publish`, copies the summary and the representative reports to `docs/lighthouse/` under stable names (PERF-08).

`pnpm lighthouse:deployed <url>` runs the same configs with `collect.url` overridden to the deployed origin and no `startServerCommand`, writing to `reports/lighthouse/deployed-<profile>/`, and adds a "Deployed" column to the summary (PERF-04).

## 4. App changes this spec owns (PERF-10 – PERF-13)

| Change | Where | Note |
|---|---|---|
| `NftImage` component: `srcset` from `image.srcSet`, `sizes` per slot, `width`/`height`, `decoding="async"`, `loading="lazy"` unless `priority`, `fetchpriority="high"` when `priority` | the shared NFT image component (spec 05 creates it; this spec verifies the props) | `priority` only on the hero slide 1 image and the details main image |
| Font preload | small Vite plugin in `vite.config.ts` (`transformIndexHtml`, `enforce: 'post'`) that finds the emitted `roboto-mono-latin-wght-normal-*.woff2` asset in the bundle and injects `<link rel="preload" as="font" type="font/woff2" crossorigin>` | only the Latin subset; Latin Extended loads on demand |
| `public/robots.txt` | `User-agent: *` / `Allow: /` / `Disallow: /dev/` | without it, the SPA rewrite answers `/robots.txt` with HTML and the SEO audit fails |
| Meta description per route | each route's `head()` | spec 00 sets the default in `index.html` |
| Boot marks | `main.tsx`: `performance.mark('kurio:boot')`, `mocks:start`, `mocks:ready`, `app:render` and `performance.measure('kurio:mocks', 'mocks:start', 'mocks:ready')` | User Timing entries appear in the LHR (`user-timings` audit), so the summary can report the mock cost |
| Highlights prefetch | home route `loader` calls `ensureQueryData` for highlights | the hero image request starts as soon as the worker is ready |

## 5. Mock boot cost (PERF-13)

On a cold visit, `startMocks()` registers `mockServiceWorker.js`, waits for it to activate and control the page, then renders. Every API-driven element, including the LCP image, waits for that. The analysis reports:

- `kurio:mocks` duration (median per profile, from the LHR user timings);
- its share of LCP;
- whether the worker script was served with `no-cache` and compressed (spec 02 amends `vercel.json`).

Allowed mitigations, all of which keep the deliverable's behavior (the first one amends the spec 02 §3 bootstrap order): render the shell (header, skeleton regions) before `worker.start()` resolves and only hold API calls until ready; keep `mockServiceWorker.js` small and uncached-but-revalidated; lazy-load the mock panel (already the case). Not allowed: skipping the worker during audits or inlining fixture data into the HTML.

## 6. Analysis template (`docs/lighthouse/analysis.md`, PERF-09)

One section per miss: page, profile, category or metric, median value vs. target, the top failing audits with their savings from the LHR, cause, action, and the result after the action. Likely items to check first:

| Area | What to look at |
|---|---|
| LCP (mobile) | `largest-contentful-paint-element`; request start of the hero/details image relative to `mocks:ready`; image variant chosen (Lighthouse mobile emulates 412 px at 1.75 DPR, so the details image slot needs ~640 px and should load 750, not 1000) |
| TBT | main-thread work during boot: MSW start, Zod parsing of the catalog page, React render; `bootup-time` and `mainthread-work-breakdown` |
| Bundle | `script-treemap-data`: route chunks, devtools absence (spec 00), mock code chunk size |
| CLS | skeleton-to-content swaps (spec 01 sizing), font swap (metric-adjusted fallback, spec 01), image boxes |
| Best Practices | console errors (MSW is `quiet` in production), `errors-in-console`, `inspector-issues`, source maps |
| SEO | `robots-txt`, `meta-description`, `crawlable-anchors` (the out-of-scope links from spec 01 are not anchors), `link-text` |
| Local vs. deployed | compression, HTTP/2, cache headers; `vite preview` and Vercel differ, so both columns are explained |

## 7. Notes for `ARCHITECTURE.md` (spec 14)

- Audits run against `vite preview` with mocks on; the first-visit worker registration is part of every run.
- `robots.txt` exists because the SPA rewrite would otherwise answer it with HTML.
- The LCP image is not preloaded from HTML, because it is chosen by API data (open question 3).
