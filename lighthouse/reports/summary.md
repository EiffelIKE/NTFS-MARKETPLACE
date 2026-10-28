# Lighthouse audit

Generated 2026-10-28T20:07:07.195Z from commit `c3cf820+dirty`. Medians are taken per category and per metric over the runs of each page and profile; ✅ meets the brief's target (§10), ❌ misses it, ⚠️ is above the reference threshold for a Core Web Vital.

## Mobile (median of 3 runs)

| Page | Performance (≥ 90) | Accessibility (≥ 95) | Best Practices (≥ 95) | SEO (≥ 90) | LCP | CLS | TBT | FCP | SI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `http://localhost:4173/` | ❌ 76 | ✅ 100 | ✅ 100 | ✅ 100 | ⚠️ 4.42 s | 0.000 | 60 ms | 3.69 s | 3.69 s |
| `http://localhost:4173/nfts/emerald-ape-042` | ❌ 76 | ✅ 100 | ✅ 100 | ✅ 100 | ⚠️ 4.38 s | 0.000 | 52 ms | 3.77 s | 3.77 s |

## Desktop (median of 3 runs)

| Page | Performance (≥ 90) | Accessibility (≥ 95) | Best Practices (≥ 95) | SEO (≥ 90) | LCP | CLS | TBT | FCP | SI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `http://localhost:4173/` | ✅ 98 | ✅ 100 | ✅ 100 | ✅ 100 | 0.96 s | 0.000 | 0 ms | 0.73 s | 0.73 s |
| `http://localhost:4173/nfts/emerald-ape-042` | ✅ 99 | ✅ 100 | ✅ 100 | ✅ 100 | 0.90 s | 0.000 | 0 ms | 0.76 s | 0.76 s |

## Every run

| Profile | Page | Run | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mobile | home | 1 (published) | 76 | 100 | 100 | 100 | 4.48 s | 0.000 | 60 ms |
| mobile | home | 2 | 75 | 100 | 100 | 100 | 4.42 s | 0.000 | 139 ms |
| mobile | home | 3 | 77 | 100 | 100 | 100 | 4.32 s | 0.000 | 59 ms |
| mobile | details | 1 | 76 | 100 | 100 | 100 | 4.38 s | 0.000 | 68 ms |
| mobile | details | 2 | 76 | 100 | 100 | 100 | 4.38 s | 0.000 | 52 ms |
| mobile | details | 3 (published) | 76 | 100 | 100 | 100 | 4.38 s | 0.000 | 49 ms |
| desktop | home | 1 | 98 | 100 | 100 | 100 | 0.97 s | 0.000 | 0 ms |
| desktop | home | 2 | 98 | 100 | 100 | 100 | 0.96 s | 0.000 | 0 ms |
| desktop | home | 3 (published) | 98 | 100 | 100 | 100 | 0.96 s | 0.000 | 0 ms |
| desktop | details | 1 | 99 | 100 | 100 | 100 | 0.90 s | 0.000 | 0 ms |
| desktop | details | 2 | 99 | 100 | 100 | 100 | 0.90 s | 0.000 | 0 ms |
| desktop | details | 3 (published) | 99 | 100 | 100 | 100 | 0.90 s | 0.000 | 0 ms |

## Mock layer boot cost

User Timing measures from `main.tsx`, observed (not throttled) on the audit host, median over the runs. `chunk` is the download and evaluation of the lazy mock chunk, `worker` is `worker.start()` (registration and activation), `total` is both.

| Profile | Page | chunk | worker | total |
|---|---|---:|---:|---:|
| mobile | home | 49 ms | 110 ms | 161 ms |
| mobile | details | 47 ms | 46 ms | 91 ms |
| desktop | home | 52 ms | 143 ms | 193 ms |
| desktop | details | 46 ms | 45 ms | 90 ms |

## Execution conditions

- Build: `pnpm build` (Vite production build, minified, hashed assets), served by `vite preview` on `http://localhost:4173` (HTTP/1.1, gzip, no CDN).
- Mocks on (`VITE_ENABLE_MOCKS=true`, the default), scenario `default`, mock panel closed. Nothing is disabled for the audit.
- Each run starts in a fresh browser profile: empty storage, no cache, so every run registers the mock Service Worker (first visit).
- Mobile: Lighthouse default emulation (Moto G Power, 412×823 at 1.75 DPR, simulated slow 4G, 4× CPU slowdown). Desktop: the `desktop` preset (1350×940, simulated 40 ms RTT, 10 Mbps, no CPU slowdown). Both use simulated (Lantern) throttling.
- Three runs per page and profile, sequential, on an otherwise idle machine. Browser launched headless (`--headless=new`).

## Environment

| | |
|---|---|
| Lighthouse | 12.6.1 |
| Lighthouse CI (`@lhci/cli`) | 0.15.1 |
| Browser | Google Chrome for Testing 156.0.8078.4 |
| Host user agent | Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 |
| Benchmark index (CPU/memory) | 2512 |
| Node.js | v24.11.0 |
| OS | Linux 7.2.11-200.fc44.x86_64 (x64) |
| CPU | Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz × 12 |
| Memory | 31 GB |

- **mobile**: form factor `mobile`, 412×823 @ 1.75x, throttling `simulate` (rttMs 150, throughputKbps 1638, requestLatencyMs 563, downloadThroughputKbps 1475, uploadThroughputKbps 675, cpuSlowdownMultiplier 4)
- **desktop**: form factor `desktop`, 1350×940 @ 1x, throttling `simulate` (rttMs 40, throughputKbps 10240, requestLatencyMs 0, downloadThroughputKbps 0, uploadThroughputKbps 0, cpuSlowdownMultiplier 1)
