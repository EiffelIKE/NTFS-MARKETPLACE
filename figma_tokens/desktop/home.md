# Home — Desktop (1440)

Figma node `2:2` "Desktop / Início" — 1440 × 3668. Values in px.

## Page shell

- Background `color.ink`. Content column 1200 wide, centered (120 gutters).
- Top padding 24; bottom padding 24 below footer.
- Vertical rhythm between top-level sections: **96**.

| Section | Node | y | Size |
|---|---|---|---|
| Top (header + hero) | `70353:242` | 24 | 1200 × 527 |
| Products (sidebar + grid) | `70342:2831` | 647 | 1200 × 1373 |
| Promos | `70353:241` | 2116 | 1200 × 250 |
| Blog | `70343:253` | 2462 | 1200 × 476 |
| Footer | `70492:696` | 3034 | 1200 × 610 |

## Header — component "Header With Divider" (`70504:3017`)

- Row: `justify-between`, height ~45. Hairline divider underneath (only on home, profile, wallets, auth screens; market screens use bare Header Row).
- **Logo**: "KURIO", `body-14-bold-tracked`, foreground, box 160 × 34.3.
- **Nav**: gap 40. Items `Início` / `Mercado` / `Criadores` / `Aprenda`, 16px regular foreground. Active item: 16px bold `text-accent` + underline (2–3px accent rule, 24 below text, item width).
- **Actions**: gap 28, centered. Search icon 20; cart icon 24 with badge (16 circle, `primary` fill, count `tiny-10-medium` in ink, offset +15px x); Login button 100 × 35, `primary`, radius 6, icon (Iconly Curved/Logout 20) + "Entrar" 16 medium ink, gap 4.
- Component note from Figma: `Active` variant = Home on Início/Entrar/Criar conta/Perfil/Carteiras; Market on the four Mercado-flow screens. Badge Count = cart item count.

## Hero (`70347:239`) — 1200 × 450, 32 below header

- Background vector `2:104` (same tone as page ink; subtle shape — export as SVG if needed).
- Inner row 1160 wide (pl 40), `justify-between`, items centered.
- **Copy column** 600 wide, gap 44 between content and carousel dots (dots right-aligned):
  - Eyebrow "Bem-vindo à Kurio": `body-14-medium-tracked-16`, foreground.
  - Title (2 lines, uppercase): `display-43-bold`, line-height 70, foreground. Gap 8 to eyebrow.
  - Paragraph (557 wide): `body-14-regular-24`, `text-secondary`. Gap 4 to title block.
  - CTA "EXPLORAR": 140 × 40, `primary`, radius 6, `body-lg-16-bold-20` ink, pl 28 / pr 36. Gap 32 above.
  - Carousel indicator `3:131` 40 × 8 (three dots) → implement in code.
- **Artwork** 450 × 450, radius 24, `object-cover`.

## Products (`70342:2831`)

Two columns: sidebar 310 + gap 48 + grid 842.

### Sidebar (`70410:3725`)

**Filters** component (`70485:381`) — 310 wide, `surface-card`, padding 20, groups gap 40:
- Group title: `body-lg-18-bold-16`, foreground; gap 12 to list.
- **Coleções** list (px 12): rows `justify-between`, line-height 40. Label `body-15-regular-40`, count `(n)` `body-15-bold-40`. Active = `text-accent`, inactive = `text-secondary`. Items: Arte digital 33, Fotografia 12, Música 65, Arte 3D 39, Colecionáveis 23, Generativa 17, Jogos 19, Assinaturas 13, Utilidade 18.
- **Faixa de preço**: dual-handle slider (handles 15 circles, active track accent, rest muted), label "Preço: 0,02 - 12,30 ETH" `body-15-regular` foreground, "Aplicar" button (px 12 py 8, radius 6, primary, `body-lg-16-bold-20` ink). Gap 12.
- **Rede** list: Ethereum 119, Polygon 78, Solana 86 (same row style, all `text-secondary`, regular counts).
- Figma note: described as "collection checkboxes" → implement as accessible toggles/checkboxes styled as text rows.

**Featured NFT Banner** (`70410:3791`) — 310 × 470, 24 below filters:
- "NFT EM DESTAQUE" (accent, uppercase, ~32 line box) and "OFERTA LIMITADA" (foreground, 16 line box), centered, px 20, gap 16.
- Artwork 310 × 368 rounded, 16 below. Small decorative rounded squares overlapping (Rectangles 30–32) — export with the artwork or omit.

### Product grid (`70342:2830`) — 842 wide

**Toolbar** (height 18), `justify-between`:
- Tabs gap 20: "Todos os NFTs" (active, accent + 101px underline 6 below), "Novos lançamentos", "Em alta" — 16px foreground.
- Sort (300 wide): "Ordenar por:" + "Listados recentemente" + Iconly Two-tone/Arrow-Down-2 (16).

**Grid rows**: starts 50 below toolbar. 3 columns × 258, column gap 34, row gap 72 (row height 356 → next at 428).

**Product card** (258 × ~356), flex column gap 12:
- Media box 258 × 300, `surface-card` fill, **no radius**; artwork 250 × 250, radius 15, centered horizontally (x 4), vertically ~24–31 from top (inconsistent in Figma → normalize to centered).
- Name: `body-lg-16-regular-16`, foreground.
- Price row gap 12: current `body-lg-18-bold-16` `text-accent`; optional previous price `body-lg-18-regular` `secondary` (rendered without strikethrough in Figma — add strikethrough + sr-only "previous price" for a11y; record as deviation).
- One card (`70342:2816`, "NFT Artwork 10") has no name/price in Figma — treat as design omission.

**Pagination** (`70342:2825`) — right-aligned, 50 below grid, gap 8:
- 35 × 35 squares, radius 4. Current: `primary` fill, `body-lg-18-bold-16` ink. Others: 1px `border`, 18 regular foreground. Next: Iconly Curved/Arrow-Right-2 (18).

## Promos (`70353:241`) — two cards 586 × 250, gap 28

Card: radius 8, `surface-card`, overflow hidden.
- Artwork left (~290 × 250, radius 18, flush left).
- Text right-aligned, right padding 30: title 2 lines `body-lg-18-bold-24` foreground (top 37); copy `body-14-regular-24` `text-secondary` (~263 wide, top 94).
- Button 140 × 40, `primary`, radius 6: "Explorar" `body-14-medium-20` ink + Iconly Curved/Arrow-Right 18 (top 164).
- Decorative mask group (`5:134` / `5:130`): two overlapping 256 circles bottom-left (uses `background-elevated`, low opacity) → export as SVG.

## Blog — "Diário da Cunhagem" (`70343:253`)

- Header centered: title (~24–28 bold, 37 line box) + subtitle (`text-secondary`, ~14), gap 12. Cards 40 below.
- Cards: 4 × 268 wide, gap 24 (row is 1144 wide, left-aligned within 1200 → normalize).
- Card: radius 8, `surface-card`, overflow hidden. Image 268 × 195 (no radius). Content pt 12 / px 16 / pb 16, gap 8:
  - Meta "12 de setembro  |  Leitura de 6 min": 12 medium lh 16, `text-secondary`.
  - Title: 16 bold, `text-primary`.
  - Excerpt: 12 medium lh 16, `text-secondary`.
  - CTA "Ler mais →": `caption-12-bold` `text-accent`, gap 4.
- Out of scope functionally (editorial) — links must not fake success.

## Footer — component "Footer" (`70491:1286`), 1200 × 610

1. **Features band** — `surface-card`, h 250, p 32. Three feature columns (px 16, ~265 wide) separated by 1px `primary` vertical rules, then newsletter column (357):
   - Medallion 74 circle `primary`, letter (W/C/D) `heading-24-bold` ink. Title `body-lg-17-bold` foreground; copy `body-14-regular-22` `text-secondary` (204 wide). Gap 12.
   - Newsletter: title `body-lg-18-bold-16`; input 40h `surface-dark`, radius 6, shadow `input`, placeholder `body-14-regular-16` `secondary`; attached submit "Enviar" (85 wide, `primary`, right radius 6, `body-lg-18-bold-16` ink). Caption `caption-13-regular-22` `text-secondary`.
2. **Brand band** — `surface-dark`, h 88, p 32, gap 92: KURIO wordmark · tagline (14/22) · email link · phone (228 wide).
3. **Links panel** — `surface-card`, h 236, p 32, column gap 124: three link columns (title `body-lg-18-bold-16`, links 14 regular lh 30, gap 8) + social/wallets column (228): social icons 30 × 30 gap 10; wallet chip h 26, `surface-dark`, 1px `border-soft`, radius 6, `tiny-9-bold` accent "METAMASK • WALLETCONNECT • COINBASE".
4. Copyright "© 2026 Kurio. Propriedade digital para todos." 14/30 centered, 6 below.
