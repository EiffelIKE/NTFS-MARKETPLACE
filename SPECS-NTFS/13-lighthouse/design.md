# 13 — Lighthouse · Design

> Status: Final. The numbers and the analysis live in [`lighthouse/reports/`](../../lighthouse/reports/summary.md) and [`analysis.md`](../../lighthouse/reports/analysis.md); this file records how the audit is built and what was decided.

Implements [`requirements.md`](requirements.md). Builds on the spec 00 skeleton (§11 there: `lighthouse/{desktop,mobile}.json`, `@lhci/cli`, `pnpm lighthouse`) and spec 02's details URL `/nfts/emerald-ape-042`. One new dev dependency: `tldts-experimental` (§4).

## 1. Files

```
lighthouse/
  desktop.json  mobile.json        # LHCI configs (spec 00), completed here
  reports/                         # committed deliverable
    summary.md  summary.json       # medians, every run, environment, conditions
    analysis.md                    # causes of every miss, before/after
    {home,details}-{mobile,desktop}.report.{html,json}   # the median run of each group
scripts/
  lighthouse-run.ts                # build, run both configs, summary (Node type stripping, no tsx)
  lighthouse-summary.ts            # raw LHCI output -> summary.{md,json}; --publish copies to lighthouse/reports/
scripts/lighthouse-summary.test.ts # unit test (Vitest `include` gains scripts/**)
public/robots.txt
reports/lighthouse/{desktop,mobile}/ # git-ignored raw output (12 runs), summary.{md,json}
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
    "assert": {                                          // every assertion: median-run
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

- Mobile keeps Lighthouse's default emulation (Moto G Power class, 412 × 823 at 1.75 DPR, simulated 4× CPU slowdown, slow 4G). Desktop uses the `desktop` preset. Both use simulated (Lantern) throttling, so results depend less on the host's network.
- The default scenario is guaranteed because each run starts with empty storage (PERF-03): the mock DB seeds `default` on first load. The mock panel never shows without `?mockPanel=1` (spec 02 decision 2).
- `vite preview` serves HTTP/1.1 with gzip. Lantern models connection limits from the protocol of the recorded trace, so a many-chunk app looks slower locally than behind HTTP/2 (analysis §"Local vs. deployed").

## 3. Runner and summary (PERF-02, PERF-07, PERF-08)

`pnpm lighthouse` is `node scripts/lighthouse-run.ts` (amends spec 00 §2). `pnpm lighthouse:publish` adds `--publish`; `pnpm lighthouse:deployed <url>` adds `--deployed <url>`.

1. `pnpm build` (production, mocks on), unless `--skip-build` or `--deployed`.
2. `CHROME_PATH` is Playwright's Chromium (`chromium.executablePath()`, pinned by the lockfile) unless the caller sets it. It is exported to LHCI and read again by the summary for `--version`.
3. Deletes the previous raw output (LHCI appends, which would count stale runs), then runs `lhci autorun` for desktop and for mobile. A profile that misses its assertions makes `lhci` exit 1; the reports are written anyway, so the runner continues.
4. `lighthouse-summary.ts` reads every `*.report.json`, groups by page and profile, and writes `summary.json` and `summary.md`:
   - the median of **each category and each metric on its own** (LCP, CLS, TBT, FCP, SI), the values of every run, and the run closest to the median performance score and LCP, which is the one published;
   - the median of the `kurio:mocks*` User Timing measures (§5);
   - the environment: Lighthouse, `@lhci/cli`, browser (`chrome --version`), host user agent, benchmark index, Node, OS, CPU, memory, git commit; throttling and screen settings of both profiles; the execution conditions.
5. `--publish` copies the summary and the eight representative reports to `lighthouse/reports/`.
6. Exit code: non-zero when the build or the collection fails; a missed target only prints the list and exits non-zero under `--strict`. (Spec text said "non-zero if any failed"; with a known miss that would make the delivered command always fail, so the miss is reported by the summary and `--strict` opts in.)

`--deployed <url>` replaces `collect.url`, clears `startServerCommand`, writes to `reports/lighthouse/deployed/<profile>/` and a `summary.*` next to them (PERF-04). It is report-only and never published.

## 4. App changes this spec owns (PERF-10 – PERF-16)

| Change | Where | Note |
|---|---|---|
| `NftImage` props | `components/nft-image.tsx` (spec 05) | verified: `srcset` 250/750/1000, per-slot `sizes`, `width`/`height`, `decoding="async"`, lazy unless `priority`, `fetchpriority="high"` when `priority`; `priority` only on the first hero slide and the details main image. The first catalog card is deliberately not eager (CAT-23) |
| Font and mock-chunk preload | `preloadCriticalAssets()` in `vite.config.ts` (`transformIndexHtml`, `order: 'post'`) | `<link rel="preload" as="font">` for the Latin Roboto Mono subset; `modulepreload` for the `mocks/browser` chunk and the dependencies the entry does not already preload. Only emitted by the production build |
| `public/robots.txt` | `User-agent: *`, `Allow: /`, `Disallow: /dev/` | without it the SPA rewrite answers `/robots.txt` with HTML and Lighthouse's `robots-txt` audit fails (SEO 92 before) |
| Shell-first boot | `main.tsx`, `lib/backend-ready.ts`, `mocks/url-params.ts`, `mocks/browser.ts` | §5 |
| Boot marks | `main.tsx` | `kurio:mocks-start/loaded/ready` marks and `kurio:mocks-chunk`, `kurio:mocks-worker`, `kurio:mocks` measures, visible in the LHR `user-timings` audit (PERF-13) |
| Vendor chunks | `build.rolldownOptions.output.codeSplitting.groups` | `react` (react, react-dom, scheduler) and `tanstack` (router, query, store): long-lived, cacheable, and the entry chunk drops from 376 to 127 kB |
| Smaller public-suffix list | `resolve.alias: { tldts: 'tldts-experimental' }` | msw's cookie jar (tough-cookie) bundles tldts' 267 kB list. `tldts-experimental` has the same API and list in a compact encoding. Mock chunk: 511 → 351 kB (189 → 124 kB gzip). Cookie behavior is unchanged, so this is not a simplification |

Chunk warning (carried over from spec 01): before this spec `index-*.js` was 376 kB and the lazy `browser-*.js` 511 kB (the warning). After the alias the largest chunk is 351 kB, and the build prints no warning without touching `chunkSizeWarningLimit`.

## 5. Mock boot (PERF-13, PERF-15)

Before: `main.tsx` awaited `startMocks()` (download of the mock chunk, `setupWorker`, `worker.start()`) and only then rendered, so the first paint waited for ~190 kB gzip of mock code and the worker registration.

Now:

1. `main.tsx` takes `?scenario=`, `?reset=1` and `?mockPanel=1` synchronously (`takeMockUrlParams()`, a dependency-free module), so the URL is clean before the router's first render, and starts `import('@/mocks/browser').then(startMocks)`.
2. `holdBackendUntil(promise)` (`lib/backend-ready.ts`) records that promise. The Axios request interceptor and `createSocket` `await backendReady()`; with no mocks, or in unit tests, nothing is held. So no request can leave before the worker controls the page, which is what made spec 04 start the session restore after the worker (that order is now enforced by the gate, `bootApp()` still runs once).
3. The React tree renders at once. Skeletons, header and tab bar paint from the entry chunk; data components wait on their queries as usual.
4. If the worker fails to start, `root.render(<BootError />)` replaces the app (same behavior as before, no fake backend).
5. The mock chunk and its own dependencies are `modulepreload`ed from the HTML, so their download overlaps the entry chunk instead of starting after it runs.

What is left of the cost (analysis): the chain that produces the LCP image is still HTML → entry → mock chunk → `worker.start()` → API → image, and Lantern prices the transferred bytes of everything that loads before the first paint on a 1.6 Mbps link. Not allowed, and not done: skipping the worker during audits, inlining fixture data into the HTML, or deferring the mock chunk past the first paint just to lower FCP (it would move the cost into the LCP).

## 6. Analysis template (`lighthouse/reports/analysis.md`, PERF-09)

One section per miss: page, profile, category or metric, median value vs. target, the audits that explain it with their cost from the LHR, cause, what was done, and the result. Checked first: LCP element and request start, TBT sources (`bootup-time`), the bundle (`unused-javascript`, chunk sizes), CLS, Best Practices console errors, SEO audits, local vs. deployed differences.

## 7. Notes for `ARCHITECTURE.md` (spec 14)

- Audits run against `vite preview` with mocks on; the first-visit worker registration is part of every run.
- The app renders before the mock worker is ready; every request waits on `lib/backend-ready.ts`. Amends the "mocks before render" order of spec 02 §3.
- `robots.txt` exists because the SPA rewrite would otherwise answer it with HTML.
- The LCP image is not preloaded from HTML, because it is chosen by API data (decision 3).
- `tldts` is aliased to `tldts-experimental` for the mock bundle.
- `pnpm lighthouse` exits 0 on a missed target; `--strict` makes it fail.

## 8. Amendments to earlier specs

| Spec | Change |
|---|---|
| 00 §2 / §11 | `pnpm lighthouse` runs `scripts/lighthouse-run.ts`; `lighthouse:publish` and `lighthouse:deployed` added; `.gitignore` anchors `/reports` so `lighthouse/reports/` is tracked |
| 01 | The chunk-size warning is resolved (§4) |
| 02 §3 | Bootstrap order: shell first, requests held by `backend-ready` (§5); `startMocks(params)` takes the already-read URL params; `takeMockUrlParams()` moved to `mocks/url-params.ts` |
| 04 | The restore ordering is guaranteed by the gate instead of by awaiting the worker before render |
| 05 CAT-23 | Unchanged: the first catalog card stays lazy; the mobile LCP candidate is that card (analysis) |

## 9. Decisions

1. **Report location.** `lighthouse/reports/` next to the configs, not `docs/lighthouse/` (no `docs/` folder exists). The raw output stays in `reports/lighthouse/` (ignored; `.gitignore` entry anchored to the root).
2. **Which reports are committed.** The median run's HTML and JSON per page × profile (8 files, about 5 MB) and a `summary.json` with every run's scores and metrics. The other 16 files would add 10 MB and say nothing the summary does not.
3. **LCP image preload.** None: the artwork is chosen by API data, and a hard-coded preload would couple the HTML to the mock catalog (open question 3, default kept). Not revisited, because the analysis shows the delay is the boot chain, not the image request.
4. **Browser.** Playwright's Chromium via `CHROME_PATH` (pinned, same as E2E); a different binary can be passed in the environment.
5. **Medians.** Per category and per metric on its own, as the brief asks; the representative run is only used to pick the published report.
6. **Assertions.** Categories are `error` on the median run; LCP, CLS, TBT are `warn`. The runner does not fail on them unless `--strict`.
7. **Meta descriptions (PERF-12).** Only the default in `index.html`: TanStack's `HeadContent` appends route tags, which would leave two `description` tags in the document. SEO is 100 on both pages.
8. **Scripts in TypeScript.** `node scripts/*.ts` runs through Node 24's type stripping, so there is no build step or `tsx`; `tsconfig.node.json` includes `scripts` for type checking and lint, and Vitest's `include` gains `scripts/**/*.test.ts`. While wiring this, a fresh run of `src/styles/no-raw-colors.test.ts` reported six false positives (`Emerald Ape #042` in comments and sample data, which look like hex colors); the test now ignores a `#` that follows a word and a space.
9. **Deferring the mock chunk past first paint** to improve FCP was rejected (§5).
10. **Preloading the home route's lazy chunks** (a second request round after the entry chunk) was measured as not worth the coupling of the static HTML to one route; listed in the analysis as a next step.

## 11. Post-deploy fix: SW boot recovery

**Symptom (deployed app).** After a Lighthouse run from Chrome DevTools, normal browsing ended in a black screen, or in a page where some parts loaded and others stayed in a loading state; only "Clear site data" helped, and the next load showed the boot error `[MSW] Failed to register the Service Worker ... Operation has been aborted`, which F5 then cleared.

**Root cause.** Lighthouse and DevTools clear service workers and storage, and can leave a registration that does not control the page, a worker stuck in `installing` or `redundant`, or a half-written persisted database. The boot trusted `worker.start()` to settle, and it has no deadline:

1. MSW waits on the worker's `statechange` to `activated` and on the `MOCKING_ENABLED` reply with no timeout, so a worker that never activates left the shell-first gate (`backend-ready.ts`) pending and every request, queued behind it, never left. That is the "parts stay loading forever" state.
2. With a registration but no controller, MSW calls `location.reload()` and keeps going; if the controller never comes (bypass, a dropped worker) that is a reload loop, which looks like a black screen.
3. A start that succeeded did not mean the page was intercepted: with the worker bypassed or gone, requests reached the real server (the SPA rewrite answers `200 text/html`) and the catalog showed errors while the shell rendered.
4. A registration aborted by a clear (`Operation has been aborted`) rejected the start, and the error screen's button only called `location.reload()`, so it kept the dead registration.
5. `store.load()` accepted any JSON object with the right `schemaVersion`. A database with tables missing (`nfts`, `highlights`) loaded, and every handler that read it threw a 500 until the site data was cleared.

Reproduced locally on a production build: a database cut to `{ schemaVersion, seq }` made `nfts.list` and `highlights.get` answer 500 on every load; `Storage.clearDataForOrigin` (what Lighthouse does) while the app was open left `controller: null`, no registration and `/api/*` answered by the network as HTML; `Network.setBypassServiceWorker` gave 404s on every API call.

**Fix.**

- `lib/mock-recovery.ts` (no msw import, so the entry chunk and the error screen can use it): `withTimeout`, a reload guard (`sessionStorage`, one automatic reload per tab per 30 s, so recovery can never loop), `unregisterMockWorkers`, `hasOrphanedRegistration`, `pingMock`, `recoverOnce` and `bootWithRecovery`.
- `startMocks` (`mocks/browser.ts`) runs `bootWithRecovery`: a registration that does not control the page is unregistered before `worker.start()` (MSW then registers a fresh one in this load instead of reloading); `start()` has a 15 s deadline; after it, the boot **proves interception** with `GET /api/__mock/health` (answered by the worker with `x-kurio-mock: 1`, outside the pipeline: no latency, rules or log). On a timeout, an abort or a failed probe it unregisters the stale registrations and reloads once; if the guard already spent the reload, or the reload does not happen within 5 s, it rejects, so `main.tsx` shows the boot error screen. It always settles, and the gate rejects instead of holding requests forever.
- `watchMockWorker`: once the mock is up, the probe runs again on `controllerchange`, `focus`, `visibilitychange` and a bfcache restore (no timer), because a clear can take the worker from an open page. A failure goes through the same guarded recovery, then `main.tsx` shows the error screen.
- The error screen's "Recarregar página" calls `resetMockWorkerAndReload`: it releases the guard, unregisters the mock registrations (bounded) and then reloads.
- `db/validate.ts`: `store.load()` checks the shape the handlers rely on (sequences, every table, the rows' arrays and keys, `highlights`, `triggers`), not only the schema version, and reseeds with a log line when it is damaged. The persisted config ignores an `overrides` value that is not an object.

Shell-first behavior is unchanged: the shell still renders at once and requests wait on the gate. The probe adds one request answered by the worker after the start (no network). Entry chunk: 133 to 136 kB (41 kB gzip) from the recovery module, which the error screen imports.

**Tests.** `lib/mock-recovery.test.ts` (timeout, guard, recovery policy, boot outcomes, registrations, probe), `mocks/db/validate.test.ts` and new `store.load` cases, and `e2e/boot-recovery.spec.ts` (a cut-short database, a worker unregistered before a reload, a worker that never takes control: error screen, then the button recovers).

**For the deployment.** `vercel.json` already serves `/mockServiceWorker.js` with `Cache-Control: no-cache`; nothing else is required. `Service-Worker-Allowed` is not needed (scope `/`, script at the root).
