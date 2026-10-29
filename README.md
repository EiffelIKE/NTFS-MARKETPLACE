# KURIO — NFT Marketplace

**English** · [Português (Brasil)](README.pt-BR.md)

A frontend-only NFT marketplace for the KURIO challenge: catalog with search, filters and sorting, NFT details, favorites, cart with coupons, checkout with a simulated wallet, order receipt and a simulated block explorer, profile and wallets, and realtime price, availability and order updates over Socket.IO. React 19, TypeScript, TanStack Router and Query, Axios, Zod, MSW, Tailwind v4 with shadcn/ui, Playwright and Lighthouse. There is **no backend**: the REST API and the Socket.IO server are simulated in the browser (MSW), so the same build runs anywhere, offline included.

- **Live demo:** <https://ntfs-marketplace.vercel.app/>
- **Repository:** <https://github.com/EiffelIKE/NTFS-MARKETPLACE>
- **How it is built and why:** [`ARCHITECTURE.md`](ARCHITECTURE.md) (contracts, realtime, cache policy, deviations from Figma and the brief, limitations). The spec-by-spec design record is in [`SPECS-NTFS/`](SPECS-NTFS/README.md).
- **Português (Brasil):** [`README.pt-BR.md`](README.pt-BR.md) and [`ARCHITECTURE.pt-BR.md`](ARCHITECTURE.pt-BR.md). English is the source of truth.

![KURIO home on desktop](docs/screenshots/home-desktop.png)

## Quick start

With [mise](https://mise.jdx.dev) (installs the pinned Node 24.11 and pnpm 10.34.3):

```sh
mise install
pnpm install --frozen-lockfile
pnpm dev
```

Without mise: install Node 24.11 (`>=24.11 <25`), run `corepack enable` so `packageManager` selects pnpm 10.34.3, then the last two commands. Open <http://localhost:5173>. Mocks are on by default; there is nothing else to start. The first visit registers the mock Service Worker (it needs `localhost` or HTTPS), so wait for the catalog to appear.

Run the production build locally with `pnpm build && pnpm preview` (<http://localhost:4173>).

### Demo accounts

All data is fictitious (`.example` is a reserved domain, no address reaches anyone). The passwords live only here and in the test fixtures, not in the production bundle.

| Account | Email | Password | Shows |
|---|---|---|---|
| Ana Souza | `ana@kurio.example` | `Kurio#Ana2026` | full profile, two wallets, favorites, a filled cart, a confirmed order `ord_000001` (receipt and explorer) |
| Bruno Lima | `bruno@kurio.example` | `Kurio#Bruno2026` | one wallet, empty cart; opening Ana's order gives 403 |
| Carla Mendes | `carla@kurio.example` | `Kurio#Carla2026` | no wallets: checkout asks to register one |

Or create your own account at `/signup` (the password needs 8+ characters with a letter and a digit). The sign-up conflict case is signing up with `ana@kurio.example`.

### Environment variables

Copy `.env.example` to `.env.local` to change them; all have defaults. They are validated at startup (`src/lib/env-schema.ts`), so a typo fails fast with the variable's name.

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | non-empty string | `/api` | REST base URL. MSW intercepts this same path, so one build works mocked or against a real API |
| `VITE_API_TIMEOUT_MS` | positive integer | `10000` | Axios timeout |
| `VITE_ENABLE_MOCKS` | `true` or `false` | `true` | The MSW mock API. With `false` the build contains no mock code (there is no real backend, so the default is `true`) |
| `VITE_REALTIME_URL` | absolute URL | `wss://realtime.kurio.example` | Socket.IO endpoint (WebSocket only). With mocks on, MSW answers it inside the page; nothing leaves the browser |
| `VITE_ENABLE_DEV_ROUTES` | `true` (build time only) | off in builds, on in `pnpm dev` | Keeps the developer harness pages `/dev/ui-kit` and `/dev/realtime`. The Vercel build leaves them out; the Playwright web server sets it |

## Scenarios and reset

The mock environment has named scenarios, each a reproducible combination of data, latency and failures. Pick one:

- **URL:** `/?scenario=<id>` on any route (the parameter is consumed and removed from the address bar). `/?reset=1` reseeds the active scenario.
- **Panel:** `/?mockPanel=1` or `Alt+Shift+M` opens "Simulação da API": scenario list, network conditions (latency, offline, realtime off), payment outcome, wallet and data reset.
- **Console:** `window.__mock`: `useScenario(id)`, `reset()`, `configure(patch)`, `addRule(rule)`, `clearRules()`, `expireSessions()`, `updateNft(id, patch)` (a price or stock change "on the server"), `settleOrder(id, 'confirmed' | 'declined')`, `disconnectWallet()`, `realtime.drop() / restore() / redeliver(n) / inject(event)`, `requests()`, `snapshot()`.

The scenario table below is generated from `src/mocks/scenarios.ts` (`pnpm docs:update` refreshes it; `pnpm test` fails when it is stale).

<!-- generated:scenarios -->

| Scenario | Name in the panel | Effect | Seed |
|---|---|---|---|
| `?scenario=default` | Padrão | Tudo funciona, com latência de 120 ms. É o cenário da auditoria Lighthouse. | `default` |
| `?scenario=empty` | Catálogo vazio | Nenhum NFT no catálogo, para o estado de resultado vazio. | `empty-catalog` |
| `?scenario=slow` | Rede lenta | Toda resposta demora 2,5 s, para ver skeletons e estados de carregamento. | `default` |
| `?scenario=jitter` | Latência variável | Respostas entre 150 ms e 2,5 s, sempre na mesma sequência. | `default` |
| `?scenario=out-of-order` | Respostas fora de ordem | Na listagem de NFTs, a segunda chamada responde antes da primeira. | `default` |
| `?scenario=offline` | Sem conexão | Toda chamada falha como se não houvesse rede, e o tempo real fica indisponível. | `default` |
| `?scenario=errors-then-recover` | Falhas temporárias | Catálogo, detalhe, carrinho e destaques falham 3 vezes com 503 e depois voltam. | `default` |
| `?scenario=rate-limited` | Limite de requisições | A listagem de NFTs responde 429 (limite de requisições) 3 vezes e depois volta ao normal. | `default` |
| `?scenario=server-down` | Servidor indisponível | Toda chamada responde 500. | `default` |
| `?scenario=session-short` | Sessão curta | A sessão expira 60 s depois do login. | `default` |
| `?scenario=payment-declined` | Pagamento recusado | Pedidos são recusados 3 s depois de criados. | `default` |
| `?scenario=payment-manual` | Pagamento manual | Pedidos ficam pendentes até serem liquidados pelo painel ou por `__mock.settleOrder`. | `default` |
| `?scenario=pending-order` | Pedido pendente | A Ana já tem um pedido pendente, para testar a recuperação. | `pending-order` |
| `?scenario=order-timeout` | Timeout após criar pedido | A primeira criação de pedido é gravada, mas a resposta nunca chega. | `default` |
| `?scenario=price-change-on-checkout` | Preço muda no checkout | O preço do primeiro item do carrinho sobe 10% ao confirmar o pedido. | `default` |
| `?scenario=sold-out-on-checkout` | Esgota no checkout | O primeiro item do carrinho esgota ao confirmar o pedido. | `default` |
| `?scenario=wallet-reject` | Carteira recusa conexão | A conexão com a carteira é recusada. | `default` |

<!-- /generated:scenarios -->

**Reset.** Switching to a scenario reseeds the database and clears overrides (selecting the scenario that is already active does nothing: use reset). Reset with `/?reset=1`, the panel's data reset or `__mock.reset()`; a scenario switch or reset needs a page reload and signs everyone out (the mock drops its sessions). **Persistence:** the mock database and config live in this browser's `localStorage` (`kurio.mock.db`, `kurio.mock.config`), so each browser profile has its own and a reload keeps your changes. A private window or "Clear site data" starts from the seed.

## Reproducing failure flows

Every flow below has an automated E2E test, listed in the last column; the steps are what to do by hand. Scenario ids are in the table above. Sign in as Ana unless noted.

| Flow | Trigger and steps | Expected | E2E |
|---|---|---|---|
| Empty catalog | Open `/?scenario=empty` | "Nenhum NFT disponível no momento" instead of cards; filters on a normal catalog that match nothing show "Nenhum NFT encontrado" | `loading-states`, `catalog` |
| Slow network, skeletons | `/?scenario=slow` (2.5 s per call) or `jitter` (150 ms to 2.5 s), then navigate | Nine skeleton cards in a busy region, replaced at the same size; details, cart and checkout have their own skeletons | `loading-states` |
| Out-of-order responses | `/?scenario=out-of-order`, type quickly in the search box | The list shows the result of the **last** search, never the slow first one | `catalog` |
| Offline, then recovery | `/?scenario=offline` (every call fails, realtime is off); then panel → "Padrão" | Error alert with "Tentar novamente"; after the scenario changes, retry loads the data | `loading-states`, `mocks` |
| 5xx with retry recovery | `/?scenario=errors-then-recover` (catalog, details, cart and hero answer 503 three times) | The query retries twice, shows the alert, and "Tentar novamente" recovers | `loading-states` |
| 4xx (rate limit) | `/?scenario=rate-limited` (the list answers 429 three times) | The alert carries the API's own message; retry recovers | `loading-states` |
| Server down | `/?scenario=server-down` (everything answers 500) | Route error views and inline alerts; nothing renders stale data as fresh | `mocks`, `smoke` |
| Session expiry with resume | `/?scenario=session-short` (60 s), or `__mock.expireSessions()` while on checkout | Redirect to `/login?redirect=…` with an "expired" notice; signing in again returns to the same page, and the checkout draft is still there | `auth`, `checkout-failures` |
| Unauthorized, forbidden | Signed out, open `/profile`; as Bruno, open `/orders/ord_000001` | Redirect to login with the way back; a 403 view with no order data | `auth`, `receipt` |
| Sign-up conflict, validation | Sign up with `ana@kurio.example`; submit forms empty | Field error from the API; focus on the first invalid field | `auth`, `account` |
| Invalid, expired coupon | In the cart, apply `NAOEXISTE`, then `VERAO25`; `KURIO10` and `COLECAO05` (needs 0.50 ETH) are valid | "Cupom inválido." / "Este cupom expirou." under the field, typed code kept | `cart` |
| Price change or sold out during checkout | `/?scenario=price-change-on-checkout` or `sold-out-on-checkout`, then pay; or, with Ana's cart open, run `__mock.updateNft('emerald-ape-042', { price: '9.99' })` (it is in her cart) | The review shows the new values and requires "Aceitar novos valores" (or blocks sold-out lines); the open cart updates and the total follows | `realtime-checkout`, `checkout-failures` |
| Timeout after order creation | `/?scenario=order-timeout`, then pay | "Tentar novamente reenvia o mesmo pedido: você não paga duas vezes"; retry lands on the **same** order | `checkout-failures` |
| Declined payment | `/?scenario=payment-declined` (declines 3 s after creation), then pay | "Pagamento recusado", cart untouched, "Tentar novamente" reopens the form | `checkout-failures` |
| Manual (pending) payment | `/?scenario=payment-manual`, pay, then panel → "Confirmar pedidos pendentes" (or `__mock.settleOrder(id, 'confirmed')`) | Order stays pending until settled; it then confirms through `order.updated` | `realtime-checkout` |
| Pending order after reload or disconnect | `/?scenario=pending-order` (Ana has a pending order), reload on checkout; or `__mock.realtime.drop({ block: true })` then `restore()` | Checkout shows the pending order and waits; after reconnecting the status updates (events or the 5 s poll) | `realtime-resilience` |
| Duplicate or old events | `__mock.realtime.redeliver(3)`; `__mock.realtime.inject({ …old version… })` with `/dev/realtime` (dev server) to watch outcomes | No double toast or flicker; the guard drops them as duplicate or stale | `realtime-resilience` |
| Wallet rejects or drops the connection | `/?scenario=wallet-reject`, go to checkout, open the review, press "Conectar"; for a drop: connect, then `__mock.disconnectWallet()` and press pay | "A carteira recusou a conexão." with payment disabled; after `__mock.configure({ walletConnect: { outcome: 'approve' } })`, "Tentar novamente" connects. A dropped wallet shows "Carteira desconectada" and asks to reconnect | `checkout-failures` |
| Simulated block explorer | Open Ana's receipt `/orders/ord_000001` → "Ver no Etherscan" | The in-app page `/explorer/ethereum/tx/<hash>` (banner "Explorador simulado"), same tab, Back returns to the receipt. No external link is involved | `explorer` |
| Not found | `/nao-existe`, `/nfts/abc`, an unknown explorer hash | "Página não encontrada" (HTTP is 200: SPA fallback) or the details 404 view; the URL stays as typed | `smoke`, `nft-details`, `explorer` |
| Favorite fails | On any page run `__mock.addRule({ op: 'favorites.add', effect: { kind: 'http', status: 500, code: 'INTERNAL' }, times: 1 })`, then click a heart | The heart flips at once, rolls back, and a toast offers "Tentar novamente" | `favorites` |

## Commands

| Command | What it does | Output |
|---|---|---|
| `pnpm dev` | Vite dev server with mocks, port 5173 | — |
| `pnpm build` | `tsc -b` then the production build | `dist/` |
| `pnpm preview` | Serves `dist/`, port 4173 | — |
| `pnpm typecheck` | `tsc -b` | — |
| `pnpm lint` | ESLint, zero warnings | — |
| `pnpm format` / `pnpm format:check` | Prettier write / check | — |
| `pnpm test` | Vitest unit and contract tests (including the docs checks) | — |
| `pnpm test:e2e` | Playwright, desktop and mobile Chromium; builds and previews itself | `playwright-report/`, `test-results/` |
| `pnpm test:e2e:report` | Opens the last HTML report | — |
| `pnpm test:visual` | Only the visual-regression tests | `e2e/__screenshots__/` (baselines) |
| `pnpm test:visual:update` | Regenerates the visual baselines | `e2e/__screenshots__/` |
| `pnpm lighthouse` | Builds and audits home and details, mobile and desktop, 3 runs each | `reports/lighthouse/` |
| `pnpm lighthouse:publish` | The same, and copies the summary and median runs | `lighthouse/reports/` |
| `pnpm lighthouse:deployed <url>` | Audits a deployed origin (report only) | `reports/lighthouse/deployed/` |
| `pnpm docs:update` | Regenerates the tables of this README, `ARCHITECTURE.md` and their pt-BR copies from code | edits all four files |

`pnpm docs:update` sets an environment variable inline, so on Windows run it from Git Bash or WSL.

## Tests

- **First run:** E2E needs Playwright's browser once: `pnpm exec playwright install chromium`.
- **Unit and contract:** `pnpm test`. Contract tests call the real Axios client against `msw/node`.
- **E2E:** `pnpm test:e2e` runs against the optimized build (the Playwright web server runs `pnpm build` and `vite preview` on port 4173, with `VITE_ENABLE_DEV_ROUTES=true`, and reuses a server that is already running). **Playwright's default parallelism can overload a small machine; add `--workers=3`:** `pnpm test:e2e --workers=3`. One project: `pnpm test:e2e --project=mobile-chromium`; one file: `pnpm test:e2e e2e/cart.spec.ts`. A server left over from a plain `pnpm build` has no `/dev/*` pages, so a few tests fail with not-found: stop it and let Playwright start its own.
- **Report and traces:** `pnpm test:e2e:report`; a failing test keeps a trace, screenshot and video. Open a trace with `pnpm exec playwright show-trace test-results/<test>/trace.zip`.
- **Visual regression:** `pnpm test:visual` and `pnpm test:visual:update`. The 16 baselines are tagged `-linux` (fonts and anti-aliasing differ between systems). On macOS and Windows the `@visual` tests are **reported as skipped**, not failed; run `pnpm test:visual:update` once to create your own local baselines, and review the images before committing them.
- **Accessibility:** axe runs inside the E2E suite (`e2e/a11y.spec.ts`); no rule is disabled.

**Clean-checkout check.** `scripts/delivery-check.sh` clones the committed `HEAD` into a temporary folder and runs install, typecheck, lint, format, unit tests, build (asserting the `kurio-build` meta, no `/dev` harness chunk and no plaintext password in `dist/`) and the E2E suite there, so nothing can depend on ignored files or local state. `SKIP_E2E=1` skips the last step; `E2E_PORT` moves the preview port.

The map from each required scenario to its test file is in [`ARCHITECTURE.md`](ARCHITECTURE.md#10-testing-strategy).

## Lighthouse

Audited on the **deployed** URL (Lighthouse CLI through LHCI, 3 runs per page and profile, medians, 2026-10-29):

| Profile | Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | Home | 86 | 100 | 100 | 100 | 3.35 s | 0 | 89 ms |
| Mobile | Details | 86 | 100 | 100 | 100 | 3.33 s | 0 | 54 ms |
| Desktop | Home | 99 | 100 | 100 | 100 | 0.75 s | 0 | 0 ms |
| Desktop | Details | 99 | 100 | 100 | 100 | 0.76 s | 0 | 0 ms |

Build `6915bac`, the final deploy; re-run with `pnpm lighthouse:deployed https://ntfs-marketplace.vercel.app/`. The summary of this run, with the live checks of the build id, `/dev` and `robots.txt`, is [`lighthouse/reports/deployed-2026-10-29.md`](lighthouse/reports/deployed-2026-10-29.md). The local audit against `vite preview` (committed reports, with the analysis of every miss) is in [`lighthouse/reports/summary.md`](lighthouse/reports/summary.md): mobile Performance 76 there, desktop 98–99.

**Mobile Performance is below the brief's 90 target (86 deployed, 76 locally); every other category and target is met, and CLS is 0 everywhere.** This is an accepted, documented deviation: Lighthouse's simulated slow 4G with a 4× CPU slowdown prices the chain HTML → app → mock worker → API → LCP image, and a diagnostic build with mocks off only reached 79–83 locally. The analysis and the options not taken are in [`lighthouse/reports/analysis.md`](lighthouse/reports/analysis.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md#12-performance-notes).

## Deploy

Vercel, framework preset Vite, configured by [`vercel.json`](vercel.json): `pnpm install --frozen-lockfile`, `pnpm build`, output `dist/`; an SPA rewrite to `index.html` for every path except `/assets/` (so a missing hashed chunk is a 404, not HTML); `mockServiceWorker.js` served with `Cache-Control: no-cache` (a fresh worker on every release) and `/assets/*` as `immutable`. Project settings: Node 24.x, and `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses the pnpm version from `packageManager`. The `/dev/*` harness pages are excluded from the deploy build (see `ARCHITECTURE.md`, section 13).

**Check that the deploy is the delivered code.** Every build carries its commit in the page head. Read it in DevTools (`<meta name="kurio-build">`) or:

```sh
curl -s https://ntfs-marketplace.vercel.app/ | grep kurio-build
git rev-parse --short=7 HEAD
```

The two values must match (Vercel's `VERCEL_GIT_COMMIT_SHA`, first 7 characters; a local build uses `git rev-parse --short=7 HEAD`, or `dev` outside a git checkout). Also check that `/mockServiceWorker.js` answers 200 with `cache-control: no-cache`, that a deep link (`/cart`) survives a refresh, and that `/?scenario=empty` shows the empty catalog.

The initial HTML includes Open Graph and Twitter metadata with a shared JPEG preview, so link previews work without JavaScript. TanStack Router supplies canonical URLs and descriptions for the homepage and NFT pages; account, checkout, favorites, and developer screens use `noindex`. [`public/sitemap.xml`](public/sitemap.xml), advertised in `robots.txt`, lists the homepage only. NFT discovery depends on the rendered catalog links. Google still needs to render JavaScript to read page-specific metadata and content; individual NFT social previews would require prerendering or server rendering. After deploying, submit `/sitemap.xml` in Google Search Console and inspect the homepage URL. If the public domain changes, update [`src/lib/seo.ts`](src/lib/seo.ts), `index.html`, `public/robots.txt`, and `public/sitemap.xml` together.

## Known limitations

Everything is simulated (no real backend, wallet or chain), and realtime events reach only the tab that caused the change. Mobile Lighthouse Performance is below target (above). Visual baselines are Linux-only. Unknown URLs return HTTP 200 with the not-found view (an SPA on Vercel). The full list, with reasons, is in [`ARCHITECTURE.md`](ARCHITECTURE.md#14-limitations); every deviation from Figma and the brief is in [section 13](ARCHITECTURE.md#13-deviations-and-decisions). Screens with **no Figma frame** (composed by the specs, documented there): mobile profile, mobile wallets, mobile order confirmation, tablet widths, the mobile filter sheet, the checkout review step, and the simulated explorer.
