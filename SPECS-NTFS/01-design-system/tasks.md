# 01 — Design system · Tasks

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Starts after spec 00 is **Done**. Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

## Blockers (user-provided inputs)

The Figma MCP quota is exhausted, so these come from the user. No task in this spec is blocked any more.

- **B1 — Missing icon exports.** Resolved 2026-10-27: every icon in the design §5 registry was delivered, including `eye-off`, `star`, `menu` and the share row set in `share_icons/` (`linkedin`, `twitter`, `mail`).
- ~~B2 — Footer copy~~ — resolved: read from the full-page screenshots; copy is in design §8.
- ~~B3 — Reference screenshots~~ — resolved: full-page PNGs of every frame are in `figma_tokens/screenshots/{desktop,mobile}/`. T17 crops the header, footer and tab bar from `desktop/Início.png`, `desktop/Detalhes do NFT.png` (header without divider) and `mobile/Início.png`.

## Tasks

- [x] **T01 — Dependencies and lint guard** · DS-09, DS-11
  - `pnpm add @fontsource-variable/roboto-mono radix-ui sonner` and `pnpm add -D vite-plugin-svgr @axe-core/playwright` (versions per design §1).
  - ESLint: add `lucide-react` to `no-restricted-imports` with the message "Use icons from @/components/icons (AGENTS.md)".
  - **Proof:** `pnpm install --frozen-lockfile` from clean succeeds. A temporary `import { X } from 'lucide-react'` fails `pnpm lint`. Revert.

- [x] **T02 — Theme tokens** · DS-01, DS-02, DS-04, DS-05, DS-06
  - Split `src/styles/` into `index.css` (imports in design §2 order), `theme.css`, `base.css`. Remove the oklch `:root`/`.dark` block that `shadcn init` wrote in spec 00.
  - `theme.css`: reset `--color-*`, `--radius-*`, `--shadow-*`; add every token from design §3 (Figma + derived), the `bg-primary-soft` / `bg-card-gradient` utilities, layout variables, and the shadcn mapping in `@theme inline` with `--radius: 6px`. `color-scheme: dark` on `html`.
  - `src/styles/contrast.test.ts` (design §9) with the full contrast table; `src/styles/no-raw-colors.test.ts`.
  - **Proof:** `pnpm test` green — both tests pass, and each fails when a token or a stray `#fff` in a `.tsx` is introduced (try once, revert). `pnpm build` succeeds. A sample `bg-red-500` class produces no CSS (grep `dist/assets/*.css`).

- [x] **T03 — Typography and font** · DS-03, DS-09, DS-10
  - Import `@fontsource-variable/roboto-mono/wght.css` in `index.css`. Reset `--text-*` and `--font-*`; define `--font-sans`/`--font-mono`, the 9 steps with line heights and default weights, `--tracking-brand`.
  - Add the `Roboto Mono Fallback` `@font-face` to `base.css` (design §4).
  - Write the Figma style → step mapping table into design §3 if anything changed while implementing.
  - **Proof:** `pnpm build` emits `roboto-mono-latin-wght-normal-*.woff2` in `dist/assets`. In `pnpm preview`, DevTools shows the font served from the app origin and the body computed font is `Roboto Mono Variable`. E2E proof in T16.

- [x] **T04 — Base layer** · DS-15, DS-23
  - `base.css`: body defaults (`bg-background text-foreground font-sans text-body`), global `:focus-visible` outline (design §6), global reduced-motion rule (design §7), `sr-only`-based skip-link styles.
  - **Proof:** in `pnpm dev`, tabbing to any link shows the 2 px accent ring with offset; with "reduce motion" emulated in DevTools, a `tw-animate-css` enter animation does not play.

- [x] **T05 — Icons** · DS-11, DS-12, DS-13
  - Add `vite-plugin-svgr` to `vite.config.ts` (options per design §5); add `vite-plugin-svgr/client` to `tsconfig.app.json` `types`.
  - Normalize each exported SVG (remove `width`/`height`, `currentColor`, keep `opacity`). Create `components/icons/index.ts` registry (design §5, including the rotation wrappers) and `components/icons/drawn.tsx` (`close`, `check`, `alert-circle`, `check-circle`, `spinner`, `eye`). `social_login/*` stay in brand colors.
  - **Proof:** `pnpm typecheck` clean with `?react` imports. Every registry icon renders in the gallery (T15) in `text-text-accent` and `text-foreground` (color follows `currentColor`). `grep -L 'currentColor' src/assets/icons/*.svg src/assets/social/*.svg` prints nothing. Rendered `<svg>` elements have `aria-hidden="true"`.

- [x] **T06 — Form and display components** · DS-08, DS-14, DS-16, DS-17, DS-20
  - `shadcn add button input label input-group field checkbox radio-group select slider tabs pagination badge separator tooltip breadcrumb avatar dropdown-menu alert`.
  - `PasswordInput` (login, sign-up, profile): `input-group` with a toggle button labelled "Mostrar senha" / "Ocultar senha" and `aria-pressed`, using `EyeOffIcon` while hidden and the drawn `eye` while visible (design §5).
  - For each: replace lucide imports with registry/drawn icons; remove shadcn `focus-visible:ring-*` classes; apply the design §6 styling table (variants, sizes, states, token radii). Add the Button `loading` prop and the chip variant of `radio-group`. Slider thumb hit area ≥ 28 via `::before`.
  - `lib/forms.ts` → `focusFirstInvalid(form)`.
  - **Proof:** `pnpm lint` (no lucide), `pnpm typecheck` clean. In the gallery (T15) every state from the table is visible. Each selected/current/checked state differs from default by something besides border color (fill, weight, underline or icon) — checked by eye against DS-08, then by T16 axe.

- [x] **T07 — Dialog and sheet** · DS-18
  - `shadcn add dialog sheet`. Restyle per design §6 (scrim, radius, close button with `aria-label="Fechar"`). Sheet: bottom below `lg`, right from `lg`, safe-area padding.
  - **Proof:** in the gallery, keyboard-only: open → focus inside → `Tab` cycles → `Esc` closes → focus back on trigger. E2E in T16.

- [x] **T08 — Feedback channel** · DS-19
  - `shadcn add sonner`; restyle. `components/feedback/`: `<Toaster />` (positions per design §6), `<Announcer />`, `notify.*`, `announce()`. Mount both once in `__root.tsx`.
  - `src/components/feedback/announcer.test.ts`: identical consecutive messages are re-announced.
  - **Proof:** `pnpm test` green. In the gallery, toast and announce triggers update the live regions (inspect with the accessibility tree in DevTools). E2E in T16.

- [x] **T09 — Skeleton and loading region** · DS-21, DS-22, DS-23
  - `shadcn add skeleton`; switch it to the `skeleton` utility (design §7). `LoadingRegion` component with `aria-busy` and the visually hidden status label.
  - **Proof:** the gallery shows shimmering skeletons of fixed sizes; toggling the demo's loaded state swaps content with no shift (DevTools Performance → Layout Shift = 0). Reduced motion stops the shimmer (E2E in T16).

- [x] **T10 — Layout primitives and shell config** · DS-29, DS-30
  - `components/layout/`: `PageContainer`, `SkipLink`, `UnavailableLink` (tooltip + `aria-describedby` + `notify.info` on activation, no `href`).
  - `components/layout/shell-config.ts`: `ShellConfig` type, `StaticDataRouteOption` augmentation, default config, `useShellConfig()` (deepest match).
  - **Proof:** `pnpm typecheck` clean; a route with a wrong `staticData.shell` shape fails typecheck (try once, revert).

- [x] **T11 — Desktop header** · DS-25, DS-28
  - `DesktopHeader` per design §8: wordmark, nav with `Mercado` → `/#mercado`, `UnavailableLink` for `Criadores`/`Aprenda`, search button (unavailable until spec 05 passes `onSearch`), cart link + badge + pt-BR count label, `Entrar` → `/login?redirect=…`; divider variant.
  - **Proof:** on `/` (divider, `Início` active) and `/nfts/abc` (no divider, `Mercado` active) the header matches the design notes; `aria-current` only on `/`. E2E in T16.

- [x] **T12 — Desktop footer** · DS-26, DS-29
  - `DesktopFooter` with the four bands and the Figma copy from design §8. Newsletter form with validation and the "indisponível" notice; `UnavailableLink` for link columns; social links with `target="_blank"` and pt-BR labels; email/phone links (`kurio.example` if the Figma domain looks real).
  - **Proof:** layout matches `home.md → Footer` at 1440; newsletter never shows success wording. E2E in T16.

- [x] **T13 — Mobile tab bar and top bar** · DS-27, decision 6
  - `MobileTabBar`: CSS-mask notch, FAB with `bg-primary-soft`, items per design §8 (favorites as `UnavailableLink` until spec 05), active dot + `aria-current`, safe-area padding, badge on `Carrinho`.
  - `MobileTopBar`: back button (history-aware) + title, `aria-hidden` title when it duplicates the page `h1`.
  - Compare the notch with the Figma shape (`mobile/Início.png`); if it differs noticeably, switch to the fixed-width exported piece (design §8).
  - **Proof:** at 390 and 414 the notch is circular around the FAB with no stretching; on iOS-like safe area (DevTools device with inset) the bar keeps its padding.

- [x] **T14 — App shell composition** · DS-24, DS-28, DS-30
  - `app/app-shell.tsx` per design §8 composition; render from `__root.tsx` around `<Outlet />` (also for the not-found view). Add `staticData.shell` to all 9 routes per the design table.
  - Shell inputs default to guest session, `cartCount = 0`, no `onSearch`.
  - **Proof:** spec 00's `e2e/smoke.spec.ts` still passes in both projects (update its home assertion if the `KURIO` wordmark makes a locator ambiguous). At 1023 px the mobile shell shows; at 1024 the desktop shell.

- [x] **T15 — Component gallery** · DS-32
  - `routes/dev/ui-kit.tsx` (`noindex`, title "UI kit · KURIO") and `features/ui-kit/` sections listed in design §9, each with a heading.
  - **Proof:** `/dev/ui-kit` renders all sections in `pnpm preview`; it is not linked from any other route (grep `ui-kit` outside `routes/dev` and `features/ui-kit` → nothing).

- [x] **T16 — E2E suite** · DS-09, DS-10, DS-15, DS-17 – DS-19, DS-23 – DS-25, DS-27 – DS-31, DS-33
  - `e2e/design-system.spec.ts` with every row of the design §9 E2E table. Helpers in `e2e/support/` (`expectNoHorizontalOverflow`, `expectNoAxeViolations` with `serious`/`critical` filter and `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` tags) — reused by later specs.
  - Fail the test on any console error (catches missing `DialogTitle`).
  - **Proof:** `pnpm test:e2e` green in `desktop-chromium` and `mobile-chromium`.

- [x] **T17 — Figma visual check** · DS-25, DS-26, DS-27
  - Compare header (both variants), footer and tab bar at 1440 / 414 against the screenshots in `figma_tokens/screenshots/`: overlay in the browser (same viewport, 50 % opacity) and note differences > 2 px or wrong tokens. Fix or record as a deviation in design §11.
  - **Proof:** a short table appended to design §11 ("Visual check 01") listing each element as matched or as a recorded deviation.

- [x] **T18 — Done gate** · DS-07, DS-26 (fidelity), DS-33
  - Run from clean: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
  - **Proof:** all exit 0 with zero warnings. Design §11 deviations list is complete (input for spec 14). Update spec 01 status in [`../README.md`](../README.md) to **Done**.

## Run log (2026-10-28)

- Clean gate (`rm -rf node_modules dist`): `install --frozen-lockfile`, `typecheck`, `lint` (0 warnings), `format:check`, `test` (70 unit tests), `build`, `test:e2e` (64 tests: smoke 14 + design system 18, × 2 projects; 2 skips by design — newsletter is desktop-only, tab-bar clearance is mobile-only) all exit 0.
- **Open warning (resolved by spec 13, PERF-16; the build prints no warning now):** `pnpm build` reports one chunk over 500 kB (`index-*.js`, 661 kB minified). It is the spec 00 runtime (react-dom, zod, axios, router, query) plus sonner, tailwind-merge and Radix/floating-ui from this spec. Decision deferred to spec 13 (bundle performance); until then this is the only warning in the gate.
- Negative proofs: a token change and a stray `#fff` in a `.tsx` fail `contrast.test.ts` / `no-raw-colors.test.ts` (T02); a `lucide-react` import fails `pnpm lint` (T01); `kind: 'sideways'` in `staticData.shell` fails `pnpm typecheck` (T10). All reverted.
- `dist/assets` has one `roboto-mono-latin-wght-normal-*.woff2`; no `--color-red*` / `bg-red-500` in the CSS; `grep -L currentColor` over `icons/` and `social/` prints nothing (T02, T03, T05).
- T14: the smoke "chunk fails to load" test now clicks `Carrinho` inside the home placeholder nav (`Telas`), since the shell adds a second `Carrinho` link. Placeholder routes render a `div`, not `main` (the shell owns `main#conteudo`). The not-found view renders inside the shell (one `banner`, `contentinfo`, `main`).
- T16 surfaced and fixed: `Checkbox` ignored the `Field` ids (axe `button-name`); `TabsList` overflowed at 320 px (now a scroller); `SkipLink` dropped its children under the jsx-a11y rule.
- T17: 50 % overlays at 1440 / 414 against `figma_tokens/screenshots/`; results in design §11 "Visual check 01".

## Coverage

| Req. | Task(s) | Proof |
|---|---|---|
| DS-01 | T02 | tokens in `theme.css`; contrast test parses them |
| DS-02 | T02 | `no-raw-colors.test.ts`; default palette emits no CSS |
| DS-03 | T03 | type steps; mapping table in design §3 |
| DS-04 | T02 | layout variables; `PageContainer` (T10) |
| DS-05 | T02 | shadcn mapping; restyled components inherit it (T06) |
| DS-06 | T02 | derived tokens + deviations §11 |
| DS-07 | T02, T18 | `contrast.test.ts` |
| DS-08 | T06, T16 | gallery states; axe |
| DS-09 | T01, T03, T16 | same-origin font requests; `document.fonts.check` |
| DS-10 | T03, T16 | fallback metrics test |
| DS-11 | T01, T05 | registry; lint blocks lucide |
| DS-12 | T05, T16 | `aria-hidden` svgs; axe (button-name) |
| DS-13 | T05 | `drawn.tsx`; deviations §11 |
| DS-14 | T06, T07, T15 | gallery shows all states |
| DS-15 | T04, T16 | focus outline test across the gallery |
| DS-16 | T06, T16 | hit areas; axe `target-size` |
| DS-17 | T06, T16 | field wiring; newsletter invalid email test |
| DS-18 | T07, T16 | dialog/sheet focus test |
| DS-19 | T08, T16 | `announcer.test.ts`; live region E2E |
| DS-20 | T06 | Button `loading` in gallery |
| DS-21 | T09 | fixed-size skeletons, no layout shift |
| DS-22 | T09, T16 | `aria-busy` + status label; axe |
| DS-23 | T04, T09, T16 | reduced-motion E2E |
| DS-24 | T14, T16 | shell per viewport test |
| DS-25 | T11, T16, T17 | header test; visual check |
| DS-26 | T12, T17 | footer layout; visual check |
| DS-27 | T13, T16, T17 | tab bar test; visual check |
| DS-28 | T11, T14, T16 | badge hidden at 0; `Entrar` redirect link |
| DS-29 | T10, T11, T12, T16 | unavailable link + newsletter tests |
| DS-30 | T10, T14, T16 | skip link test; landmarks via axe |
| DS-31 | T16 | overflow at 320 / 390 / 768 / 1440 |
| DS-32 | T15 | `/dev/ui-kit` |
| DS-33 | T16 | `e2e/design-system.spec.ts` green in both projects |
