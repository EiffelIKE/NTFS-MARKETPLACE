# 00 — Foundation · Design

Implements [`requirements.md`](requirements.md). No Figma input; UI here is limited to unstyled placeholders that specs 01 and 05–10 replace.

## 1. Toolchain and dependency policy

| Item | Value | Req. |
|---|---|---|
| Node | `24.11.0` (`mise.toml`), `engines.node: ">=24.11 <25"` | FND-01 |
| pnpm | `10.34.3` (`mise.toml`), `packageManager: "pnpm@10.34.3"` | FND-01 |
| `pnpm-workspace.yaml` | `nodeLinker: hoisted`, `minimumReleaseAge: 10080` (7 days), both set by the user | FND-02 |
| Lockfile | `pnpm-lock.yaml` committed; installs use `--frozen-lockfile` | FND-02 |

`minimumReleaseAge` means pnpm only resolves versions published ≥ 7 days ago. The versions below are the newest that met that rule on 2026-10-27, checked against peer ranges. `package.json` uses caret ranges; the lockfile is the source of truth.

### Version decisions

- **TypeScript `~6.0.3`, not 7.x.** `typescript-eslint@8.72` declares `typescript >=4.8.4 <6.1.0`, and type-aware linting (FND-24) needs it. Revisit when typescript-eslint supports 7.x.
- **ESLint `^9.39`, not 10.x.** `eslint-plugin-jsx-a11y@6.10.2` (latest) declares `eslint ^3 … ^9`. Every other plugin accepts 9.
- **No `@tanstack/zod-adapter`.** Its peer is `zod ^3`. Zod 4 implements Standard Schema, which TanStack Router's `validateSearch` accepts directly. Fallbacks use `.catch()` instead of the adapter's `fallback()`.
- **No `lucide-react`.** `shadcn init` sets `iconLibrary: "lucide"` and generated components import from it, but `AGENTS.md` forbids icon packages. The dependency is removed after init. Spec 01 swaps icon imports for Figma SVG components whenever it adds a shadcn component. Recorded as a deviation in `ARCHITECTURE.md` (spec 14).

### Dependencies

| Runtime | Version | | Dev | Version |
|---|---|---|---|---|
| `react`, `react-dom` | `^19.3.1` | | `vite` | `^8.3.4` |
| `@tanstack/react-router` | `^1.170.45` | | `@vitejs/plugin-react` | `^6.1.2` |
| `@tanstack/react-query` | `^5.104.5` | | `@tanstack/router-plugin` | `^1.168.47` |
| `axios` | `^1.20.0` | | `@tanstack/react-router-devtools` | `^1.167.2` |
| `zod` | `^4.6.7` | | `@tanstack/react-query-devtools` | `^5.104.5` |
| `clsx` | `^2.1.1` | | `typescript` | `~6.0.3` |
| `tailwind-merge` | `^3.7.0` | | `@types/react`, `@types/react-dom` | `^19.3.0` |
| `class-variance-authority` | `^0.7.1` | | `@types/node` | `^24` |
| `tw-animate-css` | `^1.4.0` | | `tailwindcss`, `@tailwindcss/vite` | `^4.3.3` |
| | | | `eslint`, `@eslint/js` | `^9.39` |
| | | | `typescript-eslint` | `^8.72.0` |
| | | | `eslint-plugin-react-hooks` | `^7.1.1` |
| | | | `eslint-plugin-react-refresh` | `^0.5.7` |
| | | | `eslint-plugin-jsx-a11y` | `^6.10.2` |
| | | | `@tanstack/eslint-plugin-query` | `^5.104.5` |
| | | | `@tanstack/eslint-plugin-router` | `^1.162.0` |
| | | | `eslint-config-prettier` | `^10.1.8` |
| | | | `globals` | `^17` |
| | | | `prettier` | `^3.9.10` |
| | | | `prettier-plugin-tailwindcss` | `^0.8.1` |
| | | | `vitest` | `^5.0.5` |
| | | | `@playwright/test` | `^1.64.1` |
| | | | `@lhci/cli` | `^0.15.1` |

Devtools are dev dependencies: they are imported only behind `import.meta.env.DEV` (§6). Deploys install dev dependencies, so the build still resolves them.

## 2. Scripts (FND-03, FND-04)

| Script | Command |
|---|---|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `typecheck` | `tsc -b` |
| `lint` | `eslint . --max-warnings 0` |
| `format` | `prettier . --write` |
| `format:check` | `prettier . --check` |
| `test` | `vitest run` |
| `test:e2e` | `playwright test` (its `webServer` builds and previews) |
| `test:e2e:report` | `playwright show-report` |
| `lighthouse` | `pnpm build && lhci autorun --config=lighthouse/desktop.json && lhci autorun --config=lighthouse/mobile.json` |

Ports: dev `5173`, preview `4173` (`strictPort` on both).

## 3. Project structure (FND-07)

```
index.html
vite.config.ts            # plugins, alias, env validation, vitest block
playwright.config.ts
eslint.config.js
.prettierrc.json  .prettierignore
components.json           # shadcn
vercel.json
.env.example
lighthouse/{desktop,mobile}.json
e2e/
  smoke.spec.ts
src/
  main.tsx                # mounts <App/>
  routeTree.gen.ts        # generated — never edited, lint/format-ignored, committed (tsc -b runs before Vite regenerates it)
  app/
    app.tsx               # QueryClientProvider + RouterProvider + devtools
    router.ts             # createRouter, Register declaration, RouterContext type
    query-client.ts       # QueryClient + baseline defaults
    devtools.tsx          # lazy, DEV-only devtools
  routes/                 # file-based routes; thin — wire params/search/loaders to features
  features/<feature>/     # from spec 02 on: api/ (query options, mutations), components/, model/
  components/
    ui/                   # shadcn-generated (spec 01 restyles)
    route-states.tsx      # NotFound + RouteError views
  lib/
    env-schema.ts         # envSchema + parseEnv (pure; also imported by vite.config.ts)
    env.ts                # re-exports + `env` parsed from import.meta.env
    http/client.ts        # the Axios instance
    http/errors.ts        # ApiError + toApiError + isRetryable
    utils.ts              # cn()
  styles/index.css        # Tailwind entry
```

Rules: `routes/` imports from `features/`, never the other way. `features/*` talk to the network only through `lib/http/client`. Files under `routes/` starting with `-` are ignored by the router generator (colocated helpers).

## 4. TypeScript (FND-05, FND-06)

Vite-style project references: `tsconfig.json` (references only, plus `compilerOptions.paths` so the shadcn CLI resolves `@/*`), `tsconfig.app.json` (`src/`), `tsconfig.node.json` (configs + `e2e/`).

Shared options: `target: ES2023`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `skipLibCheck`. `paths: { "@/*": ["./src/*"] }` without `baseUrl` (deprecated in TS 6). App `types: ["vite/client"]`; node `types: ["node"]`.

Alias `@` → `src/` is declared in: tsconfig `paths`, `vite.config.ts` `resolve.alias` (Vitest inherits it), `components.json` aliases. ESLint resolves through the TS project service.

Risk: `exactOptionalPropertyTypes` can reject shadcn-generated code that passes `undefined` to optional props. We own that code, so it gets fixed locally. The flag stays on.

## 5. Routing (FND-08 – FND-13)

`@tanstack/router-plugin/vite` with `target: 'react'`, `autoCodeSplitting: true`, `routesDirectory: src/routes`, `generatedRouteTree: src/routeTree.gen.ts`. It must come **before** `@vitejs/plugin-react` in `plugins`.

### Route map

| File | Path | Placeholder `<h1>` / title (pt-BR) | Owner |
|---|---|---|---|
| `__root.tsx` | — | — | 00 / 01 |
| `index.tsx` | `/` | "KURIO" + nav list linking every route below | 05 |
| `nfts/$nftId.tsx` | `/nfts/$nftId` | "Detalhes do NFT" | 06 |
| `cart.tsx` | `/cart` | "Carrinho" | 07 |
| `checkout.tsx` | `/checkout` | "Finalizar compra" | 09 |
| `orders/$orderId.tsx` | `/orders/$orderId` | "Confirmação do pedido" | 10 |
| `login.tsx` | `/login` | "Entrar" | 04 |
| `signup.tsx` | `/signup` | "Criar conta" | 04 |
| `profile.tsx` | `/profile` | "Perfil" | 08 |
| `wallets.tsx` | `/wallets` | "Carteiras" | 08 |

Placeholder copy is temporary and gets replaced by Figma copy in each owner spec. Spec 04 may move private routes under a pathless `_authenticated` layout; paths stay the same. Document titles use `"<screen> · KURIO"`, set through each route's `head()` and rendered by `<HeadContent />` in the root component.

### Router instance (`app/router.ts`)

```ts
export interface RouterContext {
  queryClient: QueryClient
  session: SessionController // spec 04
}

export const router = createRouter({
  routeTree,
  context: { queryClient, session },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,          // Query owns freshness
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' { interface Register { router: typeof router } }
```

The root route is `createRootRouteWithContext<RouterContext>()`, which gives every `loader`/`beforeLoad` typed access to `context.queryClient` (FND-12).

### Not-found and error views (FND-10, FND-11)

- `NotFound`: `<h1>Página não encontrada</h1>`, short text, `<Link to="/">Voltar ao início</Link>`, title `"Página não encontrada · KURIO"`. The URL stays as typed. Also the root route's `notFoundComponent`. Later specs throw `notFound()` for missing resources (e.g. NFT 404 in spec 06) and get the same view unless they override it.
- `RouteError`: `<h1>Algo deu errado</h1>`, a generic message (no stack in production), and a "Tentar novamente" button that calls `router.invalidate()`, plus a "Recarregar página" fallback (`location.reload()`). The most realistic production failure is a lazy route chunk failing to load (e.g. after a redeploy), which is also how the E2E test triggers it (§10).

### Search params (FND-13)

Routes declare `validateSearch: someZodSchema` (Zod 4, Standard Schema, no adapter). Convention for later specs: every field is optional or has `.catch(<default>)`, so a malformed URL degrades to defaults instead of throwing. Spec 00 proved the mechanism on `/login` with the param spec 04 needs:

```ts
const loginSearch = z.object({
  redirect: z.string().startsWith('/').refine((s) => !s.startsWith('//')).optional().catch(undefined),
})
```

Only same-origin paths survive, so there is no open redirect. Spec 04 added the behavior: the schema is now `authSearchSchema` in `features/auth/model/auth-search.ts`, shared by `/login` and `/signup` with a `reason: 'expired'` field.

## 6. Server state and HTTP (FND-14 – FND-18)

### Query client (`app/query-client.ts`) — baseline cache policy

| Option | Value | Why |
|---|---|---|
| `queries.staleTime` | `30_000` | Avoid refetch storms on navigation; realtime (03) and invalidation keep data fresh. Specs may override per query. |
| `queries.gcTime` | `300_000` (default) | |
| `queries.retry` | `(n, err) => n < 2 && isRetryable(err)` | Retry only network, timeout, 408, 429 and 5xx. Never retry 4xx or cancellations. |
| `queries.retryDelay` | default exponential (1s, 2s, cap 30s) | Playwright controls the clock where timing matters. |
| `queries.refetchOnWindowFocus` | `true` (default) | Cheap reconciliation for prices and availability. |
| `queries.refetchOnReconnect` | `true` (default) | |
| `mutations.retry` | `0` | Never replay writes automatically; idempotent recovery is explicit (spec 09). |

The error type is registered globally: `declare module '@tanstack/react-query' { interface Register { defaultError: ApiError } }`.

### Axios instance (`lib/http/client.ts`)

```ts
export const http = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})
http.interceptors.response.use((r) => r, (e) => Promise.reject(toApiError(e)))
```

Query functions receive TanStack Query's `signal` and pass it as `http.get(url, { signal })` (FND-16). Spec 04 adds the auth request interceptor and the 401 handler on this same instance. An ESLint `no-restricted-imports` / `no-restricted-globals` rule blocks importing `axios` outside `lib/http/` and calling `fetch` in `src/` (FND-15).

### Error shape (`lib/http/errors.ts`, FND-17)

```ts
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'cancelled' | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly data: unknown          // raw body; spec 02 parses it into the error envelope
}

export function toApiError(e: unknown): ApiError
export function isRetryable(e: unknown): boolean
```

Mapping: `axios.isCancel(e)` or `code === 'ERR_CANCELED'` → `cancelled`. `ECONNABORTED` / `ETIMEDOUT` → `timeout`. Has `response` → `http` with `status`. Has `request` but no `response` → `network`. Anything else → `unknown`.

### Devtools (FND-18)

`app/devtools.tsx` exports a component equal to `() => null` unless `import.meta.env.DEV`, in which case it `lazy()`-imports both devtools. Vite replaces `import.meta.env.DEV` with `false` in production, so the dynamic imports are dead code and get dropped. Verified by searching `dist/` for the devtools package names.

## 7. Environment (FND-19, FND-20)

`lib/env.ts` exports `envSchema`, `parseEnv(raw)` and `env = parseEnv(import.meta.env)`. The schema and `parseEnv` live in `lib/env-schema.ts` (re-exported by `env.ts`) because `vite.config.ts` imports them in Node, where `import.meta.env` does not exist.

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | non-empty string | `/api` | REST base. MSW (02) intercepts this same path, so the same build works mocked or against a real API. |
| `VITE_API_TIMEOUT_MS` | positive int (coerced) | `10000` | Axios timeout; spec 02 timeout scenarios rely on it. |

Spec 02 adds `VITE_ENABLE_MOCKS`, spec 03 adds `VITE_REALTIME_URL` (a URL, default `wss://realtime.kurio.example`, a reserved host that never reaches a real server), by extending the same schema.

Fail fast happens twice. `vite.config.ts` loads env with `loadEnv` and runs `parseEnv`, so a bad deploy fails at build time. `main.tsx` imports `env` first, so a bad runtime env throws before render. The error message lists each invalid variable and the Zod reason, e.g. `Invalid environment: VITE_API_TIMEOUT_MS — expected positive integer`.

`.env.example` is committed. `.gitignore` covers `.env*.local`.

## 8. Styling and shadcn (FND-21 – FND-23)

- `vite.config.ts`: `tailwindcss()` from `@tailwindcss/vite`. `src/styles/index.css` starts with `@import "tailwindcss"; @import "tw-animate-css";`.
- `shadcn init` (pinned CLI `shadcn@4.22.1`, run through `pnpm dlx`): base color `neutral`, CSS variables on, aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. The variables it generates are left as they are; spec 01 replaces them with Figma tokens. Remove `lucide-react` afterwards (§1).
  - **As run:** shadcn 4.x no longer offers the legacy `new-york` style, only presets. Used `init --force --no-reinstall --no-monorepo -b radix -p vega` (Radix primitives; Vega is the classic shadcn look) → `components.json` `style: "radix-vega"`, runtime dep `radix-ui`.
  - Post-init cleanup: init added `cn` (shadcn's clsx + tailwind-merge replacement) and rewrote `lib/utils.ts` to re-export it; reverted to the classic `cn()` over `clsx` + `tailwind-merge` and removed `cn`. Removed `lucide-react` and `@fontsource-variable/inter` (and its `@import` / `--font-sans`; the font is Roboto Mono, spec 01). Moved `shadcn` to `devDependencies` (pinned `4.22.1`): only its `shadcn/tailwind.css` is used, at build time.
- `src/styles/index.css` imports Tailwind as `@import 'tailwindcss' source('..')` so only `src/` is scanned; otherwise class-like words in `SPECS-NTFS/` and `figma_tokens/` leak into the CSS (25 KB → 9 KB).
- `index.html`: `<html lang="pt-BR">`, `<meta charset>`, `<meta name="viewport" content="width=device-width, initial-scale=1">` (no `maximum-scale`, so zoom keeps working), `<meta name="description" content="KURIO — marketplace de NFTs: descubra, colecione e compre edições digitais.">`, `<meta name="theme-color" content="#140D0A">`, `<title>KURIO — Marketplace de NFTs</title>`. Favicon: `<link rel="icon" href="data:,">` until spec 01 brings the Figma asset. This avoids a `/favicon.ico` 404, which Lighthouse Best Practices counts as a console error.

## 9. Lint and format (FND-24 – FND-26)

`eslint.config.js` (flat), in order:

1. `ignores`: `dist`, `src/routeTree.gen.ts`, `playwright-report`, `test-results`, `reports`, `.lighthouseci`.
2. `@eslint/js` recommended.
3. `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, `parserOptions.projectService: true`. Config files that are plain JS use `disableTypeChecked`.
4. `eslint-plugin-react-hooks` flat recommended preset (v7, includes the React Compiler–aware rules).
5. `eslint-plugin-react-refresh` (`configs.vite`) with `allowExportNames: ['Route']`. Turned off for `src/components/ui/**` (shadcn exports variants) and `src/routes/**`: v0.5 reports a file-local component when the file exports only non-components (`Route`), and with `autoCodeSplitting` the router plugin moves the component into its own module anyway.
6. `eslint-plugin-jsx-a11y` flat `strict`.
7. `@tanstack/eslint-plugin-query` flat recommended; `@tanstack/eslint-plugin-router` flat recommended.
8. Project rules: `no-restricted-imports` for `axios` outside `src/lib/http/**`, `no-restricted-globals` for `fetch` in `src/**` (FND-15). Spec 03 adds `socket.io-client` (only `src/lib/realtime/**`) and `@mswjs/socket.io-binding` (only `src/mocks/**`).
9. `eslint-config-prettier` last.

`.prettierrc.json`: `singleQuote: true`, `semi: false`, `trailingComma: "all"`, `printWidth: 100`, plugins `prettier-plugin-tailwindcss` with `tailwindStylesheet: "./src/styles/index.css"` and `tailwindFunctions: ["cn", "cva"]`.
`.prettierignore`: `dist`, `pnpm-lock.yaml`, `src/routeTree.gen.ts`, `playwright-report`, `test-results`, `reports`, `.lighthouseci`, plus hand-written docs that Prettier would re-flow: `SPECS-NTFS`, `figma_tokens`, `OBJETIVES.md`, `AGENTS.md`, `CLAUDE.md`, `.agents`.

## 10. Testing (FND-27 – FND-30)

### Playwright (`playwright.config.ts`)

- `testDir: 'e2e'`, `fullyParallel: true`, `forbidOnly: !!process.env.CI`, `retries: CI ? 2 : 0`.
- `reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]`.
- `use`: `baseURL: 'http://localhost:4173'`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, `locale: 'pt-BR'`, `timezoneId: 'UTC'`.
- `projects`:
  - `desktop-chromium`: `devices['Desktop Chrome']`, viewport `1440×900`.
  - `mobile-chromium`: Chromium, viewport `390×844`, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, user agent from `devices['Pixel 7']`.
- `webServer`: `pnpm build && pnpm preview --port 4173 --strictPort`, `url: 'http://localhost:4173'`, `reuseExistingServer: !process.env.CI`, `timeout: 180_000`. Tests run against the optimized build, the same thing that gets deployed.

### Smoke suite (`e2e/smoke.spec.ts`, FND-29 + FND-10/11/13)

| Test | Proves |
|---|---|
| Home shows "KURIO" heading and a link to each route | FND-09 |
| For each route in §5 (concrete ids for dynamic segments): `goto` → expected `<h1>` and `<title>` | FND-09, FND-23 |
| `goto('/nfts/abc')`, `reload()` → still "Detalhes do NFT", URL unchanged | FND-29, FND-33 (locally) |
| `goto('/nao-existe')` → "Página não encontrada", URL unchanged, "Voltar ao início" leads to `/` | FND-10 |
| Load `/`, then `page.route('**/assets/cart-*.js', abort)`, click the "Carrinho" link → "Algo deu errado"; unroute, then "Tentar novamente" → "Carrinho" (one test) and "Recarregar página" → "Carrinho" (another). Only the cart chunk is blocked: on a missing module TanStack Router reloads the page once (`lazyRouteComponent`, sessionStorage flag), so blocking every `assets/*.js` would also block the main bundle after that reload. | FND-11 |
| `goto('/login?redirect=https://evil.test')` → page renders, no crash. `/login?redirect=/cart` → renders. (The parsed value is checked in the unit test.) | FND-13 |

### Unit (Vitest, FND-30)

Configured in a `test` block in `vite.config.ts` (`/// <reference types="vitest/config" />`): `environment: 'node'`, `include: ['src/**/*.test.ts']`. Later specs that need a DOM add a per-file `@vitest-environment` comment.

Initial tests:
- `lib/http/errors.test.ts`: `toApiError` maps cancel, timeout, network, http and unknown. `isRetryable` is true for network, timeout, 408, 429 and 5xx, and false for other 4xx and cancelled.
- `lib/env.test.ts`: defaults apply; an invalid timeout throws a message naming `VITE_API_TIMEOUT_MS`.
- `routes/-login-search.test.ts`: the `redirect` schema keeps `/cart` and drops `https://evil.test`, `//evil.test` and non-strings.

## 11. Lighthouse skeleton (FND-31)

`lighthouse/desktop.json` and `lighthouse/mobile.json` (LHCI config):

- `ci.collect`: `startServerCommand: "pnpm preview --port 4173 --strictPort"`, `startServerReadyPattern: "Local"`, `url: ["http://localhost:4173/", "http://localhost:4173/nfts/<fixture-id>"]` (`/nfts/1` until spec 02 fixes the fixture id), `numberOfRuns: 3`. Desktop adds `settings.preset: "desktop"`; mobile uses the default mobile emulation.
- `ci.assert.assertions`: `categories:performance ≥ 0.90`, `categories:accessibility ≥ 0.95`, `categories:best-practices ≥ 0.95`, `categories:seo ≥ 0.90`, all `"error"` with `aggregationMethod: "median-run"`.
- `ci.upload`: `target: "filesystem"`, `outputDir: "reports/lighthouse/<profile>"` (git-ignored). HTML and JSON per run plus a `manifest.json` with medians.
- Chrome: LHCI uses `CHROME_PATH` when set. Spec 13 points it at Playwright's Chromium for reproducibility. In 00 the config only has to run end to end once. Scores on placeholders don't count. First run (2026-10-27) used the system `/usr/bin/google-chrome` (no `CHROME_PATH`); medians on placeholders: desktop 1 / 1 / 1 / 0.91, mobile 0.99 / 1 / 1 / 0.91 (perf / a11y / BP / SEO).

## 12. Deployment (FND-32, FND-33)

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!assets/).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

- Vercel serves real files before rewrites, so `mockServiceWorker.js` (spec 02) and other root files keep working. `/assets/*` is excluded from the rewrite, so a missing hashed chunk returns 404 instead of HTML. That surfaces as the route error view, not a parse error.
- Unknown paths return the SPA with HTTP 200 and the router renders the not-found view. This is a known SPA limitation, documented in spec 14.
- User setup (needs their account): link the project, set `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses `packageManager`'s pnpm version, and set Node 24.x. Verification: open a deep link and refresh it on the deploy URL.

## 13. Ignored outputs

`.gitignore` (git initialized 2026-10-27): `node_modules`, `dist`, `*.local`, `.env*.local`, `playwright-report`, `test-results`, `blob-report`, `reports`, `.lighthouseci`, `.vercel`, `node_modules/.tmp` (tsbuildinfo), and `figma_tokens/screenshots/` (multi-MB Figma PNG exports kept as local reference only, out of the repo).

## 14. Deviations and notes for `ARCHITECTURE.md`

- TypeScript pinned to 6.0.x and ESLint to 9.x for plugin compatibility (§1).
- No icon package; shadcn icon imports get replaced in spec 01 (§1).
- SPA not-found returns HTTP 200 on Vercel (§12).
- Baseline cache/retry policy (§6) is the starting point for the policy doc in spec 14.
- shadcn initialized with the `radix-vega` preset instead of `new-york` (no longer offered by the CLI); `cn` package dropped in favor of `clsx` + `tailwind-merge` (§8).
- `react-refresh/only-export-components` off in `src/routes/**` (§9).
- A failed lazy route chunk triggers one automatic page reload (TanStack Router) before the error view shows (§10).

## 15. Amendments requested by later specs

Pending changes collected when specs 03–14 were drafted; each is applied by the owning spec's tasks.

| From | Change |
|---|---|
| 03 | `VITE_REALTIME_URL` in `lib/env.ts` and `.env.example` — **applied in spec 03** |
| 04 | `RouterContext.session`; the root route waits for the session check; `reason` search param on `/login` and `/signup`; auth interceptors on the Axios instance — **applied in spec 04** (design §14) |
| 12 | Playwright projects/config for visual tests; scripts `test:visual`, `test:visual:update` |
| 13 | Script `lighthouse:deployed`; `public/robots.txt` (the SPA rewrite would answer it with HTML); `kurio-build` meta tag with the commit id |
| 14 | Script `docs`; Vitest also collects `scripts/**/*.test.ts` |
