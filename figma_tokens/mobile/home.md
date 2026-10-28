# Home — Mobile (414)

Figma node `14:5226` "Mobile / Início" — 414 × 896 (single viewport; no scroll content beyond the first 4 cards). Values in px. Must also be validated at 390 (brief requirement) → use fluid widths, not 414-fixed.

Mobile is a **different composition** from desktop, not a reflow: no header/nav/footer, search bar on top, compact hero card, masonry grid, bottom tab bar. Sidebar filters, pagination, promos and blog are absent.

## Page shell

- Background `color.ink`. Side padding **24** (content 366). Top 40 (status bar area).
- Vertical stack: Search (45) → 16 → Hero (190) → 16 → Tabs (20) → 16 → Grid → Tab bar fixed at bottom.

## Search bar (`70395:239`) — 366 × 45

- Input pill (`70410:4124`): 313 × 45, `surface-card`, radius **10**, pl 12. Search icon 22 + placeholder "Explorar coleções" (`body-14-bold-16`, `secondary`), gap 8.
- Filter button (`70410:4122`): 45 × 45, radius **14**, gap 8 from input, `gradient.primary-soft` (137°, primary 45 % → 100 %). Icon Iconly Curved/Filter 22, ink.
- Filter button opens the filter panel (sheet/drawer) — not drawn in Figma; reuse desktop Filters content.

## Hero banner (`70395:240`) — 366 × 190

- Radius **12**, padding 16, overflow hidden. Background = decorative mask group `14:5290` (brown gradient + two 248 circles) → export as SVG.
- Row gap 8: copy column (flex 1) + artwork stack (138).
  - Eyebrow "Bem-vindo à Kurio": 12 medium lh 16, foreground.
  - Title "SEJA DONO DA / CULTURA DIGITAL": 18 bold lh **29**, foreground, 190 wide. Gap 6.
  - Paragraph: `caption-12-regular-18`, `text-secondary`.
  - CTA link "EXPLORAR" + Iconly Curved/Arrow-Right 16: `caption-12-bold` `text-accent`, gap 8 (text link, not a button).
  - Artwork stack: main 138², radius 16; overlapping thumb 58², radius 16, offset (14, 88).
- Carousel dots 33 × 7 (three 7px dots, gap 6) centered, 16 below the row → implement in code.

## Tabs (`70395:241`)

- "Todos os NFTs" active (accent + underline 110 wide at +20), "Novos lançamentos", "Em alta". 16px, gap 4 / 16 (tight: horizontally scrollable at 390).
- No sort control on mobile → put sort inside the filter sheet.

## Product grid (`70395:242`) — masonry, 2 columns

- Columns 175 wide, gap **16**. Right column offset **+32** (staggered). Row gap **24**.
- **Card** (175 × 244), column gap 8:
  - Media box 175 × 200, radius **20**, `gradient.card` (139.5°, `surface-card` 12 % → `surface-raised` 106.6 %), padding pt 20 / pb 12 / px 4 (normalize to centered artwork).
  - Artwork 168², radius **16**.
  - Text block pl 8: name 15 regular (`body-15-regular`) foreground; price `body-lg-16-bold-16` `text-accent`.
- **Favorite button** (`15:5465`, asset `Group 58`): 28² circle, top-right (12 from top, 11 from right), heart outline. Toggled state not drawn → filled heart in `primary`.
- **Rarity badge "RARO"** (`15:5496`): 68 × 32, `primary`, square (no radius), flush left at top 16; label 13 medium lh 16, ink, pl 8.

## Tab bar (`70395:245`) — 414 × 126, fixed bottom

- Shape `15:5504`: `surface-card` bar (~95 tall) with a center notch for the FAB → export SVG (or draw with CSS mask).
- Center FAB `15:5507`: 65² circle, primary gradient, icon `15:5529` (scan / frame glyph) — function undefined in Figma. Proposal: link to **Cart** or **Search**; document decision.
- Items (20² icons, y 71): Home (Iconly Bold/Home, active = accent) · Favorites (heart, `15:5527`) · [FAB] · Shop/Cart (`15:5524`) · Profile/User (`15:5522`). No labels in Figma → add `aria-label`s (and optionally visible labels; record as a11y deviation).
- Respect `env(safe-area-inset-bottom)`; add bottom padding to page content so the bar does not cover the last row.
