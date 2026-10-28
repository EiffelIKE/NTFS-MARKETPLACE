# 00 — Foundation · Tasks

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain (`mise exec --` or an activated shell).

## Tasks

- [x] **T01 — Toolchain and manifest** · FND-01, FND-02, FND-03
  - `package.json`: `name`, `private`, `type: module`, `packageManager: pnpm@10.34.3`, `engines.node`, all scripts from design §2.
  - Install the dependencies in design §1, with `pnpm add` respecting `minimumReleaseAge`. Commit `pnpm-lock.yaml`.
  - **Proof:** `rm -rf node_modules && pnpm install --frozen-lockfile` succeeds. `pnpm ls typescript eslint` shows 6.0.x / 9.x.

- [x] **T02 — Vite + React + TS scaffold** · FND-05, FND-06, FND-07, FND-23
  - `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` per design §4. `vite.config.ts` with the `@` alias.
  - `index.html` per design §8. `src/main.tsx`, `src/app/app.tsx`. Empty folders from design §3 get created by the files placed in them in later tasks.
  - **Proof:** `pnpm typecheck` clean. `pnpm dev` serves a page with `lang="pt-BR"` and the expected title/description (re-proved by T12).

- [x] **T03 — Tailwind v4 and shadcn/ui** · FND-21, FND-22
  - Add `@tailwindcss/vite`. Create `src/styles/index.css` (`@import "tailwindcss"; @import "tw-animate-css";`) and import it in `main.tsx`.
  - Run `pnpm dlx shadcn@4.22.1 init` (new-york, neutral, CSS variables, aliases per design §8). Check that `components.json` and `src/lib/utils.ts` (`cn`) exist.
  - Remove `lucide-react` from `package.json` if init added it.
  - **Proof:** a Tailwind utility (e.g. `sr-only`) is applied in `pnpm dev`. `pnpm ls lucide-react` is empty. `pnpm build` succeeds.

- [x] **T04 — ESLint and Prettier** · FND-24, FND-25, FND-15 (rule half)
  - `eslint.config.js` per design §9, including the `axios`/`fetch` restriction rules. `.prettierrc.json` and `.prettierignore` per design §9.
  - **Proof:** `pnpm lint` and `pnpm format:check` clean. Temporarily add `import axios from 'axios'` in `src/routes/index.tsx` and `fetch('/x')` → `pnpm lint` fails on both. Revert.

- [x] **T05 — Vitest** · FND-30
  - `test` block in `vite.config.ts` per design §10.
  - **Proof:** `pnpm test` runs (passes once T06 adds the first test file; until then `--passWithNoTests` is not added to the script).

- [x] **T06 — Environment module** · FND-19, FND-20
  - `src/lib/env.ts` (`envSchema`, `parseEnv`, `env`). `ImportMetaEnv` typing. Build-time validation in `vite.config.ts` via `loadEnv`. `.env.example`.
  - **Proof:** `src/lib/env.test.ts` passes (defaults; invalid `VITE_API_TIMEOUT_MS` → message names the variable). `VITE_API_TIMEOUT_MS=-1 pnpm build` fails with that message.

- [x] **T07 — HTTP client and error normalization** · FND-15, FND-16, FND-17
  - `src/lib/http/errors.ts` (`ApiError`, `toApiError`, `isRetryable`). `src/lib/http/client.ts` (instance and response interceptor).
  - **Proof:** `src/lib/http/errors.test.ts` passes (all five kinds; retryable matrix). FND-16 is a convention (`signal` passed into `http.get`) proved by the first query in spec 02, which aborts on unmount and is checked in its E2E. Note this in spec 02's tasks.

- [x] **T08 — Query client** · FND-14
  - `src/app/query-client.ts` with the defaults table from design §6 and the `Register { defaultError: ApiError }` declaration. Wrap the app in `QueryClientProvider`.
  - **Proof:** `pnpm typecheck` clean. Retry predicate covered by `isRetryable` tests (T07). Defaults reviewed against design §6.

- [x] **T09 — Router core** · FND-08, FND-10, FND-11, FND-12
  - Router plugin in `vite.config.ts` (before `react()`). `src/app/router.ts` per design §5. `src/routes/__root.tsx` with `createRootRouteWithContext<RouterContext>()`, `<HeadContent />`, `<Outlet />`, `notFoundComponent`. `src/components/route-states.tsx` (`NotFound`, `RouteError`).
  - **Proof:** `src/routeTree.gen.ts` is generated on `pnpm dev` / `pnpm build`. `pnpm typecheck` clean. E2E proofs in T12.

- [x] **T10 — Placeholder routes and search validation** · FND-09, FND-13
  - The 9 route files from the design §5 route map, each with `head()` title and an `<h1>`. Home lists `<Link>`s to all of them (dynamic segments use sample ids).
  - `/login` declares `validateSearch` with the `redirect` schema, exported from `src/routes/-login-search.ts`.
  - **Proof:** `src/routes/-login-search.test.ts` passes. `pnpm build` emits one chunk per lazy route (inspect `dist/assets`).

- [x] **T11 — Devtools (dev only)** · FND-18
  - `src/app/devtools.tsx` per design §6, rendered from `app.tsx`.
  - **Proof:** devtools toggles visible in `pnpm dev`. After `pnpm build`, `grep -rlE "TanStackRouterDevtools|ReactQueryDevtools|tanstack-query-devtools" dist` prints nothing.

- [x] **T12 — Playwright and smoke suite** · FND-27, FND-28, FND-29 (+ E2E proof of FND-09, FND-10, FND-11, FND-13, FND-23)
  - `pnpm exec playwright install chromium`. `playwright.config.ts` per design §10. `e2e/smoke.spec.ts` with the six tests from the design §10 table.
  - **Proof:** `pnpm test:e2e` is green in both `desktop-chromium` and `mobile-chromium`. Make one assertion fail on purpose → `playwright-report/` has the HTML report and the failing test has a trace, a screenshot and a video. Revert.

- [x] **T13 — Lighthouse skeleton** · FND-31
  - `lighthouse/desktop.json`, `lighthouse/mobile.json` per design §11.
  - **Proof:** `pnpm lighthouse` runs 3 × 2 URLs × 2 profiles to completion and writes HTML/JSON to `reports/lighthouse/{desktop,mobile}/`. Assertion results on placeholders are recorded but don't block (targets belong to spec 13). If no Chrome is found, set `CHROME_PATH` to Playwright's Chromium and note the path used.

- [x] **T14 — Deploy config and ignores** · FND-32, FND-33
  - `vercel.json` per design §12. `.gitignore` per design §13.
  - **Proof (local):** T12's reload-on-deep-link test passes on `vite preview`. **Proof (remote, user-assisted):** after the user links the Vercel project (with `ENABLE_EXPERIMENTAL_COREPACK=1`, Node 24.x): `curl -sI <url>/nfts/abc` → `200 text/html`; `curl -sI <url>/assets/missing.js` → `404`; opening and refreshing `/cart` and `/nao-existe` in a browser shows the right views. Until then FND-33 stays **pending deploy**; it does not block starting spec 01.
  - *Status 2026-10-27:* local proof done; remote proof pending (Vercel project not linked yet).

- [x] **T15 — Done gate** · FND-03, FND-04, FND-26
  - Run in order from a clean install: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
  - **Proof:** all exit 0 with zero warnings. `pnpm build` typechecks before bundling (break a type → build fails) and `dist/assets` holds hashed, split chunks. Update the spec 00 status in [`../README.md`](../README.md) to **Done** (or **Done — deploy pending** if T14's remote proof is outstanding).

## Run log (2026-10-27)

- Clean gate: `install --frozen-lockfile`, `typecheck`, `lint`, `format:check`, `test` (33 unit tests), `build`, `test:e2e` (28 tests, 14 × 2 projects) all exit 0.
- Lint restriction proof (T04): `axios` import and `fetch` in `src/routes/index.tsx` both reported; reverted.
- `VITE_API_TIMEOUT_MS=-1 pnpm build` → `Invalid environment: VITE_API_TIMEOUT_MS — expected positive integer` (T06). A deliberate type error fails `pnpm build` (T15).
- `dist/` grep for devtools: no matches; both devtools toggles visible in `pnpm dev` (T11).
- Forced E2E failure produced `playwright-report/index.html` plus trace, screenshot and video (T12).
- `pnpm lighthouse` profiles ran end to end; reports in `reports/lighthouse/{desktop,mobile}/` (T13).
- `src/routeTree.gen.ts` must be committed: without it `tsc -b` fails before Vite regenerates it.

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| FND-01 | T01 | manifest + mise |
| FND-02 | T01, T15 | frozen install from clean |
| FND-03 | T01, T15 | scripts run, non-zero on failure |
| FND-04 | T10, T15 | `tsc -b` gate, split chunks |
| FND-05 | T02 | tsconfig + `pnpm typecheck` |
| FND-06 | T02, T03, T04, T05 | alias resolves in Vite, TS, ESLint, Vitest, shadcn |
| FND-07 | T02 | structure per design §3 |
| FND-08 | T09, T10 | generated route tree, lazy chunks |
| FND-09 | T10, T12 | smoke: each route by direct URL |
| FND-10 | T09, T12 | smoke: unknown URL |
| FND-11 | T09, T12 | smoke: aborted chunk → error view → recover |
| FND-12 | T09 | typed `context.queryClient` (typecheck) |
| FND-13 | T10, T12 | `-login-search.test.ts` + smoke |
| FND-14 | T08 | defaults per design §6; `isRetryable` tests |
| FND-15 | T04, T07 | lint rules + single instance |
| FND-16 | T07 | convention, E2E-proved in spec 02 |
| FND-17 | T07 | `errors.test.ts` |
| FND-18 | T11 | `dist` grep |
| FND-19 | T06 | `env.test.ts` + failing build |
| FND-20 | T06, T14 | `.env.example`, `.gitignore` |
| FND-21 | T03 | Tailwind utility applied |
| FND-22 | T03 | `components.json`, `cn`, no lucide |
| FND-23 | T02, T12 | smoke: title / lang / meta |
| FND-24 | T04 | `pnpm lint` |
| FND-25 | T04 | `pnpm format:check` |
| FND-26 | T15 | zero errors / warnings |
| FND-27 | T12 | two Chromium projects against preview |
| FND-28 | T12 | HTML report + trace / screenshot / video on failure |
| FND-29 | T12 | smoke suite |
| FND-30 | T05 | `pnpm test` |
| FND-31 | T13 | LHCI run + reports |
| FND-32 | T14 | `vercel.json` |
| FND-33 | T12, T14 | local reload test; remote check after deploy |
