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

### Follow-up: recovery still fails after Lighthouse

The timeout screen was reported again after the first fix. A single tab audited from the DevTools
panel always came back, so the failure was reproduced by driving the real DevTools Lighthouse panel
(Chrome 156) with **a second tab of the site open**, which is the normal case in a real browser.

**Cause.** Lighthouse runs `Storage.clearDataForOrigin` (service workers included) before and after
the audit. The load it audits registers a fresh worker, and the worker's `clients.claim()` hands
every open tab to it. MSW's worker only mocks for a tab that sent it `MOCK_ACTIVATE`; any other tab
gets `passthrough`, so the claimed tab's requests reach the network (the SPA rewrite answers HTML).
That tab's watchdog then ran the boot recovery: it **unregistered** the worker and reloaded. Its
fresh worker claimed the first tab, whose watchdog did the same, and the tabs fought over the worker
until the reload guard ran out and both showed the error screen. An intermediate attempt that gave
each recovery its own script URL (`?recovery=<timestamp>`) made it worse: every tab then registered
a different script and replaced the others' worker.

**Fix.**
- The watchdog (a tab that booted fine, then stopped being mocked) reloads **without unregistering**.
  The reload activates the tab with the worker that now controls it and leaves the other tabs alone.
  It has its own guard (`kurio.mock.resync`, one reload per 10 s), so a boot recovery shortly
  before does not block it and it can never loop.
- The boot recovery is unchanged (unregister, then one guarded reload): a tab that cannot boot has
  a broken registration.
- The worker URL is always `/mockServiceWorker.js`.
- The "Recarregar página" button also spends the automatic reload, so a retry that still fails
  returns to the error screen without an extra reload. The error screen also suggests closing
  DevTools or turning off "Bypass for network", a debugging override that page code cannot change.

**Remaining gap.** The audited tab itself is unmocked for about a second after the run, because
Lighthouse's cleanup clears the worker under it. The panel then navigates the tab back to the
inspected URL, and F5 has the same effect; both boot normally.

**Tests.** `e2e/boot-recovery.spec.ts` "another tab that registers a fresh worker does not break
this one": two tabs, `Storage.clearDataForOrigin`, reload one, and both must be mocked again with no
error screen. It failed 3/3 before the fix. `lib/mock-recovery.test.ts` checks that the watchdog
reload leaves the registration alone and has its own guard, and that the button spends the
automatic reload.

## 12. Amendment: phone LCP images and "Agentic Browsing" (2026-10-29)

Two follow-ups after the owner ran Lighthouse 13.5 (Chrome 156 DevTools) on the deployed site: mobile Performance 86 deployed, with the "LCP request discovery" insight failing, and the new "Agentic Browsing" category at 50.

### 12.1 Phone LCP: eager, high-priority card images

**Finding.** On the 412 x 823 phone profile the first four catalog cards are in the first viewport (image tops at 385, 417, 652 and 684 px; the right column is offset by 32). The LCP is whichever of them paints first, so it varies between runs (the first card in every local run, the third in the owner's). Each was `loading="lazy"`, `fetchpriority="auto"`, and requested only after the JavaScript and the mock API had produced the card.

**Change.** `ProductGrid` passes `priority` (the existing `NftImage` prop: `loading="eager"`, `fetchpriority="high"`) to the first four cards when `(max-width: 767px)` matches (`useMediaQuery`). Nothing changes from `md` up: at 1350 x 940 the first row is partly visible, but the LCP there is the hero (`priority` already), and raising the cards would make them compete with it. `e2e/catalog.spec.ts` checks it in both projects: four eager and high on the phone project, none on desktop, and that nothing past the fourth card starts inside the first viewport. This supersedes the "first catalog card stays lazy" line of §8 (spec 05 CAT-23); the hero, the details gallery and these four cards are the eager images.

**Measured (local, `pnpm lighthouse` medians of 3, mobile home unless noted):**

| Build | Performance | LCP (simulated) | LCP request discovery | LCP (applied throttling, DevTools method) |
|---|---:|---:|---|---:|
| Before | 76 | 4.38 s | fetchpriority, discoverable, lazy: all fail | 5.69 s (score 66) |
| Priority only (**shipped**) | 73 | 4.52 s | fetchpriority and lazy pass, discoverable fails | 5.58 s (score 67) |
| + `<link rel="preload">` of the three artworks (750 w) | 70 | 5.12 s | all pass | 6.11 s (one trace) |
| + the same with a new 320 w variant (about 10 kB each) | 71-74 | 4.52 s | all pass | 5.65 s (one trace) |
| + preload of the first card only | 72-73 | 4.67 s | the LCP card is another one | |

CLS stays 0.000 in every run. Desktop is unchanged (home 98, LCP 1.01 s, the hero is the LCP element; details 99, LCP 0.92 s).

**Why the score does not rise, and why the preload was not kept.**

1. Lighthouse's simulated LCP (Lantern) builds its graph from every request that finishes before the observed LCP, except images with low priority. A lazy, auto-priority card image is low priority, so before this change the LCP image was left out of the estimate and the 4.38 s ended where the API chain ended. A high-priority image is counted: it is requested after the card renders (one more round trip, about 0.14 s), so honestly requesting it early lowers the simulated score by about 3 points and a better request cannot win it back.
2. The page is gated by the chain HTML, entry chunk, mock chunk, `worker.start()`, API, render (analysis.md, cause 2), at 1.6 Mbps. In the LCP breakdown the image's own load is 0.15-0.3 s of 4.4-5.7 s. A preload cannot shorten the chain; it can only put bytes in front of it, and it made the real, applied-throttling trace no better (one trace each: 6.11 s with 97 kB of images, 5.65 s with 30 kB, against 5.58 s without a preload).
3. A preload needs the image URLs in the HTML, so it needs a build step that runs the mock catalog code (`runnerImport` of `catalog.ts` and `catalog-query.ts` from the Vite config), a tiny inline script gated on `location.pathname === '/'`, no query string and a phone-sized viewport (the shared `index.html` serves every route), and, to be affordable, a new 320 w artwork. That is the coupling decision 3 of §9 refused, for no measurable gain. It was prototyped, measured and discarded; this section is the record, so it can be rebuilt if the delivery chain gets shorter (then the image request would be on the critical path).
4. What would move the number is unchanged: a smaller first-paint bundle and a shorter chain to the data (analysis.md, "What was not done"). Priority only is kept because it is what `lcp-lazy-loaded` and `prioritize-lcp-image` ask for, it costs nothing in an applied-throttling run, and it is the correct request for an image the user is looking at.

The "render-blocking requests" finding was measured and left alone: Lighthouse's audit estimates 0 ms of savings for the 14 kB stylesheet locally (the insight in the DevTools panel says 0 ms of LCP; its FCP figure assumes the first paint is not waiting for the entry script). The entry script does not execute before the stylesheet anyway, and it is bigger, so inlining or deferring the CSS would only risk a flash of unstyled skeleton and layout shift for no gain.

**For the owner after redeploying.** Compare mobile Performance against the 86 of the last deploy: Lantern should show the same small drop as locally (about 3 points), while the DevTools run should show the LCP image request starting with the card instead of lazily. If the drop is the whole story and you value the score more than the cleaner request, revert the commit `perf(home): ...` (one file and one test).

### 12.2 "Agentic Browsing" (Lighthouse 13.x)

The category has two failing audits on the site and both are the SPA rewrite answering `index.html` for files that did not exist.

| Audit | Requests (read from Lighthouse's gatherers) | Needs |
|---|---|---|
| `llms-txt` | `GET /llms.txt` | status below 400; at least one H1 (`/^\s*#\s+.+/m`), one Markdown link, 50+ characters; a 404 would make it not applicable |
| `ard-schema` | `GET /.well-known/ai-catalog.json`, unless `robots.txt` has an `Agentmap:` line, the HTML has `<link rel="ai-catalog">` or the response has a `Link: rel="ai-catalog"` header | JSON object with `specVersion: "1.0"` and an `entries` array (and nothing else at the root except `host`, whose `displayName` is required); each entry needs a `urn:air:` identifier, `displayName`, `type` and exactly one of `url` or `data` |

The audits' own JSON Schema is bundled in Lighthouse 13.5 (the one inside the chrome-devtools MCP), and it is stricter than the current text of agenticresourcediscovery.org, whose primary file is `/.well-known/ard.json` and whose `ai-catalog.json` is the predecessor consumers may still read. The project's own `lighthouse` package (12.6.1) has no such category, so the verification below uses the MCP tool.

**Added (static files in `public/`, copied by Vite, served before the Vercel rewrite):**

- `public/llms.txt`: an H1 (`KURIO`), a blockquote that says what the site is (a pt-BR demo, everything simulated, in-browser mock API, no backend, wallet or chain), the public pages (home and catalog, `/nfts/:id`) and the catalog's URL parameters with absolute links on `SITE_URL`, the sitemap, the ARD catalog and `robots.txt`. English, plain ASCII so that the `text/plain` response needs no charset. Not an inventory of NFTs: the data exists only after the page's JavaScript runs, which the file says.
- `public/.well-known/ai-catalog.json`: `specVersion` `1.0`, `host` (`KURIO`, documentation URL `/llms.txt`) and **`entries: []`**. The site has no agent card, MCP server or skill, so an entry would point agents at something that does not exist; an empty catalog is valid and honest. Dot-directories are copied by Vite (checked in `dist/`) and served by `vite preview`. Content types are the servers' defaults (`text/plain`, `application/json`), which both audits accept; no `vercel.json` header was added.
- `e2e/seo.spec.ts`: both files are served with the right type and are not the SPA fallback; `llms.txt` has the H1, a summary, absolute links on `SITE_URL` including the home, an NFT page and the catalog file; the catalog parses, has exactly `specVersion`, `host` and `entries`, and links back to `llms.txt`.
- README (en, pt-BR): the "if the public domain changes" list now includes both files.

**Verified (chrome-devtools MCP `lighthouse_audit`, mobile, local preview):** Agentic Browsing 50 before (`llms-txt` and `ard-schema` failing), **100** after (`llms-txt` 1, `ard-schema` 1, `agent-accessibility-tree` 1; the three `webmcp-*` audits are not applicable and WebMCP is not implemented). Accessibility, Best Practices and SEO stay 100.

**Not done on purpose.** `/.well-known/ard.json` (the spec's primary name; the audit only reads `ai-catalog.json`), `<link rel="ai-catalog">` in `index.html` and an `Agentmap:` line in `robots.txt` (the well-known URL is already the default), and any WebMCP tool.
