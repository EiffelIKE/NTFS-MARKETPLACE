# Lighthouse analysis

Audit of the home (`/`) and NFT details (`/nfts/emerald-ape-042`) pages, mobile and desktop, three runs each, on the optimized build with mocks on and the `default` scenario. The numbers are in [`summary.md`](summary.md) (medians, every run, environment, conditions); the median run of each group is published next to it as `{home,details}-{mobile,desktop}.report.{html,json}`. Reproduce with `pnpm lighthouse` (spec 13, `SPECS-NTFS/13-lighthouse/`).

## Result

| Profile | Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | Home | **76** (target 90) | 100 | 100 | 100 | 4.42 s | 0.000 | 60 ms |
| Mobile | Details | **76** (target 90) | 100 | 100 | 100 | 4.38 s | 0.000 | 52 ms |
| Desktop | Home | 98 | 100 | 100 | 100 | 0.96 s | 0.000 | 0 ms |
| Desktop | Details | 99 | 100 | 100 | 100 | 0.90 s | 0.000 | 0 ms |

Fourteen of sixteen category targets are met. The two misses are **mobile Performance on both pages (76, target 90)**. Its cause is LCP and FCP under Lantern's simulated slow 4G and 4× CPU slowdown; CLS and TBT are fine. Mobile LCP is above the 2.5 s reference threshold (warning); CLS and TBT meet theirs everywhere. Desktop meets every target.

## Before and after this spec's changes

First run on the spec 12 code (median of three), then the final run:

| Profile | Page | Performance | SEO | LCP | FCP | TBT |
|---|---|---|---|---|---|---|
| Mobile | Home | 72 → 76 | 92 → 100 | 4.84 → 4.42 s | 3.85 → 3.69 s | 158 → 60 ms |
| Mobile | Details | 71 → 76 | 92 → 100 | 4.77 → 4.38 s | 3.85 → 3.77 s | 175 → 52 ms |
| Desktop | Home | 98 → 98 | 92 → 100 | 1.04 → 0.96 s | 0.82 → 0.73 s | 0 → 0 ms |
| Desktop | Details | 97–98 → 99 | 92 → 100 | 1.04 → 0.90 s | 0.84 → 0.76 s | 0 → 0 ms |

What changed it, each measured on its own with single runs before keeping it (±1 point of noise):

| Step | Mobile Performance | LCP | Kept |
|---|---:|---:|---|
| Baseline (spec 12) | 72 | 4.84 s | |
| `robots.txt` | 72 | | yes: SEO 92 → 100 (the SPA rewrite answered `/robots.txt` with HTML, so Lighthouse's `robots-txt` audit failed) |
| Shell renders before the mock worker + `modulepreload` of the mock chunk | 72 | 4.78 s | yes |
| Same without the mock `modulepreload` | 69–70 | 5.1 s | the preload is kept: it is worth 0.3 s of LCP |
| + `react` and `tanstack` vendor chunks | 74 | 4.74 s | yes (also long-lived cache entries) |
| + `tldts` → `tldts-experimental` (mock chunk 189 → 124 kB gzip) | **76** | **4.4 s** | yes |

## The miss: mobile Performance (76 vs 90)

**Metric scores (home, mobile median):** FCP 3.7 s scores 0.30 (weight 10 %), LCP 4.4 s scores 0.41 (25 %), Speed Index 3.7 s scores 0.85 (10 %), TBT 60 ms scores 0.99 (30 %), CLS 0 scores 1 (25 %). To reach 90 both FCP (about 2 s) and LCP (about 2.5 s) would have to fall by roughly half. TBT, CLS and Speed Index already score at or near the maximum.

**Cause 1, bytes and round trips before the first paint (the larger share).** Lantern prices a request chain on 1.6 Mbps with 150 ms RTT, and charges the CPU work at 4× slowdown. The home page loads 42 requests and 466 kB over the wire (413 kB of JavaScript, gzip). The largest transfers are the mock chunk 121 kB, `react` 66, entry 38, `tanstack` 37, `contracts` (Zod schemas) 34, the Latin font 32, Radix and floating-ui 26 + 11, Axios 19, CSS 14. Observed on the audit host, with no throttling, FCP is 0.26 s and LCP 0.54 s; the simulation turns the same 466 kB and the HTML → entry → lazy route chunk → render chain into 3.7 s and 4.4 s.

Diagnostic (not a deliverable, not scored): a build with `VITE_ENABLE_MOCKS=false` has no mock code at all, 350 kB transfer, and the API calls fail into error states. It still scores only **79–83 on mobile**, with FCP 3.0 s. So the application itself, with React, the router, Query, Zod and the Radix primitives of the shell, already caps mobile Performance near 80 under this throttling. The mock layer is the rest.

**Cause 2, the mock layer's start-up (reported honestly, see below).** It adds about 0.7 s to FCP (3.0 → 3.7 s) and puts the whole API chain in front of the LCP image: the image URL comes from `/api/…`, the request waits for the worker, and the worker waits for its chunk. In the LCP breakdown of the published home run, Load Delay is 3.4 s of 4.4 s (TTFB 0.45 s, Load Time 0.16 s, Render Delay 0.45 s): the image itself is cheap, its discovery is late.

**Cause 3, the LCP image is discovered late by design.** The LCP element is the first catalog card's artwork on phones (home) and the gallery image (details). Both come from API data, so they cannot be in the initial HTML, and a hard-coded preload would couple the HTML to the mock catalog (spec 13 decision 3). The details image already has `fetchpriority="high"` and `loading="eager"`. The first catalog card stays lazy because spec 05 (CAT-23) allows only the hero to be eager; Lighthouse reports `lcp-lazy-loaded` for it, but the request is not what is slow (Load Time 0.16 s).

### The mock layer's start-up cost (PERF-13)

User Timing measures from `main.tsx`, unthrottled, in `summary.md`:

| Page | Mock chunk (download + evaluation) | `worker.start()` (register + activate) | Total |
|---|---:|---:|---:|
| Home | 49 ms | 110 ms | 161 ms |
| Details | 47 ms | 46 ms | 91 ms |

The worker registration is the first-visit cost that every run pays (PERF-03). Throttled, the larger cost is the **bytes** (121 kB of mock code on a 1.6 Mbps link) and the evaluation of that chunk under the 4× CPU slowdown. What was done, without removing anything:

1. The shell renders before the mock layer is ready. Every request (REST and Socket.IO) waits on `lib/backend-ready.ts`, so none can miss the worker (PERF-15). This took the mock start out of the first paint; across these changes TBT fell from 158 to 60 ms.
2. The mock chunk and its dependencies are `modulepreload`ed from the HTML, so they download in parallel with the entry chunk instead of after it runs (about 0.3 s of LCP).
3. The mock chunk shrank from 511 to 351 kB (189 → 124 kB gzip) by aliasing `tldts` to `tldts-experimental`, the same public-suffix list and API in a compact encoding (used by msw's cookie jar). This also resolved the carried-over chunk-size warning without touching `chunkSizeWarningLimit` (PERF-16).

Rejected: skipping the worker during audits, inlining fixtures into the HTML, and starting the mock chunk after the first paint, which would lower FCP by moving the cost into the LCP (PERF-14).

### What was not done, and what would move the number

Estimated from the LHR and the diagnostics above, not applied here because each one trades complexity or assets for a gain that cannot reach 90 alone:

| Next step | Expected effect on mobile |
|---|---|
| Lazy-load what the first paint does not need: the `sonner` toaster, the Radix dropdown/tooltip/floating-ui primitives (the two largest `dist-*` chunks, 37 kB gzip together) | estimated FCP −0.3 s, about +2 points |
| Split `contracts` per resource so home loads only the catalog schemas (34 kB gzip today) | FCP −0.15 s |
| Stop splitting the home route (or preload its lazy chunks from the HTML): a second request round after the entry chunk | −1 RTT (0.15–0.3 s) on FCP and LCP, but the details page would then load home code |
| Generate a ~400 px image variant: `uses-responsive-images` reports 87 KiB of savings on the home grid because the 250/750/1000 set (spec 02) has nothing between 250 and 750 for a 168 CSS px card at 1.75 DPR | no score effect (after the LCP request starts), saves bandwidth |
| Drop the cookie jar from the mock bundle | not possible: msw requires `tough-cookie`, and its public-suffix list is still the largest part of the mock chunk |

The first two items together might add a few points. Even the diagnostic build without any mock code stops at 83, so reaching 90 on simulated slow 4G needs a much smaller first-paint bundle than React + router + Query + Zod + Radix allow here, plus the mock layer the brief requires for the audit.

## Other categories

- **Accessibility 100, Best Practices 100, SEO 100** on both pages and profiles, with no failing audit, so there is nothing to explain. Best Practices stays at 100 because the MSW worker runs `quiet` in production and there are no console errors; the diagnostic mocks-off build scores 96, presumably because its failed API calls log errors.
- **SEO** needed `public/robots.txt` (92 before). The meta description is the static default of `index.html` on every route; per-route copy was not added because the router would append a second `description` tag (design §9, decision 7).
- **CLS 0.000** on every run, including the 412 px mobile profile. The hero min-height shift that spec 11 noted on 376–384 px phones does not occur at Lighthouse's width.
- **TBT** is 0 ms on desktop and 52–60 ms on mobile (threshold 200 ms).

## Local vs. deployed (PERF-04)

These runs use `vite preview`: HTTP/1.1, gzip, no CDN, one origin. Lantern derives its connection model from the recorded protocol, so a 40-request waterfall on HTTP/1.1 is modeled with six parallel connections, where the deployed Vercel site serves HTTP/2 with Brotli. The deployed numbers are expected to differ, probably for the better on mobile, but they were not measured: the audit of the deployed URL (`pnpm lighthouse:deployed <url>`) waits for the user's Vercel deploy.

## Environment and conditions

Lighthouse 12.6.1, `@lhci/cli` 0.15.1, Google Chrome for Testing 156.0.8078.4 (Playwright's Chromium, headless), Node 24.11.0, Linux 7.2.11 on an i7-10750H with 31 GB (benchmark index about 2500). Mobile: 412×823 at 1.75 DPR, simulated slow 4G (150 ms RTT, 1.6 Mbps), 4× CPU slowdown. Desktop: `desktop` preset (1350×940, 40 ms RTT, 10 Mbps, no slowdown). Each run starts with empty storage and cache. Full list in `summary.md`.
