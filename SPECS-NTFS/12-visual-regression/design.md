# 12 — Visual regression · Design

> Status: Done.

Implements [`requirements.md`](requirements.md). No new npm dependencies: `toHaveScreenshot` is part of `@playwright/test` (spec 00). State comes from `window.__mock` (spec 02 §11).

## 0. Decisions that amend the draft

- **No container.** The draft rendered baselines in `mcr.microsoft.com/playwright`. The project owner's decision is to generate them on Linux (Fedora) with the Chromium that Playwright installs, and to document that other OSes may render differently, which is the usual Playwright caveat. `scripts/visual.sh` and the Podman/Docker question are gone.
- **Platform in the file name.** `{platform}` is part of the path template, so a macOS or Windows run fails on "missing baseline" instead of on anti-aliasing noise, and a second platform's baselines can be added next to the Linux ones.
- **Visual tests run in the normal `pnpm test:e2e`** (no `VISUAL=1` gate): on the supported platform they are stable, and the brief asks for them inside the E2E suite. `test:visual` runs only them (`--grep @visual`).
- **No count guard test.** With platform-tagged files, a guard that compares file counts would fail on any other OS for the wrong reason; a missing baseline already fails the run.
- **No viewport shot for cart and checkout on mobile**: the full-page capture is 390 × 844 already, so a second PNG would be byte-identical.

## 1. Files

```
e2e/
  visual.spec.ts
  support/visual.ts           # prepare(), settle(), settleLoading()
  support/visual.css          # injected while capturing (stylePath)
  __screenshots__/
    desktop-chromium/home-linux.png …
    mobile-chromium/home-linux.png …
```

16 PNGs, about 4 MB: desktop `home`, `details`, `cart`, `checkout`, `home-loading`, `details-loading`; mobile the same six plus `home-viewport` and `details-viewport`.

## 2. Playwright config (amends spec 00 §10)

```ts
snapshotPathTemplate: 'e2e/__screenshots__/{projectName}/{arg}-{platform}{ext}',
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.001, threshold: 0.2,
    animations: 'disabled', caret: 'hide', scale: 'css',
    stylePath: './e2e/support/visual.css',
  },
},
```

- `scale: 'css'` keeps the mobile baseline at 390 px wide even though the project uses `deviceScaleFactor: 3`, which keeps files small.
- The existing `trace: 'retain-on-failure'`, `screenshot`, `video` and the HTML reporter apply to visual tests too: a failure leaves expected, actual and diff in `playwright-report/` and a trace in `test-results/`.
- `.gitignore` ignores `playwright-report`, `test-results` and `figma_tokens/screenshots/`, and not `e2e/__screenshots__/`.

`visual.css` hides scrollbars, the dev mock panel and the sonner toaster.

## 3. Preparing a screen (`support/visual.ts`)

`prepare(page, { as?, latency? })`:

1. `page.clock.install({ time: FROZEN })` (2026-10-27T12:00:00Z) before any navigation, then `page.clock.setFixedTime(FROZEN)` so `Date` never moves while timers keep running. Reduced motion is emulated.
2. `goto('/?reset=1')`, wait for `__mock`, drop any stored session, then `configure({ latency })`: `none` for loaded screens, a fixed one hour for skeletons.
3. For `as: 'ana'`, `loginAs` writes her session where the app reads it; the test then navigates to the screen.

`settle(page)`, for loaded screens: waits for `__mock`, for the realtime connection (its first connect refetches the catalog and dims it with `data-outdated`, which caused a 1-in-40 flake before it was awaited), for no `[aria-busy="true"], [data-outdated]`, then `document.fonts.ready`, forces every image eager and decodes it, and polls the mock request log until nothing is `pending`.

`settleLoading(page)`, for skeletons: waits for `__mock`, then advances the page clock in 200 ms steps until a busy region is visible (the router shows a route's pending view after `pendingMs`, 150 ms of page time), then waits for fonts. Latency is never reached, so the skeleton cannot resolve.

Two findings that shaped this:

- Playwright's clock does not advance by itself after `install`; timers only fire on `runFor`. With latency `none` this does not matter (the mock does not wait).
- `setFixedTime` is not applied to skeleton tests: the router's pending delay reads `Date.now`, so with a pinned date the details skeleton never appears. Skeletons show no dates.

## 4. Screens and masks

| Name | Route | Session | Shots | Masks |
|---|---|---|---|---|
| `home` | `/` | guest | full page; mobile also viewport | none |
| `home-loading` | `/` | guest | viewport | none |
| `details` | `/nfts/emerald-ape-042` | guest | full page; mobile also viewport | none |
| `details-loading` | `/nfts/emerald-ape-042` | guest | viewport | none |
| `cart` | `/cart` | Ana | full page | none |
| `checkout` | `/checkout` | Ana | full page | none |

No masks: fixtures are deterministic, the clock and `Date` are fixed, and nothing in these screens depends on session creation time. Header state is part of the baseline: guest screens show `Entrar`.

## 5. Tolerance

`maxDiffPixelRatio: 0.001` absorbs anti-aliasing noise; `threshold: 0.2` is Playwright's per-pixel default. Stability: 144 runs of the 12 tests (`--repeat-each=6` at 8 and at 3 workers) passed after the `settle` fix. Sensitivity (T04): changing `--color-text-accent` failed 8 of 12 tests and a `py-3` → `py-5` change in the cart line card failed the mobile cart, each with expected, actual, diff and trace. Per-test overrides are not allowed without a note here.

## 6. Platform caveat and workflow

Baselines were generated on Linux (Fedora, Chromium from Playwright, locale `pt-BR`, timezone UTC, self-hosted Roboto Mono). Font hinting and sub-pixel rendering differ between operating systems and, less often, between Chromium versions, so on macOS or Windows the run reports missing `-darwin` / `-win32` baselines. Generate them there with `pnpm test:visual:update` if needed; the Linux ones stay untouched. After a Playwright upgrade, regenerate and review.

| Script | Command |
|---|---|
| `test:visual` | `playwright test --grep @visual` |
| `test:visual:update` | `playwright test --grep @visual --update-snapshots` |

Run `pnpm build` first when `src/` changed: the suite reuses a server already on 4173. Update workflow: `pnpm test:visual:update`, review `git diff --stat e2e/__screenshots__` and the images, commit code and baselines together.

## 7. Tests (`e2e/visual.spec.ts`)

One `test.describe('@visual')` with `home`, `home loading`, `details`, `details loading`, `cart`, `checkout`, using the console-error `test` from `support/test`. Each test starts from a new context (Playwright default) and `prepare`.

## 8. Notes for `ARCHITECTURE.md` (spec 14)

- Baselines are tagged by platform and were generated on Linux; other OSes need their own.
- Mobile captures are downscaled to CSS pixels.
- Visual tests run with zero mock latency and a pinned clock; skeleton captures use a one-hour latency and advance the clock only until the pending view shows.
- `pnpm test:visual:update` regenerates; review the diff before committing.
