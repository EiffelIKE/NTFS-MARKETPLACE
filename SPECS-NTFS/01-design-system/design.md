# 01 — Design system · Design

Implements [`requirements.md`](requirements.md). Figma sources: Home desktop `2:2` and mobile `14:5226`, documented in [`../../figma_tokens/`](../../figma_tokens/README.md). Values are in px unless stated; CSS uses `rem` for type so user font-size settings apply.

## 1. Dependencies

Checked against `minimumReleaseAge` (cutoff 2026-10-20) and peer ranges, as in spec 00.

| Package | Version | Kind | Why |
|---|---|---|---|
| `@fontsource-variable/roboto-mono` | `^5.3.0` | runtime | Self-hosted variable font, OFL-1.1 (DS-09) |
| `radix-ui` | `^1.8.1` | runtime | Primitives behind shadcn components; added by the shadcn CLI |
| `sonner` | `^2.0.8` | runtime | shadcn toast component (DS-19) |
| `vite-plugin-svgr` | `^5.2.0` | dev | Import Figma SVGs as React components (DS-11) |
| `@axe-core/playwright` | `^4.14.0` | dev | Accessibility scans in E2E (DS-33), reused by spec 11 |

The shadcn CLI stays pinned to `shadcn@4.22.1` (spec 00). No form library here: field primitives (§6) are library-agnostic; spec 04 picks the form library.

ESLint (spec 00 config) gains `lucide-react` in `no-restricted-imports`, so a generated component that still imports it fails lint.

## 2. File layout

```
src/
  styles/
    index.css            # entry: tailwind, tw-animate-css, font, theme, base (order matters)
    theme.css            # @theme tokens + shadcn variable mapping (only place with color literals)
    base.css             # @layer base: body, focus ring, reduced motion, skip link, utilities
  assets/
    icons/*.svg          # Figma exports, normalized to currentColor (§5)
  components/
    icons/index.ts       # typed icon registry (Figma exports)
    icons/drawn.tsx      # icons not in Figma, drawn in Iconly Curved style (DS-13)
    ui/*                 # shadcn components, restyled
    feedback/            # toaster, announcer, notify/announce helpers (DS-19)
    layout/              # page-container, skip-link, desktop-header, desktop-footer,
                         # mobile-tab-bar, mobile-top-bar, unavailable-link, shell-config
  app/app-shell.tsx      # composes layout pieces + wires dynamic inputs (DS-28)
  routes/dev/ui-kit.tsx  # component gallery (DS-32)
  features/ui-kit/*      # gallery sections
```

`app/app-shell.tsx` is the only place where later specs plug data into the shell; `components/layout/*` stay presentational (props only).

## 3. Theme (`styles/theme.css`)

### Color tokens (DS-01, DS-02)

Tailwind's palette is reset with `--color-*: initial;`, then only the tokens below exist. `bg-transparent` and `bg-current`/`text-current` keep working (static utilities).

| Token (`--color-…`) | Value | Source |
|---|---|---|
| `ink` | `#140D0A` | Figma |
| `surface-card` | `#241612` | Figma |
| `surface-raised` | `#2F1D15` | Figma |
| `surface-dark` | `#38220F` | Figma |
| `border` | `#3F2319` | Figma |
| `border-soft` | `#55321F` | Figma |
| `primary` | `#D28A4C` | Figma |
| `secondary` | `#B39463` | Figma (placeholder / previous-price text) |
| `foreground` | `#F5F1EB` | Figma |
| `text-primary` | `#F7F3EC` | Figma |
| `text-secondary` | `#CFB28C` | Figma |
| `text-accent` | `#E89B55` | Figma |
| `error` | `#F2836B` | Derived — warm coral, same warmth as `primary` |
| `error-surface` | `#3A1A14` | Derived — alert / invalid field background |
| `success` | `#9BCB89` | Derived — muted sage, reads on brown without neon |
| `success-surface` | `#1E2A17` | Derived |
| `warning` | `#E8C26A` | Derived — ochre, distinct from `primary` by lightness |
| `focus` | `= text-accent` | Derived — reuse of the accent (8.47 : 1 on ink) |
| `disabled` | `#8F7766` | Derived — disabled text/icons (exempt from contrast; ≥ 3.5 : 1 kept anyway) |
| `scrim` | `rgb(10 6 4 / 0.72)` | Derived — dialog/sheet overlay, from `ink` |
| `skeleton` | `= surface-dark` | Derived — skeleton base |
| `skeleton-highlight` | `#4A2E21` | Derived — shimmer peak |

`background-elevated` and `gray-light` stay inside the exported decorative SVGs (DS-01 allowance). Utilities read like `text-text-secondary`; the double word is accepted to keep the Figma names 1:1.

Gradients become utilities: `@utility bg-primary-soft` (`linear-gradient(137deg, rgb(210 138 76 / .45) 24.6%, #D28A4C 100%)`) and `@utility bg-card-gradient` (`linear-gradient(139.5deg, surface-card 12%, surface-raised 106.6%)`).

### shadcn variable mapping (DS-05)

Defined in `@theme inline`, replacing the oklch block written by `shadcn init` in spec 00:

| shadcn | KURIO | Note |
|---|---|---|
| `background` / `foreground` | `ink` / `foreground` | |
| `card`, `popover` / `-foreground` | `surface-card` / `foreground` | |
| `primary` / `primary-foreground` | `primary` / `ink` | Same name as Figma |
| `secondary` / `secondary-foreground` | `secondary` / `ink` | Name collision: Figma `secondary` is a text color. Restyled components never use `bg-secondary`; the `secondary` button variant uses `surface-dark` (§6) |
| `muted` / `muted-foreground` | `surface-dark` / `text-secondary` | |
| `accent` / `accent-foreground` | `surface-raised` / `foreground` | shadcn "accent" = hover background of menu items |
| `destructive` | `error` | |
| `border`, `input` | `border`, `surface-dark` | |
| `ring` | `focus` | |

`--radius` is set to `6px`, but every generated component is reviewed and given an explicit token radius (§6), because our `--radius-*` scale differs from shadcn's.

### Contrast table (DS-07)

Ratios computed with the WCAG formula; asserted by `src/styles/contrast.test.ts` (§9).

| Foreground | on `ink` | on `surface-card` | on `surface-dark` | Use |
|---|---|---|---|---|
| `foreground` | 17.10 | 15.57 | 13.29 | text |
| `text-secondary` | 9.53 | 8.68 | 7.41 | text |
| `secondary` | 6.72 | 6.12 | 5.22 | placeholder, previous price |
| `text-accent` / `focus` | 8.47 | 7.72 | 6.59 | text, focus ring |
| `primary` | 6.85 | 6.24 | 5.33 | text, fills |
| `error` | 7.54 | 6.87 | 5.87 | text, invalid border |
| `success` | 10.35 | 9.43 | 8.05 | text |
| `warning` | 11.32 | 10.31 | 8.80 | text |
| `ink` on `primary` | 6.85 | | | button label |
| `error` on `error-surface` | 6.16 | | | alert text |
| `border` | 1.34 | 1.22 | 1.04 | decorative only (DS-08) |
| `border-soft` | 1.71 | 1.55 | 1.33 | decorative only (DS-08) |

Skeleton colors are decorative and not asserted.

**DS-08 rule:** `border` / `border-soft` never carry state alone. Selected chips, current page, active tab and checked controls change fill, weight or add an underline/check (§6).

### Typography (DS-03)

Tailwind's `--text-*` and `--font-*` are reset. `--font-sans` and `--font-mono` both resolve to `"Roboto Mono Variable", "Roboto Mono Fallback", ui-monospace, monospace`.

| Step (`text-…`) | Size | Line height | Default weight | Figma styles mapped |
|---|---|---|---|---|
| `display` | 43 (2.6875rem) | 70 | 700 | Display/43 Bold |
| `heading` | 24 (1.5rem) | 32 | 700 | Heading/24 Bold; blog section title; details NFT name *(to verify)* |
| `title` | 18 (1.125rem) | 24 | 700 | Body Large/18 Bold (lh 24 and 16), 18 Regular, **17 Bold (collapsed)**, mobile hero title (lh 29 → `leading-7`) |
| `body-lg` | 16 (1rem) | 20 | 400 | Body Large/16 Bold/Medium/Regular (lh auto, 16, 20) |
| `body-md` | 15 (0.9375rem) | 22 | 400 | Body/15 Regular/Medium/Bold (lh 16, 40) |
| `body` | 14 (0.875rem) | 22 | 400 | Body/14 Regular (lh 16, 22, 24, 30), Medium (lh 20), Bold |
| `caption` | 13 (0.8125rem) | 22 | 500 | Caption/13 Medium, 13 Regular lh 22 |
| `caption-sm` | 12 (0.75rem) | 18 | 400 | Caption/12 Regular lh 18, 12 Bold, 12 Medium lh 16 |
| `tiny` | 10 (0.625rem) | normal | 500 | Tiny/10 Medium, **Tiny/9 Bold (collapsed)** |

- Weight is set with `font-medium` / `font-bold`; the step only carries a default.
- Figma line heights that differ from the step (16, 24, 30, 40, 29) are applied with the spacing-based `leading-*` utilities (`leading-4`, `leading-6`, …) where layout depends on them, so no arbitrary line-height values are needed. The mobile hero title's 29 becomes `leading-7` (28) — 1 px deviation.
- `--tracking-brand: 0.1em` for the wordmark and the hero eyebrow.
- Collapsed: 17 → 18 (footer feature titles), 9 → 10 (wallet chip; still fits its 228 column). Recorded as deviations.

### Radius, shadow, layout (DS-04)

- `--radius-*: initial;` then the Figma scale: `xs` 4, `sm` 6, `md` 8, `input-mobile` 10, `hero-mobile` 12, `icon-button` 14, `artwork` 15, `artwork-mobile` 16, `artwork-lg` 18, `card-mobile` 20, `hero` 24, `full`.
- `--shadow-input: 0 0 10px rgb(10 6 4 / 0.45)`; other shadows reset.
- Spacing keeps Tailwind's `--spacing: 0.25rem` (4 px base matches Figma). Named layout values: `--container-page: 1248px` (1200 + 2 × 24, so the 24 gutter is inside), `--spacing-section: 96px`, `--spacing-sidebar: 310px`.
- Breakpoints keep Tailwind defaults; the composition switch is `lg` (1024).

### Page container and gutters (DS-30)

`PageContainer` = `mx-auto w-full max-w-page px-6`. At 1440 the content is 1200 and the outer space is 120, as in Figma; below 1248 the gutter is 24; nothing is fixed-width.

## 4. Font (DS-09, DS-10)

- `index.css` imports `@fontsource-variable/roboto-mono/wght.css`: one `@font-face` per subset with `unicode-range`, so the browser downloads only Latin (Portuguese diacritics are in the Latin subset). Vite emits the WOFF2 under `dist/assets/` with a hash; Vercel caches it with the immutable header from spec 00. Weight axis 100–700 covers 400/500/700.
- `font-display: swap` comes from Fontsource.
- Metric-adjusted fallback in `base.css`:

```css
@font-face {
  font-family: "Roboto Mono Fallback";
  src: local("DejaVu Sans Mono"), local("Menlo"), local("Consolas"), local("Courier New");
  size-adjust: 100%;          /* all candidates advance 0.6em, like Roboto Mono */
  ascent-override: 104.8%;    /* Roboto Mono hhea ascender 2146 / 2048 */
  descent-override: 27.1%;    /* 555 / 2048 */
  line-gap-override: 0%;
}
```

  The overrides are checked in E2E (§9) by measuring a text block's height with the real font vs. the fallback (font loading blocked in Playwright): difference ≤ 1 px per line.
- **Preload** is not added here. Spec 13 measures LCP and decides whether to inject `<link rel="preload">` for the hashed Latin file through a small `transformIndexHtml` plugin.

## 5. Icons (DS-11 – DS-13)

### Pipeline

1. The user exported the SVGs (delivered 2026-10-27) into four folders: `src/assets/icons/` (UI icons), `src/assets/social/` (footer networks), `src/assets/share_icons/` (details share row) and `src/assets/social_login/` (Google and Facebook brand marks for the auth screens).
2. Normalization when committing each file (by hand or a one-off script, not a build step): remove `width`/`height`, keep `viewBox`; replace solid `fill`/`stroke` hex values with `currentColor`; keep `opacity` attributes (Iconly Two-tone). **Exception:** `social_login/*` keep their brand colors (DS-02 allows colors inside exported SVGs; brand marks must not be recolored).
3. `vite-plugin-svgr` with `include: '**/*.svg?react'` and `svgrOptions: { icon: true, svgProps: { 'aria-hidden': 'true', focusable: 'false' } }`. `tsconfig.app.json` adds `vite-plugin-svgr/client` to `types`.
4. `components/icons/index.ts` re-exports each icon with a stable name (`export { default as SearchIcon } from '@/assets/icons/search.svg?react'`). Size via `className` (`size-5`); color via `text-*`. Rotation variants are exported as small wrappers (`ChevronDownIcon = (p) => <ArrowLeftIcon className="-rotate-90" … />`).
5. Accessibility: icons are always `aria-hidden`. Icon-only controls get `aria-label`; icons never carry meaning alone.

### Registry

Files as delivered (Figma color in parentheses, replaced by `currentColor`):

| File | Export name | Size | Used by |
|---|---|---|---|
| `icons/search.svg` | `SearchIcon` | 20 | header search, mobile search field (05), image zoom button (06) |
| `icons/cart.svg` | `CartIcon` | 24 | header cart, card "add to cart" action (05), mobile details cart button (06) |
| `icons/logout.svg` | `LogoutIcon` | 20 | `Entrar` button, profile menu "Sair" (08) |
| `icons/logout-black.svg` | — | 18 × 17 | same glyph as `logout` in ink; not registered (duplicate once normalized) |
| `icons/arrow-left.svg` | `ArrowLeftIcon`, `ChevronRightIcon` (180°), `ChevronDownIcon` (−90°) | 8 × 14 | mobile back button; pagination next; sort trigger and select chevrons |
| `icons/arrow-right.svg` | `ArrowRightIcon` | 16 | hero/promo CTAs (05) |
| `icons/filter.svg` | `FilterIcon` | 22 | mobile filter button (05) |
| `icons/heart.svg` | `HeartIcon` | 16 × 15 | favorite controls (05, 06), tab bar, profile "Lista de interesse" (08) |
| `icons/heart-filled.svg` | `HeartFilledIcon` | 20 × 18 | favorited state (06) |
| `icons/minus.svg`, `icons/plus.svg` | `MinusIcon`, `PlusIcon` | 16 | quantity steppers (06, 07) |
| `icons/home.svg` | `HomeIcon` | 20 | tab bar |
| `icons/shop.svg` | `BagIcon` | 20 | tab bar → cart |
| `icons/user.svg` | `UserIcon` | 20 | tab bar → profile |
| `icons/scan.svg` | `ScanIcon` | 27 × 24 | tab bar center button → search |
| `icons/delete.svg` | `DeleteIcon` | 24 | cart remove (07) |
| `icons/wallet.svg` | `WalletIcon` | 24 | wallet provider rows (09) |
| `icons/empty-image.svg` | `EmptyImageIcon` | 24 | avatar placeholder (08) |
| `icons/thank-you.svg` | `ThankYouIcon` | 80 | order confirmation (10) |
| `icons/user-outlined.svg`, `location.svg`, `shopping-outlined.svg`, `activity.svg`, `download.svg`, `danger-triangle.svg` | `UserOutlinedIcon`, `LocationIcon`, `ShoppingOutlinedIcon`, `ActivityIcon`, `DownloadIcon`, `DangerTriangleIcon` | 18–20 | profile side menu (08): Dados do perfil, Carteiras, Atividade, Ofertas, Arquivos baixados, Suporte |
| `social/facebook.svg`, `instagram.svg`, `twitter.svg`, `linkedin.svg`, `union.svg` (YouTube) | `FacebookIcon`, `InstagramIcon`, `TwitterIcon`, `LinkedinIcon`, `YoutubeIcon` | 16 in a 30 box | footer |
| `social_login/google.svg`, `facebook.svg` | `GoogleMarkIcon`, `FacebookMarkIcon` | 20 | "Continuar com Google/Facebook" (04), brand colors kept |
| `icons/eye-off.svg` | `EyeOffIcon` | 18 | `PasswordInput` toggle while the password is hidden |
| `icons/star.svg`, `icons/star-filled.svg` | `StarIcon` | 15 | rating (06). Same shape in two Figma colors; one component after normalization, color from the caller |
| `icons/menu.svg` | `MoreVerticalIcon` | 3 × 15 | mobile checkout wallet card menu (09) |
| `share_icons/linkedin.svg`, `twitter.svg`, `mail.svg` | `ShareLinkedinIcon`, `ShareTwitterIcon`, `MailIcon` | 15, 16 × 13, 18 | details share row (06). Figma draws them apart from the footer set (cream `#F5F1EB`, different geometry), so they are registered separately, not reused from `social/` |

**Still missing from Figma exports:** none (`mail` delivered in `share_icons/`, 2026-10-27). The tab bar notch and FAB circle are drawn in CSS (design §8), so their shapes are not needed.

### Drawn icons (DS-13)

Not in the Figma payload; drawn in `icons/drawn.tsx` on a 24 grid, 1.5 stroke, round caps/joins (Iconly Curved), `currentColor`: `close` (dialog/sheet/toast close; Figma draws a thin ×, matched), `check`, `alert-circle`, `check-circle`, `spinner`, and `eye`.

`eye` is the visible-password state, which Figma never draws (it only shows the hidden state, `eye-off`). It is derived from `eye-off.svg` itself, so it matches exactly: same 18 viewBox and 1.5 stroke, the slash path removed, and the outline and pupil arcs closed into a full eye (`M2.06 9.1C2.06 6.64 5.17 3.63 9 3.63S15.94 6.64 15.94 9.1 12.83 14.58 9 14.58 2.06 11.56 2.06 9.1Z` plus a circle r 2.37 at 9, 9.1). Each is listed as a deviation. If B1's missing icons do not arrive before their owner spec, that spec draws them here with the same rules and records the deviation.

## 6. Components (DS-14 – DS-20)

### Inventory

Added with `pnpm dlx shadcn@4.22.1 add <name>`, then restyled in place. After each `add`, lucide imports are replaced by registry icons.

| Component | shadcn name | First owner(s) |
|---|---|---|
| Button | `button` | 01 (shell), all |
| Input, Label | `input`, `label` | 01 (newsletter), 04, 05, 08, 09 |
| Input group | `input-group` | 01 (newsletter + attached button; `PasswordInput` with show/hide toggle for 04 and 08), 05 (search), 07 (coupon + "Aplicar") |
| Field | `field` | 01 (newsletter), 04, 08, 09 |
| Checkbox | `checkbox` | 05 (filters), 04 (terms, if drawn) |
| Radio group | `radio-group` | 06 (editions), 09 (wallet, network) |
| Select | `select` | 05 (sort), 09 (network) |
| Slider | `slider` | 05 (price range) |
| Tabs | `tabs` | 05, 06 |
| Dialog | `dialog` | 06, 09 (quote changed, review) |
| Sheet | `sheet` | 05 (mobile filters) |
| Sonner | `sonner` | 01 (feedback), all mutation specs |
| Skeleton | `skeleton` | 05, 06, 07 |
| Separator | `separator` | 01 (header divider, footer) |
| Badge | `badge` | 01 (cart count), 05 (rarity) |
| Tooltip | `tooltip` | 01 (unavailable links) |
| Breadcrumb | `breadcrumb` | 06 |
| Pagination | `pagination` | 05 |
| Avatar | `avatar` | 04 (header user), 08 |
| Dropdown menu | `dropdown-menu` | 04 (user menu) |
| Alert | `alert` | 05–10 (inline errors with retry) |

Components first used by a later spec are still added and styled here, so every screen spec starts from a complete kit and the gallery covers them.

### Styling rules

| Component | Default | States |
|---|---|---|
| **Button** `primary` | `bg-primary text-ink rounded-sm h-10 px-7 text-body-lg font-bold` (hero CTA 140 × 40) | hover: `bg-text-accent`; active: `translate-y-px` (none under reduced motion); disabled: `bg-surface-dark text-disabled` + `cursor-not-allowed` |
| **Button** `secondary` | `bg-surface-dark text-foreground border border-border-soft` | hover: `bg-surface-raised`; text keeps identity, so the low-contrast border is decorative |
| **Button** `outline` | `border border-primary text-text-accent bg-transparent` (Favoritar, *to verify in 06*) | hover: `bg-surface-dark` |
| **Button** `ghost` / `link` | text only, `text-foreground` / `text-text-accent` | hover: underline (link), `bg-surface-dark` (ghost) |
| Button sizes | `sm` h 35 (header `Entrar` 100 × 35, `font-medium`), `default` h 40, `icon` 40 × 40, `icon-lg` 45 × 45 `rounded-icon-button bg-primary-soft` (mobile filter) | |
| Button `loading` prop | spinner replaces the leading icon, label kept (width stable), `aria-busy="true"`, `aria-disabled="true"`, clicks ignored | focus stays on the button |
| **Input** | `bg-surface-dark text-foreground placeholder:text-secondary rounded-sm h-10 px-3 text-body` | invalid: `border border-error` + `alert-circle` icon in the field + error text (DS-17); disabled: `text-disabled` |
| **Checkbox** | 18 box, `border-2 border-text-secondary` (9.5 : 1, so the box is perceivable) | checked: `bg-primary border-primary` + `check` icon in ink |
| **Radio as chips** | pill h 28, `bg-surface-dark border border-border-soft text-text-secondary text-caption` | selected: `bg-primary text-ink font-bold` (fill + weight) |
| **Tabs** | `text-body-lg text-foreground`, list with full-width `border-b border-border` | active: `text-text-accent font-bold` + 2 px `bg-text-accent` underline (shape cue) |
| **Pagination** | 35 × 35 `rounded-xs border border-border text-title font-normal` | current: `bg-primary text-ink font-bold` + `aria-current="page"` |
| **Slider** | track `bg-border-soft` h 2, range `bg-text-accent`, thumb 15 circle `bg-text-accent` | hit area 28 via `::before` (DS-16); focus ring on thumb |
| **Select** | trigger as Figma sort: ghost text + `arrow-down`; content `bg-surface-card border border-border rounded-md` | item hover/highlight `bg-surface-dark`; selected item shows `check` |
| **Dialog** | content `bg-surface-card rounded-md p-6 max-w-[min(560px,calc(100vw-32px))]`; overlay `bg-scrim`; close button with `close` icon, `aria-label="Fechar"` | |
| **Sheet** | `side="bottom"` below `lg`: full width, `max-h-[85dvh]`, `rounded-t-card-mobile`, safe-area padding; `side="right"` otherwise | |
| **Toast** | `bg-surface-card text-foreground border border-border rounded-md`, type icon + text (not color alone) | position: `bottom-center` with offset above the tab bar below `lg`, `bottom-right` from `lg` |
| **Tooltip** | `bg-surface-dark text-foreground text-body rounded-sm px-3 py-2` | |
| **Badge** | count: 16 circle `bg-primary text-ink text-tiny`; rarity: `bg-primary text-ink text-caption font-medium` square (spec 05) | |
| **Alert** | `bg-error-surface text-foreground` + `alert-circle` in `text-error` + optional action button | |
| **Avatar** | `rounded-full bg-surface-dark`, initials fallback `text-body font-bold` | |
| **Breadcrumb** | `text-body text-text-secondary`, separator `/`, current item `text-foreground` + `aria-current="page"` | |

### Focus (DS-15) and targets (DS-16)

Global in `base.css`:

```css
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

The offset puts the ring against the page/surface (≥ 6.59 : 1 on every surface), not against a primary fill (accent vs primary is only 1.24 : 1). shadcn's `focus-visible:ring-*` classes are removed when restyling so there is one focus style. Targets below 24 (slider thumb, 16 cart badge is not interactive) get a larger hit area via `::before`.

### Fields (DS-17)

shadcn `field` (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`) wires `id`, `htmlFor`, `aria-describedby` and `aria-invalid`. `FieldError` renders `alert-circle` + text in `text-error`. A `focusFirstInvalid(form)` helper (`lib/forms.ts`) focuses the first `[aria-invalid="true"]` control after a failed submit; spec 04's form library calls it.

### Dialog and sheet (DS-18)

Radix provides focus trap, `Esc`, outside-click close, `aria-labelledby` and focus return. Every dialog must render a `DialogTitle` (visually hidden if the design has none); the gallery test fails if one is missing (Radix logs an error, the test listens for console errors).

### Feedback channel (DS-19)

`components/feedback/`:

- `<Toaster />` (sonner) mounted once in the root. Sonner renders its list in an `aria-live="polite"` section, so toasts announce themselves.
- `<Announcer />` mounted once: two visually hidden regions, `role="status"` (polite) and `role="alert"` (assertive). It re-announces identical messages by clearing then setting text on the next frame.
- `notify.success | error | info(message, { action? })` → toast only. `announce(message, 'polite' | 'assertive')` → live region only, for changes that need no visible toast (e.g. a realtime price change already shown inline — spec 07).
- Rule for later specs: one channel per event, never both, to avoid double announcements.

## 7. Skeletons (DS-21 – DS-23)

```css
@utility skeleton {
  background: linear-gradient(90deg, var(--color-skeleton) 0%, var(--color-skeleton-highlight) 50%, var(--color-skeleton) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
  @media (prefers-reduced-motion: reduce) { animation: none; background: var(--color-skeleton); }
}
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
```

- shadcn `Skeleton` uses this utility; shape sizes come from the caller (`className` with the final content's width/height or `aspect-*`).
- `<LoadingRegion label="Carregando catálogo">` wraps skeletons: `aria-busy="true"` on the region, skeletons `aria-hidden`, plus a visually hidden `role="status"` label. When loaded, `aria-busy` flips to false and content replaces skeletons at the same size.
- Global reduced-motion rule in `base.css` shortens all transitions/animations to ~0 (`0.01ms`) and disables `tw-animate-css` enter/exit slides; dialogs and sheets then appear instantly.

## 8. App shells (DS-24 – DS-31)

### Composition

`app/app-shell.tsx`, rendered by `__root.tsx` around `<Outlet />`:

```
<SkipLink href="#conteudo">Pular para o conteúdo</SkipLink>
<DesktopHeader … className="hidden lg:block" />
<MobileTopBar … className="lg:hidden" />          // inner screens only
<main id="conteudo" tabIndex={-1} className="pb-[calc(126px+env(safe-area-inset-bottom))] lg:pb-0">
  <Outlet />
</main>
<DesktopFooter className="hidden lg:block" />
<MobileTabBar … className="lg:hidden" />
<Toaster /><Announcer />
```

Both compositions are in the DOM and switched with CSS (`display: none` also removes them from the accessibility tree). This avoids a layout jump that a `matchMedia` switch would cause after first paint.

### Per-route shell config

TanStack Router `staticData`, typed by module augmentation of `StaticDataRouteOption`:

```ts
interface ShellConfig {
  nav: 'home' | 'market'        // desktop active nav item (Figma "Active" variant)
  headerDivider: boolean        // Figma "Header With Divider" vs "Header Row"
  mobile:
    | { kind: 'tab'; tab: 'home' | 'favorites' | 'cart' | 'profile' }   // tab bar visible
    | { kind: 'inner'; title?: string; trailing?: 'favorite' }        // top bar, no tab bar
    | { kind: 'bare' }                                                // neither (auth pages: centered KURIO logo)
}
```

| Route | `nav` | Divider | Mobile |
|---|---|---|---|
| `/` | home | yes | tab `home` |
| `/nfts/$nftId` | market | no | inner, no visible title, trailing favorite button (Figma mobile details) |
| `/cart` | market | no | inner "Carrinho de NFTs" (Figma mobile cart) |
| `/checkout` | market | no | inner "Pagamento com carteira" (Figma mobile checkout) |
| `/orders/$orderId` | market | no | inner "Pedido" |
| `/login`, `/signup` | home | yes | bare (Figma mobile login / sign-up) |
| `/profile` | home | yes | tab `profile` |
| `/wallets` | home | yes | inner "Carteiras" |
| not found | home | yes | tab, none active |
| `/dev/ui-kit` | home | yes | inner "UI kit" |

The shell reads the deepest match's `staticData.shell`, with a default for routes without it. Favorites (`/?favorites=1`) marks tab `favorites` from the search param (spec 05).

`aria-current="page"` is set only on the link whose target is the current location. On login/sign-up/profile/wallets Figma shows `Início` highlighted; the visual highlight follows Figma, `aria-current` does not (a deviation, so assistive tech is not told the user is on home).

### Desktop header (DS-25, DS-28)

Row `justify-between`, height 45, inside `PageContainer`, 24 top padding; optional `Separator` divider below.

- Wordmark `KURIO` (`text-body font-bold tracking-brand`) — `Link to="/"`, `aria-label="KURIO, início"`.
- `nav[aria-label="Principal"]` gap 40: `Início` → `/`; `Mercado` → `/` with `hash="mercado"` (spec 05 gives the catalog section `id="mercado"`); `Criadores`, `Aprenda` → `UnavailableLink`. Active item: `text-text-accent font-bold` + 2 px underline 24 below.
- Actions gap 28: search `Button variant="ghost" size="icon"` `aria-label="Buscar"` — calls `onSearch`; while undefined (until spec 05) it renders as `UnavailableLink`-style button with "Disponível em breve". Cart `Link to="/cart"` with `cart` icon and count badge (hidden at 0), `aria-label` "Carrinho" / "Carrinho, N itens" (pt-BR plural). Session: guest → `Entrar` button (`logout` icon + text) → `/login?redirect=<current href>`; user → avatar + dropdown (spec 04).

Props: `{ nav, divider, cartCount, session, onSearch? }`.

### Desktop footer (DS-26, DS-29)

Four stacked bands per `home.md → Footer` (features + newsletter, brand band, links panel, copyright), all inside `PageContainer`, with Figma colors/sizes. Behavior:

- Feature columns: static text.
- Newsletter: `form` with `Field` + `input-group` (email input + attached `Enviar`). Submit validates the email format (`FieldError` on invalid); on a valid submit, shows an inline `role="status"` notice "Newsletter indisponível nesta demonstração." and sends nothing. No success wording anywhere.
- Email / phone: `mailto:` / `tel:` with the Figma copy; if the copy uses a real-looking domain, replace it with `kurio.example` (deviation).
- Link columns: titles and items from the Figma footer (screenshots in `figma_tokens/screenshots/desktop/`):
  - **Meu perfil:** Meu perfil → `/profile`, Minha coleção, Atividade, Estúdio do criador, Lista de interesse → `/?favorites=1`;
  - **Central de ajuda:** Central de ajuda, Como comprar NFTs, Carteira e segurança, Política do mercado, Denunciar item;
  - **Coleções:** Arte digital, Fotografia, Música, Arte 3D, Utilidade → home catalog filtered by that category (`/?categories=<id>#mercado`, spec 05).

  Every other item is an `UnavailableLink`.
- Feature band copy: W "Segurança da carteira" / "Proteja sua carteira e colecione arte digital verificada com confiança."; C "Criadores em destaque" / "Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede."; D "Alertas de lançamentos" / "Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.". Newsletter title "Antecipe-se ao próximo lançamento", placeholder "digite seu e-mail...", button "Enviar", caption "Receba lançamentos selecionados, histórias de criadores e novidades do mercado.".
- Brand band: "KURIO", tagline "Feito para colecionadores, criadores e cultura", `contato@email.com` → shown as `contato@kurio.example` (deviation: `email.com` is a real domain), `+55 11 4002 8922` (`tel:+551140028922`).
- Social icons ("Redes sociais"): Facebook, Instagram, Twitter, LinkedIn, YouTube, each `<a href="https://<network>.com" target="_blank" rel="noopener noreferrer" aria-label="<Rede> (abre em nova aba)">` in a 30 × 30 box with a 1 px `primary` border.
- "Carteiras compatíveis" title above the wallet chip.
- Wallet chip: static text.

### `UnavailableLink` (DS-29)

Renders an element with `role="link"`, `aria-disabled="true"`, `tabIndex={0}`, no `href`, with the Figma look. Hover/focus shows a `Tooltip` "Disponível em breve" that is also referenced by `aria-describedby`. Activation (click, Enter) does not navigate and shows `notify.info('Disponível em breve')` (on touch screens the tooltip is not reachable, the toast is). The URL never changes.

### Mobile tab bar (DS-27)

- `nav[aria-label="Principal"]` fixed bottom, full width, 95 tall bar + 31 FAB overhang, `pb-[env(safe-area-inset-bottom)]`.
- Background: `bg-surface-card` with the center notch cut by a CSS mask (`radial-gradient` circle around the FAB). The Figma shape `15:5504` is the visual reference; if the curve differs noticeably from a circle, the exported SVG is used as a centered fixed-width piece between two flat segments instead (no horizontal stretching at 390).
- Items: `Início` (`home`) → `/`; `Favoritos` (`heart`) → `/?favorites=1` (spec 05; until then `UnavailableLink`); center `Buscar` (`scan`, 65 circle `bg-primary-soft`) → `onSearch`; `Carrinho` (`bag`, with badge) → `/cart`; `Perfil` (`user`) → `/profile`.
- No visible labels (Figma); each item has an `aria-label`. Active: `text-text-accent` + `aria-current="page"` + a 4 px dot under the icon (non-color cue; deviation).

### Mobile top bar (decision 6)

Inner screens (Figma mobile details, cart, checkout): 56 tall, `PageContainer` gutters, back button (40 circle, `bg-surface-card`, `ArrowLeftIcon`, `aria-label="Voltar"`) + optional title `text-title` bold, + optional trailing slot (the details favorite button, same 40 circle, filled by spec 06). Inner screens hide the tab bar; their own fixed bottom areas (details buy bar, cart summary, checkout confirm) come from the owner specs and get the same safe-area padding. Back uses `router.history.back()` when there is in-app history, otherwise navigates to `/`. The title is visual; the page keeps its own `h1` (the bar title is `aria-hidden` when it duplicates the `h1`).

### Skip link and landmarks (DS-30)

Skip link visually hidden until focused, then shown top-left over the header (`bg-primary text-ink`). `main#conteudo` has `tabIndex={-1}` so it receives focus. Landmarks: `header`, `nav` (×1 visible per composition), `main`, `footer`.

### Overflow and zoom (DS-31)

No fixed widths above 320 in shell pieces; long tokens (wallet chip, email) wrap or truncate with `title`. Horizontal scrolling is allowed only inside explicit scrollers (mobile tabs row, spec 05), which are keyboard-reachable.

## 9. Gallery and tests (DS-32, DS-33)

### Gallery `/dev/ui-kit` (decision 4)

`routes/dev/ui-kit.tsx` with `head()` → title "UI kit · KURIO" and `meta name="robots" content="noindex"`. Not linked from the app. Sections (`features/ui-kit/`): colors (swatches with ratios), type scale, buttons (every variant × size × state incl. loading), inputs and fields (valid, invalid with message, disabled), checkbox, chip radio, select, slider, tabs, pagination, badges, alert, tooltip, avatar, breadcrumb, skeletons inside a `LoadingRegion`, a dialog trigger, a sheet trigger, a toast trigger, an announce trigger, and an `UnavailableLink`. Each section has a heading for axe `region` checks.

### Unit (Vitest)

| File | Proves |
|---|---|
| `src/styles/contrast.test.ts` | Parses `--color-*` hex values from `theme.css` and asserts the §3 contrast table (DS-07) |
| `src/styles/no-raw-colors.test.ts` | Scans `src/**/*.{ts,tsx,css}` except `theme.css` for hex, `rgb(`, `hsl(`, `oklch(` literals and arbitrary color classes (`-[#`) — fails on any (DS-02) |
| `src/components/feedback/announcer.test.ts` | `announce` re-announces identical messages (pure scheduling logic, node env) |

### E2E (`e2e/design-system.spec.ts`, both projects)

| Test | Proves |
|---|---|
| Shell per viewport: desktop shows header nav + footer, tab bar hidden; mobile the reverse | DS-24 |
| Header: active item has `aria-current` on `/`; cart badge hidden at 0; `Entrar` links to `/login?redirect=%2F` | DS-25, DS-28 |
| `Criadores` click/Enter: URL unchanged, "Disponível em breve" visible | DS-29 |
| Newsletter: invalid email → field error; valid → "indisponível" notice, no success text | DS-17, DS-29 |
| First `Tab` focuses the skip link; `Enter` moves focus to `main` | DS-30 |
| Tab through the gallery: every focused element has a non-`none` outline ≥ 2 px | DS-15 |
| Dialog and sheet: focus inside on open, `Tab` cycles, `Esc` closes, focus returns to trigger | DS-18 |
| Fonts: after `document.fonts.ready`, `document.fonts.check('16px "Roboto Mono Variable"')`; no request leaves the app origin | DS-09 |
| Fallback metrics: with font requests aborted, a gallery paragraph's height differs ≤ 1 px/line from the loaded font | DS-10 |
| Reduced motion (`emulateMedia`): skeleton `animation-name` is `none` | DS-23 |
| Overflow at 320, 390, 768, 1440 on `/` and the gallery: `scrollWidth ≤ clientWidth` | DS-31 |
| Mobile: the last element in `main` ends above the tab bar after scrolling to the bottom | DS-27 |
| Toast and `announce`: message appears in the live region | DS-19 |
| axe (`@axe-core/playwright`, WCAG 2.2 A/AA tags) on `/` and `/dev/ui-kit`: no serious/critical violations | DS-33 |

Visual baselines of the shells are spec 12.

## 10. Figma references

| Element | Node |
|---|---|
| Header With Divider / Header Row | `70504:3017` / `70488:626` |
| Footer | `70491:1286` (instance `70492:696`) |
| Mobile tab bar | `70395:245` (shape `15:5504`, FAB `15:5507`) |
| Primary buttons, inputs, chips, tabs, pagination | Home desktop `2:2`, sections in `home.md` |
| Mobile search, filter button | `70395:239`, `70410:4122` |

## 11. Deviations for `ARCHITECTURE.md`

1. Derived colors (error, success, warning, focus, disabled, scrim, skeleton) — not in Figma.
2. Type scale collapse: 17 → 18, 9 → 10; mobile hero title line height 29 → 28.
3. Drawn icons: close, check, alert-circle, check-circle, spinner, and `eye` (derived from the Figma `eye-off`, since Figma has no visible-password state).
4. `border` / `border-soft` never carry state alone; selected/current states add fill or weight.
5. Visible focus ring (accent, 2 px, offset 2) — not drawn in Figma.
6. Tab bar: active dot under the icon; center button opens search (function undefined in Figma); favorites tab → catalog favorites filter.
7. Mobile top bar on inner screens (no Figma frame).
8. `aria-current` follows the real location, while the Figma "Active = Home" highlight is kept on account/auth screens.
9. Out-of-scope links: visible, `aria-disabled`, "Disponível em breve"; newsletter shows an "unavailable" notice.
10. Tab bar notch drawn with a CSS mask instead of the exported shape (if visually equivalent).
11. Gallery route `/dev/ui-kit` present in production builds (unlinked, `noindex`).
12. shadcn 4.22.1 has no `new-york` preset: initialised with `radix-vega` (`radix-ui` package), then every component restyled to these tokens; `cn` from `@/lib/utils`, with `tailwind-merge` extended for the custom `text-*`, `radius`, `shadow`, `tracking` and `container` scales.
13. Field wiring is a small context (`Field` → `useFieldControl`) instead of shadcn's markup-only `field`: `Input`, `Textarea`, `SelectTrigger` and `Checkbox` read `id`, `aria-describedby` and `aria-invalid` from it.
14. `UnavailableLink` is `Unavailable` with `as: 'link' | 'button'`, because the unavailable search button and tab-bar FAB need the button role.
15. Item 6 amended: until spec 05, the favorites tab and the footer "Lista de interesse" are `Unavailable`; spec 05 points them at the favorites filter.
16. Tab bar: top radius 32 px is an arbitrary value (no token); icon slots are symmetric around the FAB (centers 46 / 118 / 296 / 368) while Figma is slightly asymmetric (46 / 117 / 302 / 364).
17. Mobile top bar title is centered in a `40px 1fr 40px` grid at the `title` step (18 px); the cart frame draws it at about 20 px, slightly right of center.
18. Rotated registry icons: `ChevronRight/Down/Up` from `arrow-left`, `MoreHorizontal` from `menu`.
19. Sonner offsets: desktop bottom-right 24 px; mobile bottom-center at `134px + safe area`, above the tab bar.
20. `Textarea` added here (spec 09 amendment pulled forward, same field surface).
21. Tabs: the list is a horizontal scroller (DS-31) with an inset-shadow baseline instead of `border-b`; triggers have `px-1` with gap 24 (still 32 between labels) and an inset focus outline so the scroller never clips it.
22. Input groups show the focus outline on the group (around input and addons), not on the inner input; the DS-15 E2E checks the group for those controls.
23. Chrome renders the Figma text about 4 % wider than the Figma export at the same size (16 px "Mercado": 67 vs 64 px). To keep Figma line breaks the footer feature copy is 214 px wide (Figma 204) and the feature titles stay on one line from `xl` up.

### Visual check 01 (T17, 2026-10-28)

50 % overlays of the app (`vite preview`) on `figma_tokens/screenshots/` at the same viewport. Differences > 2 px or wrong tokens are fixed or listed here.

| Element | Reference | Result |
|---|---|---|
| Header with divider (`/`) | `desktop/Início.png` 1440 | Matched: wordmark, icons, `Entrar` and divider within 1 px. Nav labels start 9 px further left because of the wider text (deviation 23); the group stays centered. Cart badge hidden at 0 by design (DS-28). |
| Header without divider (`/nfts/1`) | `desktop/Detalhes do NFT.png` 1440 | Matched, same nav note; `Mercado` active. |
| Footer, brand band and links panel | `desktop/Início.png` 1440 | Matched within 2 px. Email is `contato@kurio.example` (Figma placeholder domain replaced). |
| Footer, features band | `desktop/Início.png` 1440 | Deviation: 274 px tall vs 250. Titles are 18 px (deviation 2) and the longest copy needs 4 lines at 22 px; Figma's fixed height clips the same content. Medallions, rules and newsletter match. |
| Mobile tab bar | `mobile/Início.png` 414 | Matched: notch, FAB and bar height. Icon positions within 1 px on the left pair, 4–6 px on the right pair (deviation 16). |
| Mobile top bar (`/cart`) | `mobile/Carrinho de NFTs.png` 414 | Fixed during the check: back button 35 px (was 40, hit area kept with `::after`) and row moved 6 px down; now within 2 px. Title baseline matches; the title is 18 px (Figma about 20, not a type step, see deviation 2) and centered (deviation 17), so it starts 5 px left of Figma's. The progress rule under it belongs to spec 07. |

## 12. Amendments requested by later specs

| From | Change |
|---|---|
| 06 | `components/quantity-stepper.tsx` (reused by spec 07) |
| 04 | `DesktopHeader` `userMenu` slot; `ShellSession` user variant; guest "Entrar" carries the `redirect` on auth pages — **applied in spec 04** (design §14) |
| 09 | shadcn `textarea` for "Observação do colecionador" (spec 09 T01) |
