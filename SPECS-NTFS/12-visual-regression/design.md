# 12 — Visual regression · Design

> Status: Draft — see [Open questions](requirements.md#open-questions).

Implements [`requirements.md`](requirements.md). No new npm dependencies: `toHaveScreenshot` is part of `@playwright/test` (spec 00). State comes from `window.__mock` (spec 02 §11).

## 1. Files

```
e2e/
  visual.spec.ts
  support/visual.ts           # prepare(), settle(), capture()
  support/visual.css          # injected during capture (stylePath)
  __screenshots__/
    desktop-chromium/visual.spec.ts/home.png …
    mobile-chromium/visual.spec.ts/home.png …
scripts/
  visual.sh                   # runs the suite in the Playwright container
```

## 2. Playwright config changes (amends spec 00 §10)

```ts
export default defineConfig({
  snapshotPathTemplate: 'e2e/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      stylePath: './e2e/support/visual.css',
    },
  },
  grepInvert: process.env.VISUAL ? undefined : /@visual/,
  // …spec 00 settings
})
```

- `{platform}` is left out of the template on purpose: baselines are only valid from the container (§6), so a single set per project is kept.
- `scale: 'css'` keeps the mobile baseline at 390 px wide even though the project uses `deviceScaleFactor: 3`, which keeps files small. The 750/1000 image variants still load because the device pixel ratio is unchanged; only the capture is downscaled.
- Tests are tagged `@visual`. Without `VISUAL=1` they are excluded, so `pnpm test:e2e` on a host never compares pixels (VR-12).

`visual.css`:

```css
::-webkit-scrollbar { display: none; }
* { scrollbar-width: none; }
#mock-panel-root { display: none !important; }
[data-sonner-toaster] { display: none !important; }
```

## 3. Preparing a screen (`support/visual.ts`)

```ts
const FROZEN = new Date('2026-10-27T12:00:00Z')

async function prepare(page, { as }: { as?: 'ana' }) {
  await page.clock.install({ time: FROZEN })
  await page.goto('/?reset=1')                       // default scenario, fresh seed
  await mock(page).configure({ latency: { kind: 'none' } })
  if (as) await loginAs(page, as)                    // spec 02 helper; stores the token like spec 04
}

async function settle(page) {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const img of document.images) img.loading = 'eager'
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})))
  })
  await expect.poll(async () => (await mock(page).requests()).filter(isInFlight).length).toBe(0)  // entry shape: spec 02 §11
}
```

- The clock is installed but not run forward, so a hero carousel stays on slide 1 and no settlement fires.
- `latency: none` removes the 120 ms default so captures are fast; loaded content is identical either way.
- Skeleton captures (VR-03) use `configure({ latency: { kind: 'fixed', ms: 60_000 } })` and skip `settle`, waiting instead for the `LoadingRegion` to be `aria-busy="true"` and fonts to be ready.

## 4. Screens and masks

| Name | Route | Session | Shots | Masks |
|---|---|---|---|---|
| `home` | `/` | guest | full page; mobile viewport | — |
| `home-loading` | `/` | guest | viewport | — |
| `details` | `/nfts/emerald-ape-042` | guest | full page; mobile viewport (buy bar) | — |
| `details-loading` | `/nfts/emerald-ape-042` | guest | viewport | — |
| `cart` | `/cart` | Ana | full page; mobile viewport (summary bar) | — |
| `checkout` | `/checkout` | Ana | full page; mobile viewport (confirm bar) | — |

No masks are expected: fixtures are deterministic, timestamps are fixed ISO strings and the clock is frozen. If a screen shows something derived from session creation (for example a session expiry time), the owner spec renders it from the frozen clock; if that is impossible, the region is masked here and listed in this table with its reason (VR-08).

Header state: guest screens show `Entrar`; Ana's screens show her avatar and the cart badge with her seeded cart count (spec 07 decides whether it counts lines or units), which is part of the baseline.

## 5. Tolerance

`maxDiffPixelRatio: 0.001` (about 1 300 px of a 1440 × 900 viewport, more on full pages) absorbs anti-aliasing noise; `threshold: 0.2` is Playwright's per-pixel YIQ default. A real regression (a moved block, a color change, a missing image) exceeds it by orders of magnitude. Per-test overrides are not allowed without a note in this section.

## 6. Container (VR-09, VR-12)

Host runs differ from CI in font hinting and sub-pixel rendering even with the self-hosted Roboto Mono, so baselines are generated and compared only in `mcr.microsoft.com/playwright:v<version>-noble`, where `<version>` is read from `node_modules/@playwright/test/package.json` so it always matches the installed runner.

`scripts/visual.sh [--update]`:

1. Picks `podman` or `docker` (open question 1).
2. Runs the image with the repo mounted at `/work`, `--ipc=host`, `-e VISUAL=1 -e CI=1`.
3. Inside, installs mise and runs `mise install` against the mounted `mise.toml` (Node 24.11.0, pnpm 10.34.3), so the container uses the same pins as the host. It then runs `pnpm install --frozen-lockfile` into a container-only `node_modules` volume (host binaries are not reused), then `pnpm exec playwright test --grep @visual` with `--update-snapshots` when requested. The `webServer` builds and previews inside the container.
4. The HTML report is written to the mounted `playwright-report/`.

Scripts (amend spec 00 §2):

| Script | Command |
|---|---|
| `test:visual` | `bash scripts/visual.sh` |
| `test:visual:update` | `bash scripts/visual.sh --update` |

Update workflow: run `test:visual:update`, open the report or `git diff --stat e2e/__screenshots__`, review each changed image against the Figma screenshot, then commit code and baselines together.

## 7. Tests (`e2e/visual.spec.ts`)

```ts
test.describe('@visual', () => {
  test('home', async ({ page }, info) => {
    await prepare(page, {})
    await page.goto('/')
    await settle(page)
    await expect(page).toHaveScreenshot('home.png', { fullPage: true })
    if (info.project.name === 'mobile-chromium') await expect(page).toHaveScreenshot('home-viewport.png')
  })
  // details, cart, checkout, *-loading follow the same shape
})
```

A guard test (not tagged) checks that the number of files in `e2e/__screenshots__/<project>/` equals the number of `toHaveScreenshot` names in the spec, so a stale or missing baseline is noticed on host runs too.

## 8. Notes for `ARCHITECTURE.md` (spec 14)

- Baselines are valid only from the Playwright container; host runs skip pixel comparison.
- Mobile captures are downscaled to CSS pixels.
- Visual tests run with zero mock latency and a frozen clock; skeleton captures use a long fixed latency.
