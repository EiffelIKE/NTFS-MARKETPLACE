# NFT details — Desktop (1440)

Figma node `10:244` "Desktop / Detalhes do NFT" — 1440 × 2246. Values in px.

> **Partial extraction.** Only `get_metadata` succeeded (geometry, node IDs, copy). The Starter-plan MCP quota ran out before `get_screenshot` / `get_design_context`, so **colors, font styles and radii below are inferred** from the Home extraction and marked *(inferred)*. Verify against a manual screenshot before implementing (spec 06).

## Page shell

Same shell as Home: `color.ink` background, 1200 container (120 gutters), top padding 24, section gap **96**.

| Section | Node | y | Size |
|---|---|---|---|
| Top (header + breadcrumb + product) | `70342:2770` | 24 | 1200 × 553 |
| Description (tabs) | `70342:2780` | 673 | 1200 × 340 |
| Related products | `70364:239` | 1109 | 1200 × 407 |
| Footer (instance, same as Home) | `70493:1151` | 1612 | 1200 × 610 |

## Header

Instance `70488:626` "Header Row" — the bare variant **without divider** (market-flow screens), active nav item = **Mercado**. See `home.md` → Header.

## Main (`70362:239`) — 32 below header

- **Breadcrumb** `10:290` "Início / Mercado" — 145 × 16, then 12 gap to the product row. Should render as a `nav[aria-label=breadcrumb]` with the NFT name as the current item (Figma omits it — deviation to decide).
- **Product row** `70342:2764` — 1200 × 448: images 573 + gap 32 + details 595.

### Product images (`70363:239`) — 573 × 448

- **Thumbnails** `70342:2682`: vertical column 100 wide, 4 × 100² tiles, gap **16**. Backing tiles `11:1074…1077` (rounded rectangles, likely `surface-card`, radius *(inferred)* `md`/8) with artwork `11:1181`, `11:1188`, `11:1189`, `11:1190` on top.
- **Main image** `70342:2683`: 444² box at x 128 (gap 28 from thumbs), inner artwork `11:1161` 404² with padding **20** (backing surface + artwork, same pattern as Home grid card).
- **Favorite chip** `70410:3937`: 30² circle (`11:1184`) + heart vector 20, absolutely positioned top-right of main image (x 530, y 15). Same role as the mobile favorite button.
- Behavior: clicking a thumbnail swaps the main image (gallery). Keyboard: thumbnails are buttons with `aria-pressed` / `aria-current`.

### Details (`70342:2763`) — 595 wide, stacked, gaps ≈ **13** between blocks

1. **Title block** `70342:2686` (h 81):
   - Name `11:1132` "Emerald Ape #042" — box h 37 (largest text on page after Home hero; likely 24–28 bold, foreground *(inferred)*).
   - 12 below: row `justify-between` h 20: price `11:1141` "1.19 ETH" (h 16, accent bold *(inferred)*) · rating `11:1210`: 5 × Iconly/Bold/Star 15 (gap 4) + "19 avaliações de colecionadores" (gap 4).
   - Divider `11:1211` at y 81, **573** wide (not full 595).
2. **About** `70342:2687` (h 94): label "Sobre este NFT:" (h 16) + 12 gap + paragraph 574 wide, 3 lines (h 66 → line-height 22).
3. **Edition selector** `70342:2696` (h 56): label "Edição:" + 12 gap + chips row gap **6**: `1/1` (36), `1/10` (42), `1/50` (46), `ABERTA` (66), all h 28, pill shape (ellipse backgrounds), text inset ~5–7. Likely `surface-dark` + `border-soft` with selected = primary *(inferred, selected state not visible in metadata)*. → radio group.
4. **Actions row** `70342:2762` (h 49.5), `justify-between`:
   - **Quantity stepper** `11:1238`: 103 wide — "−" button 33 × 49.5 (icon 26.4), value "1" (13 × 28), "+" button 33 × 49.5; gaps 12.
   - **Buttons** `70410:3938` gap 8: "COMPRAR" 130 × 40 (primary filled, *(inferred)* radius 6) · "Favoritar" 130 × 40 with heart 20 + label, gap 8 (secondary/outline *(inferred)*).
   - Brief note: "COMPRAR" = add to cart (the brief's purchase flow goes through the cart).
5. **Meta** `70342:2761` (h 114):
   - Three lines gap 12 (h 20 each): "ID do token: #0042", "Coleção: Kurio Apes", "Atributos: Óculos, Esmeralda, Raro". Label/value likely split in weight or color *(inferred)*.
   - 12 below: share row gap 8: "Compartilhar este NFT:" + LinkedIn 15 (`11:1245`), Message 18 (`11:1248`), Twitter 16 × 12 (`11:1247`).

## Description (`70342:2780`) — 1200 × 340, 96 below Top

- **Tabs** `70342:2772`: "Detalhes do NFT" (active, 161 wide, underline `11:1252` 28 below text) · gap 32 · "Avaliações de colecionadores (19)". Full-width hairline `11:1250` at y 28 (same pattern as Home toolbar tabs). → `role=tablist`.
- 12 below the rule: body paragraph `11:1251` (1200 wide, h 120 → 5 lines × 24).
- Spec list — label lines (h 24) followed by value lines (h 24), 12 between pairs:
  - "Rede:" → "Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS."
  - "Contrato:" → "Creator royalty: 5% on secondary sales, paid automatically by supported marketpl…" **(Figma bug: contract/royalty values are swapped and this one is English + truncated)**
  - "Direitos autorais:" → "0x7A42...19E8 • Contrato inteligente ERC-721 verificado."
  - Implement as `<dl>` with the values in the correct order (Contrato → address, Direitos autorais → royalty in pt-BR).
- Reviews tab content is **not drawn** → design in spec 06 using the card/text tokens.

## Related products (`70364:239`) — 1200 × 407, 96 below Description

- Section heading "Mais desta coleção" (h 16) + full-width rule at y 28.
- 32 below: row of **5 cards**, width ~219–220, gap **26** (x 0, 245, 491, 736, 981).
  - Media 219 × 255 (backing surface) with artwork inset — offsets are inconsistent in Figma (`20/4 190×243`, `4/20 212²`, `4/16 213²`). Normalize to a centered square ~212, padding 4 *(deviation)*.
  - 12 below media: name (h 20) + price (h 16), stacked, no gap.
  - Items: Cosmic Bloom #118 1.29 · Violet Nomad #314 1.39 · Ivory Baron #088 1.79 · Golden Beat #207 0.99 · Golden Signal #160 0.39 ETH.
- **Carousel dots** `70364:240`: 3 × 12² circles, gap 8, centered, 32 below the cards → carousel (3 pages of 5) or replace with a static row.
- Card is a smaller variant of the Home product card (219 vs 258 wide) — implement as one `ProductCard` with a size prop.

## Footer

Instance `70493:1151` — identical to Home (`home.md` → Footer).

## Assets

New artwork nodes: `11:1161` (main), thumbs `11:1181`, `11:1188`, `11:1189`, `11:1190`, related `11:1177`–`11:1180`, `11:1182`. Icons: star `11:1195`, heart `70410:3940`, favorite chip `70410:3937`, stepper icons `70410:4191` / `70410:4195`, share icons `11:1245`, `11:1247`, `11:1248`. See `../assets.md`.

## To verify manually (quota exhausted)

- Name/price/label font sizes & weights; star color (likely `primary`).
- Edition chip default vs selected styling; stepper button fill/border.
- "Favoritar" button style; thumbnail active state; tab underline color (likely accent as on Home).
