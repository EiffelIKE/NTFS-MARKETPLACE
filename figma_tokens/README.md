# Figma design tokens

Extracted via the Figma MCP from **`di66cL89caut7ECDhUns79`** (editable copy of the challenge file `Ff0SksUi7UFtPWUO8kyNtw`; node IDs are identical in both). Check here before re-querying Figma.

| File | Contents |
|---|---|
| [`tokens.json`](tokens.json) | Machine-readable tokens (DTCG-style): color, typography, radius, shadow, border, spacing, layout. Source for the Tailwind `@theme`. |
| [`desktop/`](desktop/) | Per-screen layout notes at 1440. |
| [`mobile/`](mobile/) | Per-screen layout notes at mobile width. |
| [`assets.md`](assets.md) | Asset export list and delivery status (files live in `src/assets/`). |
| [`screens.md`](screens.md) | Notes for every frame read from the screenshots (login, sign-up, cart, checkout, confirmation, profile, wallets, mobile details). |
| [`screenshots/`](screenshots/) | Full-page PNG exports of every frame, desktop (1440) and mobile (414). Reference for visual checks and specs 04–12. Git-ignored (local only, too heavy for the repo). |

Extracted so far: `desktop/home.md` (`2:2`), `mobile/home.md` (`14:5226`), `desktop/nft-details.md` (`10:244`, geometry only — MCP quota hit). The document has a single page (`0:1` "Marketplace de NFTs GreenMint") containing all frames.

**MCP quota:** the Starter plan limit was reached on 2026-10-27 while extracting `10:244`. The remaining screens are documented from the user's screenshots in [`screens.md`](screens.md) (values read from pixels, approximate).

## Foundations

**Theme**: single dark theme. Brand "KURIO". UI copy in Figma is **pt-BR**.

### Color

Figma defines each color twice (variable `color/*` and style `Color/*`) with identical values; `tokens.json` keeps one name.

| Token | Hex | Usage |
|---|---|---|
| `ink` | `#140D0A` | Page background; text on primary fills |
| `surface-card` | `#241612` | Cards, filter sidebar, footer panels |
| `surface-raised` | `#2F1D15` | Gradient end of mobile cards |
| `surface-dark` | `#38220F` | Inputs, footer brand band, chips |
| `border` | `#3F2319` | Default 1px borders |
| `border-soft` | `#55321F` | Chip borders |
| `primary` | `#D28A4C` | Buttons, active pagination, badges, accent rules |
| `secondary` | `#B39463` | Placeholders, previous price |
| `foreground` | `#F5F1EB` | Default text |
| `text-primary` | `#F7F3EC` | Emphasized text (≈ foreground) |
| `text-secondary` | `#CFB28C` | Body copy, inactive items, meta |
| `text-accent` | `#E89B55` | Active nav/tab/filter, prices, links |
| `background-elevated` | `#FBFBFB` | Decorative only (promo mask) |
| `gray-light` | `#EDEDED` | Decorative only (mobile hero mask) |

Gradients (mobile only): `primary-soft` (filter button, FAB) and `card` (product card media).

Not defined in Figma (will be derived in spec 01 and documented as deviations): destructive/error, success, warning, focus ring, disabled, overlay/scrim, skeleton base/shimmer.

### Typography

- Family: **Roboto Mono** (400, 500, 700) — the whole UI is monospaced. Self-host the font files (local execution requirement).
- Figma `lineHeight: 100` = 100 % (`normal`); `letterSpacing: 10` = 10 % = `0.1em`.
- Size ramp used: 9, 10, 12, 13, 14, 15, 16, 17, 18, 24, 43. Full style list in `tokens.json → typography`. Spec 01 should collapse near-duplicates (e.g. 15/17 vs 14/16/18) into a smaller semantic scale.

### Radius

Desktop: `4` pagination · `6` buttons/inputs/chips · `8` promo & blog cards · `15` grid artwork · `18` promo artwork · `24` hero artwork · `full` medallions.
Mobile: `10` search input · `12` hero banner · `14` icon button · `16` artwork · `20` card media.

### Elevation

Only one shadow: newsletter input `0 0 10px rgba(10,6,4,.45)`. Depth is expressed by surface color steps (`ink` → `surface-card` → `surface-dark`).

### Layout (desktop 1440)

Container 1200, gutters 120, section gap 96, sidebar 310 + gap 48 + grid 842 (3 × 258, gaps 34 / 72).

### Layout (mobile 414)

Gutters 24, stack gap 16, 2-column masonry (gap 16 / 24, right column +32), fixed bottom tab bar with center FAB. Mobile is a distinct composition (no header/footer/sidebar) — see `mobile/home.md`.

### Breakpoint strategy (proposal)

Only 1440 and 414 are drawn. Tablet (768) has no frame: use the mobile composition with a 3-column grid and the filter sheet up to `lg` (1024), switch to the desktop composition from `lg`.

## Conventions

- Names in `tokens.json` are kebab-case and map 1:1 to CSS variables (`--color-primary`, `--radius-sm`, …).
- Figma layer names are mostly auto-generated (`Frame 141`); always reference **node IDs**.
- Iconography is **Iconly** (Curved / Two-tone). Per `AGENTS.md`, no icon packages — export SVGs from Figma.
