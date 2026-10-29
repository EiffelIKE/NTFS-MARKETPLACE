# 14 — Docs & delivery · Design

> Status: Final. Decisions of the delivery pass are in [§9](#9-decisions); where the draft below differs from what was built, §9 wins.

Implements [`requirements.md`](requirements.md). No new dependencies.

## 1. Files

```
README.md
ARCHITECTURE.md
docs/screenshots/home-desktop.png   # README screenshot
lighthouse/reports/                 # spec 13 (not docs/lighthouse/); deployed-2026-10-29.md added here
scripts/
  docs.ts                  # renderSections(): operations, error-code and scenario tables
  docs.test.ts             # fails when a generated section is stale; rewrites with UPDATE_DOCS=1
  build-meta.ts (+ test)   # kurio-build identifier and the Vite plugin (§4)
  dev-routes.ts (+ test)   # /dev/* gating plugin (§9)
  delivery-check.sh        # clean-checkout verification (§5)
```

Generated sections sit between `<!-- generated:NAME -->` … `<!-- /generated:NAME -->` markers (`operations`, `errors` in `ARCHITECTURE.md`; `scenarios` in `README.md`). `docs.ts` imports the operations table (`src/contracts/operations.ts`), the error defaults (`src/contracts/errors.ts`) and the scenario registry (`src/mocks/scenarios.ts`) by relative path and runs under Vitest. The request, success and error columns of the operation table come from a map typed `Record<OperationId, …>` inside `docs.ts`, so a new operation fails the type check until it is described. `docs.test.ts` compares each marked section with `renderSections()` and fails when they differ; with `UPDATE_DOCS=1` it rewrites them instead. Script `docs:update` = `UPDATE_DOCS=1 vitest run scripts/docs.test.ts` (`pnpm docs` is a pnpm built-in, so the script could not be called `docs`). The same test also checks the README against the code: every `pnpm <script>` it names exists and every script is documented, every environment variable of the schema and `.env.example` appears, the demo credentials equal the fixtures, every scenario selector appears; and that every relative link in both documents and every `e2e/*.spec.ts` in the scenario map exists. `README.md` and `ARCHITECTURE.md` are in `.prettierignore`, because Prettier would re-pad the generated tables.

## 2. README.md outline (DOC-01 – DOC-07)

1. **KURIO — NFT Marketplace**: one paragraph, public URL, repository, screenshot.
2. **Quick start**: `mise install`, `pnpm install --frozen-lockfile`, `pnpm dev`, open `http://localhost:5173`. Without mise: Node 24.11, `corepack enable`.
3. **Demo accounts** (from spec 02 `credentials.ts`):

   | Account | Email | Password | Shows |
   |---|---|---|---|
   | Ana Souza | `ana@kurio.example` | `Kurio#Ana2026` | full profile, two wallets, favorites, cart, a confirmed order |
   | Bruno Lima | `bruno@kurio.example` | `Kurio#Bruno2026` | one wallet, empty cart; 403 on Ana's order |
   | Carla Mendes | `carla@kurio.example` | `Kurio#Carla2026` | no wallets: checkout asks to register one |

4. **Environment variables**: `VITE_API_BASE_URL`, `VITE_API_TIMEOUT_MS`, `VITE_ENABLE_MOCKS`, `VITE_REALTIME_URL` (spec 03), and any later addition, from the env schema.
5. **Scenarios and reset**: how to select (URL, panel, `window.__mock`), generated scenario table, reset methods, persistence note (`localStorage`, per browser).
6. **Reproducing failure flows**: one row per flow — goal, how to trigger, steps, expected result:

   | Flow | Trigger |
   |---|---|
   | Empty catalog | `?scenario=empty` |
   | Slow / variable latency, skeletons | `?scenario=slow`, `?scenario=jitter` |
   | Out-of-order responses | `?scenario=out-of-order`, type quickly in search |
   | Offline, then recovery | `?scenario=offline`, then panel → Padrão |
   | 5xx with retry recovery | `?scenario=errors-then-recover` |
   | Server down | `?scenario=server-down` |
   | Session expiry with resume | `?scenario=session-short`, or `__mock.expireSessions()` mid-checkout |
   | Simulated block explorer | open Ana's receipt `/orders/ord_000001` → "Ver no Etherscan" (public page `/explorer/<network>/tx/<hash>`, in-app; no external link is involved) |
   | Unauthorized / forbidden | open `/profile` signed out; Bruno opens `/orders/ord_000001` |
   | Sign-up conflict, validation | sign up with `ana@kurio.example`; submit empty forms |
   | Invalid / expired coupon | `NAOEXISTE`, `VERAO25` |
   | Price change / sold out during checkout | `?scenario=price-change-on-checkout`, `?scenario=sold-out-on-checkout`, or `__mock.updateNft(...)` with the cart open |
   | Timeout after order creation | `?scenario=order-timeout` |
   | Declined / pending payment | `?scenario=payment-declined`, `?scenario=payment-manual` + panel "Liquidar" |
   | Pending order after reload or disconnect | `?scenario=pending-order`; disconnect control from spec 03 |
   | Duplicate / old events | spec 03 control for re-emitting an event |
   | Wallet rejects connection | `?scenario=wallet-reject` |

7. **Commands**: table from spec 00 §2 plus `test:visual`, `test:visual:update` (spec 12), `lighthouse`, `lighthouse:deployed` (spec 13), with outputs (`playwright-report/`, `reports/lighthouse/`, `docs/lighthouse/`).
8. **Tests**: how to run one project, open the report and a trace; `test:visual` and `test:visual:update`; baselines are Linux-only (spec 12 design §6).
9. **Deploy**: Vercel settings (spec 00 §12), `ENABLE_EXPERIMENTAL_COREPACK=1`, Node 24, checking `<meta name="kurio-build">`.
10. **Known limitations**: short list linking to `ARCHITECTURE.md`.

## 3. ARCHITECTURE.md outline (DOC-08 – DOC-14)

| § | Section | Sources |
|---|---|---|
| 1 | Overview and Mermaid data-flow diagram (UI → Query → `api/*` → Axios → MSW worker → mock DB → bus → Socket.IO binding → client → cache) | 00, 02, 03 |
| 2 | Source layout and import boundaries (lint rules) | 00 §3, 02 §12, 03 |
| 3 | REST contracts: generated operation table, error envelope and codes, money as decimal strings, idempotency | 02 §4–§6 |
| 4 | Realtime: envelope `{id, type, resource, version}`, dedupe and version guard, subscriptions, reconnection → REST reconciliation, session isolation, mock transport and limits | 03 |
| 5 | Session: token storage, interceptor, 401 handling, expiry with `redirect`, user switch (cache clear, socket reconnect) | 04 |
| 6 | Cart: server cart, guest cart id, merge on login with adjustments, quote and realtime changes | 02, 07 |
| 7 | Checkout and orders: state machine diagram (draft → review → pending → confirmed / declined), revalidation, idempotency key lifecycle, recovery after refresh/reconnect | 09, 10 |
| 8 | Cache, retry and sync policy: spec 00 defaults, per-query overrides, query-key catalog, invalidation matrix, optimistic favorites, stale-response handling | 00 §6, 05–10 |
| 9 | Mock environment: DB, persistence, scenarios, network conditions, control API, panel | 02 |
| 10 | Testing strategy: layers and the brief §9 scenario map (from the specs README) | 00–13 |
| 11 | Accessibility adjustments | 01 §11, 11 §9 |
| 12 | Performance notes and link to `docs/lighthouse/` | 13 |
| 13 | Deviations and decisions (DOC-13) | every spec's notes section |
| 14 | Limitations | collected |

**Deviation collection (DOC-13).** Each spec ends with a "Deviations and notes for `ARCHITECTURE.md`" (or "Notes for …") section. T03 walks `SPECS-NTFS/*/design.md`, copies every item into §13 under one of: Figma, Accessibility, Assets, Brief interpretation, Technical. Each item keeps its reason and links back to the spec section. Items already known from specs 00–02 include: TypeScript 6 / ESLint 9 pins, no icon package, SPA 404 with HTTP 200, derived colors, type-scale collapse, drawn icons, tab bar choices, `aria-current` vs. Figma highlight, out-of-scope links, MSW 2.x, Axios fetch adapter, quote fingerprints, 403 vs. 404, ETH on every network, dot decimal separator, PBKDF2 iterations, mock clock, multi-tab behavior, Service Worker limits. From spec 04 (design §13 and §14): desktop auth as a page panel, unavailable social login, bearer token in `localStorage` (HttpOnly cookie in production), the session policy, identity-change isolation and the boot cost of a stored session.

**Transport limits (DOC-10)** to state explicitly, confirmed against spec 03 (Done; its design §3 and §12 hold the details: MSW strips the `/socket.io/` path, the binding has no heartbeat, rooms, acks or CONNECT `auth`, refusing a connection needs an `error` event, WebSocket only): the Socket.IO "server" runs inside the page's Service Worker interception, not in a separate process; events reach only the tab that caused the change (spec 02 multi-tab note); a real network drop cannot be simulated at the socket level beyond what the binding exposes, so disconnection is driven by the mock control; there is no server persistence of missed events, so reconnection relies on REST reconciliation, which is also the production design.

## 4. Commit identifier (DOC-16)

`scripts/build-meta.ts` resolves the identifier: `VERCEL_GIT_COMMIT_SHA` (set by Vercel at build), shortened to its first 7 characters, else the local `HEAD` (`git rev-parse --short=7 HEAD`), else `dev` (a tarball with no repository). The `buildMeta()` Vite plugin, registered in `vite.config.ts`, injects `<meta name="kurio-build" content="<id>">` through `transformIndexHtml` (`head-prepend`), in the build and in the dev server. The footer does not show it (no Figma slot); the README tells evaluators to read it in DevTools or with `curl -s <url> | grep kurio-build` and to compare it with `git rev-parse --short=7 HEAD`.

## 5. Clean-checkout check (`scripts/delivery-check.sh`, DOC-15)

1. `git clone --no-local` of the repository's committed `HEAD` into a temporary folder (the working tree's uncommitted changes are reported and not checked).
2. In the clone: `mise install` (when mise exists), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, **build assertions** (`dist/index.html` carries `kurio-build` equal to the clone's `HEAD`, no `ui-kit` or `dev-realtime` chunk in `dist/assets`, no plaintext demo password in `dist/`), then `pnpm test:e2e --workers=3`.
3. Stops on the first failure and names the step; prints the elapsed time per step; deletes the clone on exit. `SKIP_E2E=1` skips the last step, `E2E_PORT` and `E2E_WORKERS` tune it.

It checks that nothing depends on ignored files, local `.env*.local`, the developer's `localStorage` or a running dev server.

## 6. Deploy check (DOC-17)

Run by hand against the public URL with the Chrome DevTools tools (results in `tasks.md`, T07), after each deploy:

| Check | How |
|---|---|
| Build identity | `<meta name="kurio-build">` equals the delivered commit |
| Direct access + refresh | each route of spec 00 §5 → open it, refresh it, expect the `h1`; private routes land on `/login?redirect=…` |
| Not found | `/nao-existe` → not-found view; `/dev/ui-kit` and `/dev/realtime` → not-found (§9) |
| Worker headers | `GET /mockServiceWorker.js` → 200 and `cache-control: no-cache` |
| Scenarios | `/?scenario=empty` → empty catalog; `/?reset=1` → reseeds the active scenario |
| Purchase | Ana: sign in → cart → checkout → review → connect → pay → confirmed receipt; `__mock.realtime.log()` shows `order.updated` delivered |
| Realtime | Ana's cart open, `__mock.updateNft` raises a price → the cart shows the notice and the new total |
| Mobile | 390 × 844: a deep link and its refresh render, no overflow, no console errors |
| Lighthouse | `pnpm lighthouse:deployed <url>` |

A Playwright version of this table (`scripts/deploy-check.ts`) was not built: the same flows already run with mocks in the E2E suite, and a deploy differs from `vite preview` only by headers, the rewrite and the build identity, which the table covers.

## 7. Notes

- Documents are English (open question 1); UI copy quoted inside them stays pt-BR.
- The specs folder stays in the repository as the design record; the README links it.

## 8. Notes added by the fix batch (2026-10-28)

- `pnpm test:e2e` skips the `@visual` tests off Linux (spec 12 §9); the README's testing section should say that macOS and Windows runs report them as skipped and how to create local baselines.
- A scenario for a 4xx exists now: `?scenario=rate-limited` (spec 02 §17). Add it to the README's scenario list next to the 5xx ones.
- The plaintext demo passwords live only in `fixtures/credentials.ts` and the README; the production bundle no longer contains them (spec 02 §17).

## 9. Decisions

Taken at delivery (2026-10-29), after the app was deployed.

1. **Open questions 1–4** took the recommended defaults: English documents; generated tables checked by a test; two Mermaid diagrams; a `--no-local` clone for the clean checkout.
2. **Generated sections** are three, not two: operations, error codes (`ERROR_DEFAULTS`) and scenarios. The script is `docs:update` (§1).
3. **`/dev/*` routes are not in the deploy (R10, G8).** The deploy served `/dev/ui-kit` and `/dev/realtime` (checked 2026-10-29). E2E runs against `vite preview` of a production build and uses both (`design-system.spec.ts`, `realtime-resilience.spec.ts`, two tests in `auth.spec.ts`), so they cannot simply be removed. Options weighed: a runtime check (leaves the code in the bundle), a build-time flag read by the route files (the generated route tree and the heavy imports stay), deleting the folder in the Vercel build (a dirty tree and a tree that no longer matches `routeTree.gen.ts`), and a transform plugin. Chosen: `scripts/dev-routes.ts`, a Vite plugin (`enforce: 'pre'`, before the router plugin) that replaces each `src/routes/dev/*.tsx` module with a stub `createFileRoute('/dev/<name>')({ beforeLoad: () => { throw notFound() } })` unless the flag is on. The route tree is untouched, the harness code and its imports never reach `dist/` (no `ui-kit` or `dev-realtime` chunk), and the URL answers the app's not-found view. The flag is `VITE_ENABLE_DEV_ROUTES=true`, read at build time only (not part of the client env schema): the dev server always has the routes, **a build has them only when the flag is set**, so the Vercel build needs no setting and a misconfigured deploy is safe by default. `playwright.config.ts` sets the flag in `webServer.env`. A server started from a plain `pnpm build` gives not-found on those routes; the README says so. Checked: a plain build → `/dev/ui-kit` shows "Página não encontrada"; the flagged build passes `design-system`, `realtime-resilience` and the two `auth` tests (§ tasks).
4. **Build identifier (DOC-16)** is 7 characters (§4), so `git rev-parse --short=7 HEAD` and the Vercel value compare directly; it is injected in the dev server too.
5. **Playwright port.** `playwright.config.ts` reads `E2E_PORT` (default 4173) so a second checkout can run beside one that holds 4173; the web server and `baseURL` follow it. Two tests that hard-code `http://localhost:4173` (spec 07 §13, item 19) still need the default port.
6. **Lighthouse location.** Reports live in `lighthouse/reports/` (spec 13 decision 1), so there is no `docs/lighthouse/`; the README links `lighthouse/reports/` and the deployed summary `lighthouse/reports/deployed-2026-10-29.md`. Mobile Performance below 90 (G1) is documented as an accepted deviation with the spec 13 analysis.
7. **DOC-17** was checked by hand (§6) rather than by a Playwright script, and its results are recorded in `tasks.md` with the commit the deploy serves.
8. **Figma fidelity** is not copied into `ARCHITECTURE.md`: §13 lists the deliberate deviations and links `SPECS-NTFS/12-visual-regression/fidelity.md` for the screen-level comparison. `docs.test.ts` lets that one link pass while the file is unmerged (`LANDS_LATER`); remove the entry once it exists.
9. **README screenshot** is the deployed home of 2026-10-29 (before the fidelity pass); retake it after the final deploy.

## 10. Amendments to earlier specs

- Spec 00 design §12 and spec 02 tasks: the remote deploy proofs are recorded as done (2026-10-29).
- Spec 13 tasks T06: the deployed audit is done.
- `SPECS-NTFS/README.md`: statuses of 00, 02, 13 and 14.

## 11. Amendment: Brazilian Portuguese copies (2026-10-29)

The evaluators read Portuguese, so each required delivery document has a pt-BR copy.

- **Files.** `README.pt-BR.md` and `ARCHITECTURE.pt-BR.md`, full translations (prose, table text, Mermaid labels). Code, commands, paths, identifiers, schema names, operation ids, error codes and URLs are not translated; UI strings already in pt-BR are unchanged. Links to `SPECS-NTFS/` stay as they are (the specs are English only). Cross-links point to the sibling copy and the anchors use the slug of the translated heading (`ARCHITECTURE.pt-BR.md#13-desvios-e-decisões`).
- **Language switch.** The first line under the H1 of the four files: `**English** · [Português (Brasil)](README.pt-BR.md)` in the English files, `[English](README.md) · **Português (Brasil)**` in the copies (the ARCHITECTURE pair links to its own sibling). The README link list also names the copies.
- **English is the source of truth.** A change to `README.md` or `ARCHITECTURE.md` must be mirrored in its pt-BR copy in the same change. The generated tables are enforced; the prose is not, so a reviewer has to check it.
- **Generated sections.** `renderSections(locale)` takes `'en'` (default, byte-identical to before) or `'pt-BR'`. Only the column headers and the English prose cells (auth labels, "with `favorites`", "on replay") are translated; code cells are identical. `docs.test.ts` lists each section's owners as (file, locale) pairs and checks and rewrites (`UPDATE_DOCS=1`) the section in both the English and the pt-BR file. It also asserts that each document has its sibling, that the four files carry the language-switch link, that the sibling has the same generated sections, and that the relative links of the copies point at existing files. `pnpm docs:update` now edits four files.
- **Not enforced:** that the prose of a copy matches its original, and that the copy's anchors exist (checked once with a throwaway script at delivery: 50 anchors across the four files, all resolved).
- **Prettier.** The copies are in `.prettierignore` next to the originals (they hold the same unpadded generated tables). `scripts/delivery-check.sh` needed no change: it does not list the documents, and `pnpm test` already runs the new checks.
