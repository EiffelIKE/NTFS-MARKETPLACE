# NFT Marketplace — Specs (SDD)

Spec-driven development index for the KURIO NFT Marketplace challenge. The brief is [`../OBJETIVES.md`](../OBJETIVES.md); design inputs live in [`../figma_tokens/`](../figma_tokens/README.md).

Each spec is a folder `NN-name/` with three files, written in this order and reviewed before moving on:

| File | Contents |
|---|---|
| `requirements.md` | User stories + acceptance criteria in EARS form (`WHEN … THE SYSTEM SHALL …`), each with a stable ID (`CAT-03`). Out-of-scope list. |
| `design.md` | Routes, components, contracts, query keys, cache/invalidation, mock scenarios, events, a11y notes, Figma references and deviations. |
| `tasks.md` | Ordered checklist; every task cites the requirement IDs it satisfies and the test that proves it. |

A spec is **Done** when all its tasks are checked, its E2E tests pass with mocks in Chromium (desktop + mobile viewports), and typecheck/lint are clean.

## Spec list

| # | Spec | Goal | Depends on | Figma | Req. prefix | Status |
|---|---|---|---|---|---|---|
| 00 | `00-foundation` | Vite + React + TS scaffold, pnpm/mise, Tailwind v4, shadcn/ui init, TanStack Router (file-based) + Query, Axios client, ESLint/Prettier, Playwright + Lighthouse skeletons, Vercel deploy with SPA rewrites | — | — | `FND` | Done — deploy pending |
| 01 | `01-design-system` | Tokens → Tailwind `@theme`, self-hosted Roboto Mono, derived semantic colors (error, success, focus, disabled, scrim), shadcn components restyled, skeleton + shimmer (reduced-motion aware), icons from Figma SVGs, app shells (desktop header/footer, mobile tab bar) | 00 | Home desktop + mobile | `DS` | Done — build chunk warning deferred to 13 |
| 02 | `02-contracts-mocks` | Zod contracts for all REST resources, error envelope, ETH as decimal strings (big.js), MSW handlers over a persisted mock DB, fixtures (catalog, ≥ 2 users), scenario engine (`?scenario=`, dev panel, `window.__mock`), latency/timeout/offline/4xx/5xx injection, reset | 00 (01 for the mock panel) | — | `API` | Done — deploy check pending |
| 03 | `03-realtime` | `socket.io-client` + `@mswjs/socket.io-binding`, event envelope `{id, type, resource, version}`, dedupe and version guard, reconnection → REST reconciliation, per-session subscription lifecycle | 02 | — | `RT` | Done |
| 04 | `04-auth-session` | Sign-up, login, logout, session restore, expiry handling with context preservation (`redirect` search param), protected routes, user switch clears Query cache + socket, hashed passwords | 01, 02, 03 | Login / Sign-up (screenshots; desktop is a modal) | `AUTH` | Done |
| 05 | `05-catalog` | Home: hero/highlights, search, combinable filters, sorting, pagination in URL search params, reset page on filter change, empty/error/stale-response handling, desktop sidebar vs mobile filter sheet | 01, 02 | Home desktop + mobile | `CAT` | Done |
| 06 | `06-nft-details` | Details route with direct access + 404, gallery, edition selection, quantity limits, unavailable editions, favorites (optimistic + rollback), add to cart, related items, live `nft.updated` | 04, 05 | Details desktop + mobile (screenshots) | `DET` | Done |
| 07 | `07-cart` | Server cart + guest cart merge on login, quantity edit/remove, availability limits, coupons (invalid/expired), quote summary (subtotal, discount, network fee, total), live price/availability changes | 03, 04, 06 | Cart desktop + mobile (screenshots) | `CART` | Done |
| 08 | `08-profile-wallets` | Profile details, avatar, password change; primary/secondary wallets add/edit with validation and API errors; mobile layout without dedicated frame | 04 | Profile / Wallets desktop (screenshots) | `ACC` | Done |
| 09 | `09-checkout-orders` | Checkout form + review step, wallet/network selection, simulated connect/reject/disconnect, quote revalidation requiring re-confirmation, idempotent order creation, pending/confirmed/declined via `order.updated`, recovery after refresh/reconnect, cart cleanup of purchased lines only | 07, 08 | Checkout desktop + mobile (screenshots) | `CHK` | Done |
| 10 | `10-order-confirmation` | Receipt from order snapshot (immutable amounts), transaction id + simulated explorer link, only for confirmed orders; mobile layout without dedicated frame | 09 | Confirmation desktop (screenshot, modal) | `RCPT` | Done |
| 11 | `11-a11y-responsive` | Cross-cutting audit pass: keyboard paths, focus traps in dialogs/drawers, live regions for mutations and realtime, contrast, zoom/overflow at 390 / 768 / 1440, tablet composition | 05–10 | All | `A11Y` | Draft |
| 12 | `12-visual-regression` | Playwright screenshot baselines for home, details, cart, checkout (desktop + mobile), frozen clock and data, masked dynamic regions | 05–09 | Home, Details, Cart, Checkout | `VR` | Draft |
| 13 | `13-lighthouse` | Lighthouse CI config, 3 runs × page × profile, medians, LCP/CLS/TBT, HTML/JSON reports, analysis of misses (incl. MSW worker start cost) | 05, 06 | — | `PERF` | Draft |
| 14 | `14-docs-delivery` | `README.md` (setup, env vars, credentials, scenarios, reset, commands, failure reproduction), `ARCHITECTURE.md` (contracts, events, session, cart, cache, reconciliation, deviations), final deploy check | all | — | `DOC` | Draft |

Order of work follows the numbering. 08 (profile & wallets) comes before checkout because checkout must use registered wallets.

Accessibility, responsiveness, loading skeletons and error states are built **inside** every screen spec (05–10); spec 11 is the verification and hardening pass, not the first time they are considered.

## Traceability — brief → spec

| Brief § | Requirement | Spec(s) |
|---|---|---|
| 2 | Required stack used meaningfully | 00, 02, 03 |
| 3 | Screens: Home | 05 |
| 3 | Screens: NFT details | 06 |
| 3 | Screens: Cart | 07 |
| 3 | Screens: Checkout | 09 |
| 3 | Screens: Order confirmation (+ mobile) | 10 |
| 3 | Screens: Login / Sign-up | 04 |
| 3 | Screens: Profile, Wallets (+ mobile) | 08 |
| 3 | Out-of-scope actions must not fake success | 01 (shell links), all screen specs |
| 3.1 | Search/filters/sort/pagination in URL, combinable, reset page | 05 |
| 3.1 | Empty, failure, out-of-order responses | 02, 05 |
| 3.1 | Details direct access, 404, unavailable editions, quantity limits | 06 |
| 3.1 | Favorites persist per user | 02, 06 |
| 3.2 | Cart CRUD, availability, persistence, guest merge | 02, 07 |
| 3.2 | Coupons, quote summary, decimal-string ETH | 02, 07 |
| 3.2 | Live price/availability in cart | 03, 07 |
| 3.3 | Checkout validation + review, wallets/networks, connect/reject/disconnect | 09 |
| 3.3 | Quote revalidation, idempotency, pending/confirmed/declined, recovery | 02, 03, 09 |
| 3.3 | Receipt snapshot, confirmed-only confirmation | 10 |
| 3.4 | Sign-up/login/logout/session restore, expiry with resume, user switch isolation | 04 |
| 3.4 | Form validation incl. API errors; no plaintext passwords | 02, 04, 08 |
| 4 | Typed contracts; loading/empty/error/success/background states | 02, all screen specs |
| 4 | Invalidation, stale-response discard, per-user isolation, no duplicate ops | 02, 04, 05, 09 |
| 4 | Optimistic update with rollback (favorites) | 06 |
| 4 | 404 route, direct access to every screen | 00, 04 |
| 4 | Cache/retry/sync policy documented | 14 |
| 5 | REST contracts for all resources, error taxonomy, idempotency key | 02 |
| 6 | MSW mocks, persistence, reset, network conditions, scenarios, demo build | 02 |
| 6 | Socket.IO through MSW binding, transport limits documented | 03, 14 |
| 7 | `nft.updated`, `order.updated`, dedupe/versioning, reconnection reconciliation, session isolation | 03, 07, 09 |
| 8 | Figma fidelity; 390 / 768 / 1440 | 01, 05–10, 11 |
| 8 | Skeletons with shimmer, no layout shift, reduced motion | 01, 05–07 |
| 8 | Keyboard, focus, semantics, alt text, contrast, live feedback, zoom | 01, 11 |
| 9 | E2E suite, visual regression, isolation, clock control, HTML report + traces | each spec, 12 |
| 10 | Lighthouse targets, medians, reports | 13 |
| 12 | Deploy, README, ARCHITECTURE, commands, clean checkout | 00, 14 |

## Traceability — required E2E scenarios (brief §9)

| # | Scenario | Owner spec | Planned file |
|---|---|---|---|
| 1 | Search, combined filters, sorting, pagination, history restore | 05 | `e2e/catalog.spec.ts` |
| 2 | Direct access to details, nonexistent resources | 06 | `e2e/nft-details.spec.ts` |
| 3 | Sign-up, login, session expiry, logout, user switch | 04 | `e2e/auth.spec.ts` |
| 4 | Favorites incl. mutation failure and recovery | 06 | `e2e/favorites.spec.ts` |
| 5 | Cart, quantities, removal, coupons, persistence after refresh/login | 07 | `e2e/cart.spec.ts` |
| 6 | Full purchase, catalog → confirmed receipt | 09, 10 | `e2e/purchase.spec.ts` |
| 7 | Payment failure, repeated clicks, timeout recovery of same order | 09 | `e2e/checkout-failures.spec.ts` |
| 8 | Profile, avatar, password, wallets with validation errors | 08 | `e2e/account.spec.ts` |
| 9 | Price/availability change via Socket.IO during checkout | 09 | `e2e/realtime-checkout.spec.ts` |
| 10 | Duplicate/old events, disconnection, pending order resume | 03, 09 | `e2e/realtime-resilience.spec.ts` |
| 11 | Keyboard navigation, dialog focus, form validation | 11 | `e2e/a11y.spec.ts` |
| 12 | Skeletons on slow loading, failure feedback, retry recovery | 05, 06, 07 | `e2e/loading-states.spec.ts` |
| VR | Visual regression: home, details, cart, checkout | 12 | `e2e/visual.spec.ts` |

## Open design decisions

Gaps in Figma that specs must resolve (and record as deviations in `ARCHITECTURE.md`):

- **Frames not extracted by MCP**: cart, checkout, login, sign-up, profile, wallets, confirmation and mobile details are documented from the user's screenshots in [`../figma_tokens/screens.md`](../figma_tokens/screens.md) (approximate values). Still without any frame: mobile profile, wallets and confirmation.
- **Desktop login / sign-up**: Figma draws them as a modal over home. Decided in spec 04: pages rendering the Figma panel, not a modal.
- **Confirmation modal**: Figma draws the receipt as a modal. Decided in spec 10: a routed page at `/orders/$orderId` (direct access, refresh, recovery) rendering the Figma card on desktop and a full-width page on mobile.
- **Social login and "Esqueceu a senha?"**: out of scope. Decided in spec 04: they show "Disponível em breve" and do nothing.
- **Tablet (768)**: no frame. Proposal: mobile composition with 3-column grid and filter sheet up to `lg` (1024).
- **Mobile tab bar FAB**: icon has no defined function. Decided in spec 01: opens search; the bag icon is the cart. Inner mobile screens (details, cart, checkout) hide the tab bar, as their frames show.
- **Mobile favorites tab**: no favorites screen in scope. Proposal: catalog filtered to the user's favorites (`?favorites=1`, auth required).
- **Mobile filter sheet**: not drawn. Reuse desktop Filters content in a shadcn `Sheet`.
- **Details**: "Contrato" / "Direitos autorais" values swapped in Figma; reviews tab not drawn; breadcrumb lacks current item; mobile edition chips repeat "1/10".
- **Figma copy inconsistencies**: cart token ids per row, mobile cart subtotal vs. lines; fixtures follow the item data, not the summary copy.
- **Missing semantic colors** (error, success, warning, focus, disabled, scrim, skeleton): derived in spec 01.

## Cross-spec ownership (settled when drafting 03–14)

- **Cart modules:** spec 06 creates `features/cart` (`cart-keys.ts` owner-scoped, `cart-queries.ts`, `apply-cart.ts`, `useAddCartItem`, `guest-cart-id.ts`) with spec 07's design; spec 07 extends them (merge, quote, screen).
- **Auth hooks:** spec 04 provides `requireAuth` per route (no `_authenticated` layout), `context.session.isAuthenticated()`, the post-sign-in task list (spec 07 merge), `session.updateUser` (spec 08) and the epoch guard for late mutation results.
- **Orders:** spec 09 builds `features/orders/` (tracking hook, pending/declined panels); spec 10 reuses it.
- **Amendments to earlier specs** are listed in spec 00 design §15, spec 01 design §12, spec 02 design §15 and spec 03 design §13.
