# 00 — Foundation · Requirements

Scaffold the application so every later spec plugs into a working, typed, tested and deployable shell. No product features, design tokens, mocks or realtime here — only the plumbing they depend on.

Brief coverage: §2 (required stack), §4 (route handling, direct access), §9 (Playwright setup), §10 (Lighthouse setup), §12 (commands, deploy, clean checkout).

## User stories

- **US-1** — As an evaluator, I can clone the repo, install with one command and start the app locally, so I can review it without private services.
- **US-2** — As a developer, I get fast feedback from typecheck, lint, format and tests through stable `pnpm` scripts.
- **US-3** — As a developer of later specs, I find routing, server-state, HTTP and environment plumbing already in place, so feature specs only add feature code.
- **US-4** — As an evaluator, I can open any required screen by URL — locally and on the public deploy — including a refresh on a deep link and a nonexistent path.

## Acceptance criteria

### Toolchain and scripts

- **FND-01** — THE SYSTEM SHALL pin Node and pnpm through `mise.toml` and declare the same pnpm version in `package.json#packageManager` and a matching `engines.node` range.
- **FND-02** — WHEN `pnpm install --frozen-lockfile` runs on a clean checkout with the pinned toolchain, THE SYSTEM SHALL install without errors and without network calls beyond the package registry.
- **FND-03** — THE SYSTEM SHALL expose these `package.json` scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`, `test` (unit), `test:e2e`, `test:e2e:report`, `lighthouse`. Each SHALL exit non-zero on failure.
- **FND-04** — WHEN `pnpm build` runs, THE SYSTEM SHALL typecheck first and emit a static bundle to `dist/` with hashed assets and route-level code splitting.

### Language, framework and structure

- **FND-05** — THE SYSTEM SHALL use React with TypeScript in `strict` mode, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`.
- **FND-06** — THE SYSTEM SHALL resolve the `@/` import alias to `src/` consistently in the bundler, TypeScript, ESLint, the unit test runner and shadcn's `components.json`.
- **FND-07** — THE SYSTEM SHALL organize source code by responsibility (`app/`, `routes/`, `features/`, `components/ui/`, `lib/`), documented in `design.md`, so later specs know where code goes.

### Routing (TanStack Router)

- **FND-08** — THE SYSTEM SHALL use TanStack Router with file-based route generation and automatic route code splitting; the generated route tree SHALL be type-checked and not edited by hand.
- **FND-09** — THE SYSTEM SHALL register a route for every screen in brief §3 (home, NFT details, cart, checkout, order confirmation, login, sign-up, profile, wallets). Until its owner spec lands, each route SHALL render a minimal placeholder heading with the screen name and no interactive controls that imply working functionality.
- **FND-10** — WHEN a URL matches no route, THE SYSTEM SHALL render a not-found view with a link back to home, keep the requested URL in the address bar, and set the document title accordingly.
- **FND-11** — WHEN a route throws during loading or rendering, THE SYSTEM SHALL render a root error view with a retry action instead of a blank page.
- **FND-12** — THE SYSTEM SHALL inject the Query client into the router context, so later specs can prefetch in route loaders and read it in `beforeLoad` guards.
- **FND-13** — THE SYSTEM SHALL validate search params per route through a typed schema mechanism, so specs 05+ can declare URL state without additional setup.

### Server state (TanStack Query) and HTTP (Axios)

- **FND-14** — THE SYSTEM SHALL create a single Query client with explicit defaults (stale time, retry policy that skips 4xx, refetch-on-focus behavior) defined in one module and listed in `design.md` as the baseline cache policy.
- **FND-15** — THE SYSTEM SHALL create a single Axios instance whose base URL and timeout come from validated environment configuration; no other module SHALL call `fetch` or create Axios instances for REST.
- **FND-16** — WHEN a query is cancelled by TanStack Query, THE SYSTEM SHALL abort the underlying Axios request (the `signal` is forwarded).
- **FND-17** — THE SYSTEM SHALL normalize Axios failures into one typed error shape (network, timeout, HTTP status, cancelled), so specs 02+ can extend it with the API error envelope.
- **FND-18** — THE SYSTEM SHALL render TanStack Router and Query devtools only in development builds; they SHALL NOT be included in the production bundle.

### Environment configuration

- **FND-19** — THE SYSTEM SHALL read environment variables through one typed module that validates them at startup; WHEN a required variable is missing or invalid, THE SYSTEM SHALL fail fast with a message naming the variable.
- **FND-20** — THE SYSTEM SHALL ship a committed `.env.example` listing every variable with a safe default and a comment; real `.env*.local` files SHALL be git-ignored.

### Styling and components

- **FND-21** — THE SYSTEM SHALL install Tailwind CSS v4 through its Vite plugin with a single CSS entry; theme tokens are added in spec 01.
- **FND-22** — THE SYSTEM SHALL initialize shadcn/ui (`components.json`, `cn()` helper, `components/ui/` target) so components can be added with the shadcn CLI; no components are restyled here.
- **FND-23** — THE SYSTEM SHALL set `<html lang="pt-BR">`, a document title, a meta description and a viewport meta tag in `index.html`.

### Code quality

- **FND-24** — THE SYSTEM SHALL lint with ESLint (flat config) including type-aware TypeScript rules, React Hooks rules, JSX accessibility rules, and the TanStack Query and Router plugins.
- **FND-25** — THE SYSTEM SHALL format with Prettier, including Tailwind class sorting; lint and format SHALL not conflict.
- **FND-26** — WHEN `pnpm typecheck`, `pnpm lint` and `pnpm format:check` run on the foundation code, THE SYSTEM SHALL report zero errors and zero warnings.

### Testing

- **FND-27** — THE SYSTEM SHALL configure Playwright with Chromium projects for a desktop viewport (1440 × 900) and a mobile viewport (390 × 844), running against the production build served by `vite preview`.
- **FND-28** — THE SYSTEM SHALL produce an HTML report on every run and keep traces, screenshots and video for failed tests.
- **FND-29** — THE SYSTEM SHALL include an E2E smoke suite proving: home renders; each placeholder route is reachable by direct URL; a reload on a deep link keeps the route; an unknown URL renders the not-found view.
- **FND-30** — THE SYSTEM SHALL configure a unit test runner sharing the bundler config, for pure logic in later specs (money math, event version guard, contracts).

### Performance audit skeleton

- **FND-31** — THE SYSTEM SHALL commit a Lighthouse CI configuration targeting the home and NFT details routes, with desktop and mobile presets, 3 runs each, the assertion thresholds from brief §10, and HTML/JSON output to a git-ignored reports folder. Running it against the full app is spec 13.

### Deployment

- **FND-32** — THE SYSTEM SHALL commit Vercel configuration that builds with pnpm, serves `dist/`, rewrites every non-asset path to `index.html`, and sets long-lived cache headers for hashed assets.
- **FND-33** — WHEN the deployed app is opened on any route path or refreshed there, THE SYSTEM SHALL serve the SPA and let the router resolve the route (including the not-found view).

## Out of scope

- Design tokens, fonts, icons, app shells (header, footer, tab bar) — spec 01.
- MSW, contracts, fixtures, scenarios, the mock-enable flag — spec 02.
- Socket.IO client — spec 03.
- Auth guards and the session interceptor on the Axios instance — spec 04 (FND-12/15 only leave the hook points).
- Real Lighthouse runs and analysis — spec 13. `README.md` / `ARCHITECTURE.md` content — spec 14.
- CI pipeline — not until the user asks; the Vercel project is linked by the user (requires their account).

## Decisions (approved 2026-10-27)

1. **Unit test runner (FND-30)**: Vitest, for pure logic in 02/03 (big.js math, dedupe/version guard, contracts).
2. **TypeScript**: newest version supported by `typescript-eslint` (6.0.x), not 7.x. Rationale in [`design.md`](design.md#version-decisions).
3. **Route paths**: English (`/`, `/nfts/$nftId`, `/cart`, `/checkout`, `/orders/$orderId`, `/login`, `/signup`, `/profile`, `/wallets`); UI copy stays pt-BR.
