# 01 — Design system · Requirements

Turn the Figma foundations in [`../../figma_tokens/`](../../figma_tokens/README.md) into code that every screen spec reuses: Tailwind theme tokens, the Roboto Mono font, derived semantic colors, restyled shadcn/ui components, skeletons, icons and the desktop/mobile app shells. No product data or feature behavior here — shells render guest/empty state and expose hook points for specs 04–07.

Brief coverage: §3 (out-of-scope actions must not fake success — shell links), §8 (Figma fidelity, responsiveness, skeletons with shimmer, reduced motion, keyboard/focus/contrast/zoom baseline).

Figma input: Home desktop `2:2` and mobile `14:5226` (header, footer, tab bar, buttons, inputs, chips, tabs, pagination), plus the full-page screenshots of every frame in `figma_tokens/screenshots/` (mobile inner-screen top bar, auth layout). Screen-specific components are covered when their owner spec reaches `design.md`.

## User stories

- **US-1** — As a developer of screen specs, I style UI only with named tokens and shared components, so screens stay consistent with Figma without copying hex values or one-off styles.
- **US-2** — As a visitor, I see the KURIO identity (dark brown palette, monospaced Roboto Mono) on every screen, including when running locally without internet.
- **US-3** — As a keyboard or screen-reader user, every shared control has a visible focus indicator, an accessible name, and states that do not rely on color alone.
- **US-4** — As a visitor on desktop I navigate with the header and footer; on mobile and tablet I navigate with the bottom tab bar.
- **US-5** — As a visitor who prefers reduced motion, loading placeholders and transitions stay still.

## Acceptance criteria

### Tokens and theme

- **DS-01** — THE SYSTEM SHALL expose the colors, gradients, radii, shadow and font family from `figma_tokens/tokens.json` as Tailwind v4 `@theme` variables with the same kebab-case names (`--color-primary`, `--radius-sm`, …), defined in one stylesheet. Decorative-only colors (`background-elevated`, `gray-light`) MAY stay inside exported SVGs instead.
- **DS-02** — THE SYSTEM SHALL disable Tailwind's default color palette, so only project tokens produce color utilities, and SHALL contain no raw color literals in `src/` outside the theme stylesheet and exported SVGs.
- **DS-03** — THE SYSTEM SHALL provide a semantic type scale (display, heading, title, body, caption, tiny — final names in `design.md`) that collapses the near-duplicate Figma text styles; each step SHALL set size, line height, weight and letter spacing, and `design.md` SHALL map every Figma style to one step.
- **DS-04** — THE SYSTEM SHALL keep Tailwind's 4 px spacing base (it matches Figma) and expose the layout constants (container 1200, desktop gutter 120, mobile gutter 24, section gap 96, sidebar 310) as theme variables.
- **DS-05** — THE SYSTEM SHALL map shadcn/ui's CSS variables (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, and their `-foreground` pairs) to KURIO tokens, so generated components inherit the identity. There is a single dark theme; THE SYSTEM SHALL set `color-scheme: dark`.

### Derived semantic colors

- **DS-06** — THE SYSTEM SHALL define the colors Figma lacks — error/destructive, success, warning, focus ring, disabled, overlay scrim, skeleton base and skeleton highlight — derived from the palette's warm hue family, and SHALL record each one as a deviation with its rationale.
- **DS-07** — THE SYSTEM SHALL meet WCAG 2.2 AA contrast for every token pair used for text (≥ 4.5 : 1, or ≥ 3 : 1 for text ≥ 24 px or ≥ 18.66 px bold) and for focus indicators and state-bearing non-text UI (≥ 3 : 1) against `ink`, `surface-card` and `surface-dark`; `design.md` SHALL list the computed ratios and an automated test SHALL check them.
- **DS-08** — WHEN a Figma border (`border`, `border-soft`, ratio 1.0–1.7 : 1) is the only cue that identifies a control or its selected state, THE SYSTEM SHALL add a second cue (fill, weight, accent color, icon or text) so the state remains perceivable.

### Typography

- **DS-09** — THE SYSTEM SHALL self-host Roboto Mono (weights 400, 500, 700, Latin subset including Portuguese diacritics) as WOFF2 bundled with the app, with `font-display: swap`, and SHALL make no request to a third-party font host.
- **DS-10** — WHEN the font is still loading, THE SYSTEM SHALL use a metric-adjusted monospace fallback, so the swap does not shift layout (CLS contribution from the font ≈ 0).

### Icons and assets

- **DS-11** — THE SYSTEM SHALL render icons from SVGs exported from the Figma file, as typed React components that inherit `currentColor` and accept a size; no icon package SHALL be installed.
- **DS-12** — THE SYSTEM SHALL mark decorative icons `aria-hidden`, and every icon-only control SHALL have an accessible name in pt-BR.
- **DS-13** — WHEN a shadcn/ui component needs an icon that Figma does not provide (close, check, chevron, alert), THE SYSTEM SHALL use an inline SVG drawn to match the Iconly Curved style (stroke width, caps, 24 grid), and SHALL list it as a deviation.

### Components

- **DS-14** — THE SYSTEM SHALL add, through the shadcn CLI, and restyle the components the screen specs need (inventory with owner specs in `design.md`). Each SHALL implement default, hover, focus-visible, active/pressed, disabled and — where applicable — selected, invalid and loading states.
- **DS-15** — THE SYSTEM SHALL show a visible focus indicator on every interactive element when it receives keyboard focus (`:focus-visible`), at least 2 px thick with ≥ 3 : 1 contrast, and SHALL never remove an outline without a replacement.
- **DS-16** — THE SYSTEM SHALL give interactive targets at least 24 × 24 CSS px (WCAG 2.5.8), including icon buttons, pagination items, stepper buttons and the favorite chip.
- **DS-17** — THE SYSTEM SHALL provide form-field primitives that link label, description and error message to the control (`aria-describedby`, `aria-invalid`), show errors with text plus a non-color cue, and move focus to the first invalid field on submit.
- **DS-18** — WHEN a dialog or sheet opens, THE SYSTEM SHALL move focus into it, trap focus while open, close on `Esc` and on the scrim, label it by its title, and return focus to the trigger on close.
- **DS-19** — THE SYSTEM SHALL provide one feedback channel for mutations and realtime changes: toasts for visible feedback, and a polite and an assertive live region for announcements, reachable through one helper, so specs 06–10 do not create their own.
- **DS-20** — WHILE a button's action is pending, THE SYSTEM SHALL show a loading state that keeps the button's size, exposes `aria-busy`, and blocks repeated activation.

### Skeletons

- **DS-21** — THE SYSTEM SHALL provide a skeleton primitive with a shimmer animation in the derived skeleton colors; callers SHALL size it to the final content, so content replacement causes no layout shift.
- **DS-22** — WHILE a region is loading, THE SYSTEM SHALL hide skeleton shapes from assistive technology and expose one loading status for the region (`aria-busy` plus a visually hidden pt-BR label).
- **DS-23** — WHEN the user prefers reduced motion, THE SYSTEM SHALL stop the shimmer (static skeleton color) and reduce non-essential transitions (sheet and dialog slides, hover transforms) to an instant change or a short fade.

### App shells and layout

- **DS-24** — THE SYSTEM SHALL use the desktop composition (header + footer) at viewport widths ≥ 1024 px and the mobile composition (bottom tab bar, no header/footer) below it; the tablet width (768) uses the mobile composition. *(See decision 1.)*
- **DS-25** — THE SYSTEM SHALL render the desktop header per Figma: KURIO wordmark linking home; nav `Início`, `Mercado`, `Criadores`, `Aprenda` with the active item marked visually and with `aria-current="page"`; search button; cart link with item-count badge; and the `Entrar` button. It SHALL support the two Figma variants (with and without divider) chosen per route.
- **DS-26** — THE SYSTEM SHALL render the desktop footer per Figma (features band, newsletter, brand band, link columns, social icons, wallet chip, copyright).
- **DS-27** — THE SYSTEM SHALL render the mobile tab bar fixed to the bottom, with the notched background and center action button, `env(safe-area-inset-bottom)` padding, items with accessible names and `aria-current="page"`, and bottom padding on the page so the bar never covers content. *(Item mapping: decision 2.)*
- **DS-28** — THE SYSTEM SHALL expose the shell's dynamic parts — cart count, session state (guest vs. signed-in user), search action — as inputs that render guest/empty state until specs 04, 05 and 07 connect them. The cart badge SHALL be hidden at 0 and its link SHALL announce the count (e.g. "Carrinho, 3 itens").
- **DS-29** — WHEN a shell or footer control leads to content outside the deliverable (Criadores, Aprenda, editorial and support links, newsletter), THE SYSTEM SHALL keep it visible for fidelity and make clear that it is unavailable, without simulating success. *(Behavior: decision 3.)*
- **DS-30** — THE SYSTEM SHALL provide a page container (max width 1200, fluid gutters from 24 to 120), a skip link as the first focusable element ("Pular para o conteúdo") targeting the `main` landmark, and landmarks (`header`, `nav`, `main`, `footer`).
- **DS-31** — THE SYSTEM SHALL show no unintended horizontal overflow at 390, 768 and 1440 px, nor at 320 CSS px (1280 px at 400 % zoom); text SHALL remain readable when text spacing is increased (WCAG 1.4.12).

### Verification

- **DS-32** — THE SYSTEM SHALL include a component gallery route that renders every shared component in all its states, used by the E2E suite for accessibility and state checks. *(Route and exposure: decision 4.)*
- **DS-33** — THE SYSTEM SHALL include E2E tests in both projects proving: the correct shell per viewport; the skip link; keyboard focus visible on every gallery control; dialog/sheet focus trap and return; the font loads from the app's origin; shimmer stops under reduced motion; no horizontal overflow at the widths in DS-31; and zero serious or critical axe violations on the gallery and the home placeholder.

## Out of scope

- Hero, catalog, filters, product cards, promos and blog content — spec 05 (uses these tokens and components).
- Real cart count, session state and search behavior — specs 07, 04 and 05 connect the shell inputs from DS-28.
- Screen-specific components from frames not yet extracted (cart, checkout, auth, profile, wallets, mobile details) — owner specs, using these primitives.
- Visual regression baselines — spec 12. Full accessibility audit across screens — spec 11.
- Raster artworks (NFT images) — spec 02 fixtures and spec 05.

## Prerequisites

- **Figma exports by the user** — delivered 2026-10-27 to `src/assets/{icons,social,share_icons,social_login}/` (registry in `design.md` §5). Nothing missing. Figma has no visible-password (`eye`) icon; it is derived from `eye-off` (design §5).

## Decisions (approved 2026-10-27)

1. **Breakpoints (DS-24)** — mobile composition below `lg` (1024), desktop from `lg`. Tablet (768) uses the mobile shell with a wider grid (3 columns, set in spec 05). Between 1024 and 1279 the desktop layout keeps the 1200 structure fluidly (narrower gutters and grid). Alternative: switch at `md` (768), but the desktop header and sidebar do not fit at 768 without a frame to follow.
2. **Mobile tab bar mapping (DS-27)** — recommended: `Início` → `/`; heart → `/?favorites=1` (favorites filter, auth required, spec 05/06); bag icon → `/cart` (with badge); user → `/profile` (redirects to login when signed out); center action button (scan glyph) → opens search (focuses the search field on home, spec 05). The README proposed FAB → Cart, but the bag icon already reads as cart; two cart entries would be redundant.
3. **Out-of-scope controls (DS-29)** — recommended: `Criadores`, `Aprenda`, editorial/support footer links and blog "Ler mais" render as `aria-disabled` links with a tooltip/description "Disponível em breve" and no navigation; the newsletter form keeps its field but submitting shows an inline notice "Newsletter indisponível nesta demonstração" (no success message); social icons and the email/phone are real `href`s to fictitious-but-coherent targets (`mailto:`, `tel:`, public network home pages in a new tab). `Mercado` links to the catalog section of home and is active on the market-flow screens (details, cart, checkout).
4. **Component gallery (DS-32)** — recommended: route `/dev/ui-kit`, present in every build (E2E runs against `vite preview`), not linked from the app, `noindex`. Alternative: only when the mock flag from spec 02 is on.
5. **Font source (DS-09)** — recommended: `@fontsource-variable/roboto-mono` (OFL, one variable WOFF2 per subset, bundled by Vite). Alternative: static WOFF2 files for the three weights committed to the repo.
6. **Mobile inner screens** — screens other than the tab destinations (details, cart, checkout, order confirmation, wallets) show a compact top bar with a back button and an optional title, and no tab bar, as the mobile details, cart and checkout frames show (screenshots delivered 2026-10-27; this updates the approved decision, which assumed no inner frames existed). Login and sign-up use a bare layout with the centered KURIO logo, as in their mobile frames. Order confirmation and wallets have no mobile frame and follow the inner pattern (deviation).
