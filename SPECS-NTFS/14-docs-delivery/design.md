# 14 — Docs & delivery · Design

> Status: Draft — see [Open questions](requirements.md#open-questions). Section outlines are fixed; content is filled from specs 00–13 when they are Done.

Implements [`requirements.md`](requirements.md). No new dependencies.

## 1. Files

```
README.md
ARCHITECTURE.md
docs/
  lighthouse/              # spec 13
scripts/
  docs.ts                  # renderSections(): operations and scenario tables (open question 2)
  docs.test.ts             # fails when a generated section is stale; rewrites with UPDATE_DOCS=1
  delivery-check.sh        # clean-checkout verification (§5)
  deploy-check.ts          # Playwright script against the public URL (§6)
```

Generated sections sit between `<!-- generated:operations -->` … `<!-- /generated:operations -->` markers. `docs.ts` imports the operations table (`src/contracts/operations.ts`) and the scenario registry metadata (`src/mocks/scenarios.ts`). It runs under Vitest rather than plain Node, because those modules use the `@/` alias, which Vitest resolves from the Vite config. `docs.test.ts` compares each marked section with `renderSections()` and fails when they differ; with `UPDATE_DOCS=1` it rewrites them instead. Script `docs` = `UPDATE_DOCS=1 vitest run scripts/docs.test.ts`. Vitest `include` gains `scripts/**/*.test.ts` (shared with spec 13).

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

`vite.config.ts` reads `VERCEL_GIT_COMMIT_SHA` (set by Vercel at build), falling back to `git rev-parse --short HEAD` when available, else `dev`, and injects `<meta name="kurio-build" content="<sha>">` through `transformIndexHtml`. The footer does not show it (no Figma slot); the README tells evaluators to read it in DevTools or with `curl -s <url> | grep kurio-build`.

## 5. Clean-checkout check (`scripts/delivery-check.sh`, DOC-15)

1. Copies tracked files to a temporary folder (`git clone --no-local .` once git exists; otherwise `rsync` honoring `.gitignore`, open question 4).
2. Runs, in that folder: `mise install`, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
3. Fails on the first non-zero exit and prints the step; prints the elapsed time per step at the end.

It checks that nothing depends on ignored files, local `.env*.local`, the developer's `localStorage` or a running dev server.

## 6. Deploy check (`scripts/deploy-check.ts`, DOC-17)

A Playwright script (`pnpm exec playwright test scripts/deploy-check.ts --config=…` with `baseURL` from `DEPLOY_URL`, desktop and mobile projects) that runs:

| Check | How |
|---|---|
| Build identity | `<meta name="kurio-build">` equals the expected commit |
| Direct access + refresh | each route from spec 00 §5 with anchor ids → `goto`, `reload`, expected `h1` |
| Not found | `/nao-existe` → not-found view |
| Worker headers | `request.get('/mockServiceWorker.js')` → 200 and `cache-control: no-cache` |
| Scenarios | `/?scenario=empty` → empty catalog; `/?reset=1` → default |
| Purchase | Ana: catalog → details → cart → checkout → confirmed receipt (settles through `order.updated`, spec 09) |
| Realtime | Ana's cart open, `__mock.updateNft` raises a price → cart shows the change and the new total |
| Assets | NFT images, font and icons load with 200 from the deploy origin |

Results go to `playwright-report/deploy/`; the README links the latest pass date.

## 7. Notes

- Documents are English (open question 1); UI copy quoted inside them stays pt-BR.
- The specs folder stays in the repository as the design record; the README links it.

## 8. Notes added by the fix batch (2026-10-28)

- `pnpm test:e2e` skips the `@visual` tests off Linux (spec 12 §9); the README's testing section should say that macOS and Windows runs report them as skipped and how to create local baselines.
- A scenario for a 4xx exists now: `?scenario=rate-limited` (spec 02 §17). Add it to the README's scenario list next to the 5xx ones.
- The plaintext demo passwords live only in `fixtures/credentials.ts` and the README; the production bundle no longer contains them (spec 02 §17).
