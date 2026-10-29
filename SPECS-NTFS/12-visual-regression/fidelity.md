# 12 — Visual check, fidelity pass (2026-10-29)

Brief §8 and §11 ask to preserve Figma's typography, colors, spacing, hierarchy, images, proportions and composition. This pass compared every screen with its PNG in `figma_tokens/screenshots/`, at 1440 (desktop) and at 414 (the mobile frame width; the app was also checked at 390), fixed what was clearly visible and cheap, and recorded the rest here. No Figma MCP tool was used.

Method: `pnpm build && pnpm preview`, Chrome DevTools at 1440 × 900 and 414 × 896 (dpr 1), full-page capture after scrolling the lazy images in, and a side-by-side crop against the Figma PNG. Sizes were read from glyph widths (Roboto Mono advances 0.6 em, so a width divided by the character count gives the font size, ±0.5 px). Screens: home, details, cart, checkout, login, sign-up, profile, wallets, receipt.

Accepted deviations from earlier specs were not touched (auth as pages, the header user menu, the explorer, top-center toasts, pt-BR dates, Subtotal/Desconto rows, mobile compositions Figma does not draw, the breadcrumb's current-page item, the fixture images).

## Findings

| Screen | Element | Difference | Fixed / accepted deviation |
|---|---|---|---|
| Home D | Hero title | "SEJA DONO DO FUTURO DA" fitted on line 1; Figma breaks after "FUTURO" | Fixed: `text-balance` on the title (`hero-carousel.tsx`) |
| Home D | Hero copy block | Block was centered without the dots, so it sat 26 px lower than Figma | Fixed: `lg:pb-13` on the copy column puts eyebrow, title and button at Figma's y |
| Home D | Hero pager dots | Floated next to the button row (y 442); Figma has them below the button, right-aligned on the 600 px column (y 504) | Fixed: `lg:bottom-8.5` |
| Home D | Hero pager dots, shape and spacing | Figma: three equal 8 px dots, gap 8. Ours: the active dot is a 20 px pill and the others are dimmed, 24 px hit areas (gap 16) | Accepted: the pill is the non-color cue for the current slide (WCAG 1.4.1) and 24 px is the minimum target size (2.5.8) |
| Home D | Header cart badge | Figma shows "6", the guest cart is empty so ours shows none | Accepted: correct behaviour (the badge is the real cart count) |
| Home D | Product tabs | 16 px with a 32 px gap; Figma 15 px (width of "Todos os NFTs" 117 px), 20 px gap, text flush with the grid edge, underline 6 px under the text | Fixed: `lg:text-body-md lg:gap-5 lg:px-0 lg:pb-1.5` (still 28 px tall) |
| Home D | Product card text | Name lh 22 and price lh 24 made cards 364 px tall (Figma 356) and the page 45 px taller | Fixed: lh 18 / 20 and gap 6, card is 356 px, row pitch 428 as in Figma |
| Home D | Price filter | Label and "Aplicar" aligned with the group title; Figma indents them 12 px with the list text | Fixed: `px-3` / `ml-3` |
| Home D | Price label decimals | "Preço: 0,02 - 12,30 ETH" in Figma, "0.02 - 12.30" ours | Accepted: every other amount in Figma uses a dot ("1.19 ETH"), and the app formats all ETH amounts the same way |
| Home D | Collections active item | Figma shows "Arte digital" active; ours has none selected until a filter is chosen | Accepted: behaviour (the default state is "all"), counts differ because they come from fixture data |
| Home D | Promo cards | Artwork 250 wide (Figma 287); copy 16 px lower than Figma; third line wrapped differently | Fixed: artwork `w-72`, copy `mt-2`, button `mb-11.5`, `pl-1` so both titles wrap in two lines as in Figma |
| Home D | Promo decoration | Figma draws two faint circles bottom-left behind the artwork; ours draws two 5 % circles that read as a dark blob at the artwork's corner | Accepted: decorative, drawn in CSS because the SVG export is not in the payload |
| Home D | "Diário da Cunhagem" title | 24 px; Figma 28 px (glyph width 303 px / 18 chars) | Fixed: `lg:text-[1.75rem]` |
| Home D | Blog cards | Figma: 268 px cards left-aligned in a 1144 px row; ours 282 px filling the 1200 px column | Accepted: Figma's row does not match its own 1200 column (normalized in spec 05) |
| Home D | Footer features | Titles 18 px, copy 214 px wide; Figma 17 px and 204 px, so the first column wraps in 4 lines | Fixed: `text-[1.0625rem]`, `max-w-51` |
| Home D | Footer email | "contato@kurio.example" vs Figma "contato@email.com" | Accepted: `.example` is the reserved TLD chosen for fictitious data (spec 01 §8) |
| Home D | Pagination | "1 2 … 14 >" vs Figma "1 2 3 4 >" | Accepted: the pager is computed from the 14 fixture pages |
| Home M | Tabs | 16 px with a 24 px gap, so "Em alta" fell off a 390 px screen; Figma 14 px, 16 px gap | Fixed: `text-body gap-4 px-0` below `lg` |
| Home M | Card text | Name lh 22 + price lh 24 + gap 6 (29 px between centers); Figma 18 px | Fixed: lh 18, no gap below `lg` |
| Home M | Hero card | 198 px tall, Figma 190; artwork 20 px lower | Accepted: spec 11 minimum height so the 390/380/360 px copy is not cut. The thumbnail now shows at every width (item 3b) |
| Home M | Hero dots | Pill + dimmed dots, as on desktop | Accepted (same reason as desktop) |
| Home M | Tab bar | Active dot under the icon, outline heart; Figma has neither | Fixed by the owner's list (item 3c): filled icons, no dot |
| Details D | Breadcrumb | 16 px; Figma 15 px | Fixed: `text-body-md` (also the cart and checkout breadcrumb) |
| Details D | Breadcrumb content | Ours adds the NFT name as the current item | Accepted (spec 06 decision: current page in a breadcrumb) |
| Details D | Price | 18 px; Figma 22 px (glyph width 106 px / 8 chars) | Fixed: `lg:text-[1.375rem]` |
| Details D | Rating text | 13 px, medium weight (looked bold); Figma 14 px regular | Fixed: `text-body` |
| Details D | Title block | 4 px taller than Figma (gap 12) | Fixed: `lg:gap-2` |
| Details D | Edition chips | 13 px with 12 px padding ("1/1" chip 48 wide); Figma 12 px, chip 36 wide | Fixed: outline chip `px-2 text-caption-sm`, still 28 px tall |
| Details D | Default edition | Ours selects 1/1, Figma shows 1/50 | Accepted: behaviour (first available edition) |
| Details D | Edition helper line | "Edição única · máx. 1 por pedido" under the chips | Accepted: states the purchase limit (spec 06) |
| Details D | Stepper | 31 × 31 circles; Figma 31 × 49 pills with larger glyphs | Fixed: `h-12 w-7.75`, glyph 18 px |
| Details D | COMPRAR / Favoritar | 16 px with tracking; Figma 14 px | Fixed: `text-body`, tracking dropped |
| Details D | Description tabs | 16 px, 8 px inset; Figma 17 px, flush, 32 px apart | Fixed: `lg:px-0 lg:text-[1.0625rem]` |
| Details D | Related row cards | Plain image row, 8 px text inset; Figma boxed cards (219 × 255 `surface-card`, artwork inset 4 px, text flush left, price 16 px) | Fixed: compact variant is boxed from `lg` (`compactMediaShape`); also used by the cart row |
| Details D | Related row pager dots | Figma draws 3 dots (current filled, two outlined, 12 px, 8 gap) 32 px under the row | Accepted: the response holds at most 5 NFTs and all 5 fit, so there is no second page; dots would be an inert control that looks interactive |
| Details D | Related row artwork | Figma insets and sizes the artwork differently per card | Accepted: normalized to a centered square (spec 06) |
| Details D | Thumbnails | Figma repeats one artwork; ours shows four fixture images, the first with a selected border | Accepted: fixture data, selected state is required |
| Details D | Spec list | Contract / Direitos autorais values were swapped in Figma | Accepted: values placed under the right labels (spec 06) |
| Details M | Title | 18 px; Figma 20 px | Fixed: `text-[1.25rem]` |
| Details M | Buy bar | Pill filled the row; Figma 196 × 60 pill + 60 circle with free space on the right. Price 18 px (Figma 20). Bar 138 px tall (Figma 163: 21 above the row, 20 between rows, 34 under the buttons) | Fixed: `w-49`, price `text-[1.25rem]`, `gap-5`, `pb-[2.125rem]` |
| Details M | Back button | Row 10 px lower than Figma's details frame (center y 50, Figma 40); the cart and checkout frames do match at 50 | Fixed in the follow-up pass (see below): `raised` top bar for `panel` routes |
| Details M | Zoom button on the artwork | Not drawn on Figma's mobile frame | Accepted: needed to open the large image (spec 06) |
| Cart D | Breadcrumb | 16 px vs 15 px | Fixed (shared `PageBreadcrumb`) |
| Cart D | Summary labels and rows | Labels 14 px, rows 36 px apart; Figma 15 px and 32 px | Fixed: `text-body-md`, `gap-2`; value column `min-w-28` so "Desconto do lançamento" stays on one line |
| Cart D | CTA and link | Button 44 px, link 16 px; Figma 40 px and 14 px | Fixed: `h-10`, `text-body` |
| Cart D | Total divider | Ours draws a rule above "Total" | Accepted: hierarchy cue, no equivalent in Figma |
| Cart D | Line rows | Third line "Edição: …" and token id at 12 px (Figma 14, no edition line) | Accepted: the edition is part of the line's identity (two lines of the same NFT can differ by edition) |
| Cart D | Related row | Plain row with no dots | Fixed boxed cards as on details; dots accepted as above |
| Cart M | Card gap and edition line | 16 px gap, edition 13 px medium; Figma 20 px, 14 px regular | Fixed: `gap-5`, `text-body font-normal` |
| Cart M | Card layout | Trash top-right and stepper bottom-right; Figma has the stepper mid-right and no trash (overlapped on one card) | Accepted: the remove action is required (spec 07 decision) |
| Cart M | Sheet rows | Labels 14 px, values 18 px, 36 px pitch; Figma 15 px, 16 px, 32 px | Fixed (`text-body-md`, values `text-body-lg` below `lg`, `gap-2`) |
| Cart M, details M, checkout M | Wide CTA | Used `primary-soft` (45 % to 100 % fade, dark on the left); Figma's wide pills run from `primary` to a slightly deeper tone | Fixed: new `bg-primary-cta` utility (`theme.css`), used by "Comprar NFT", "Conectar e finalizar", "Confirmar compra", the receipt and account mobile CTAs. `primary-soft` stays on the filter button, FAB and "Aplicar", where Figma uses it |
| Checkout D | Field labels | 13 px medium; Figma 15 px regular | Fixed: shared `Label` is `text-body-md font-normal` (also profile, wallets, auth) |
| Checkout D | Order lines | Name wrapped to two lines ("Emerald Ape / #042") because of fixed 104 px amount and 12 px gaps | Fixed: `gap-2 pr-2`, amount `min-w-22`, as Figma's single line |
| Checkout D | Totals | Labels 16 px, values 16 px, 36 px pitch; Figma 15 px, 18 px, 32 px | Fixed: `lg:text-body-md`, `lg:text-title`, `lg:gap-2` |
| Checkout D | Provider rows | 16 px; Figma 15 px (desktop) and 14 px (mobile) | Fixed: `text-body lg:text-body-md` |
| Checkout D | "Usar outra carteira?" | Radio in Figma, checkbox ours | Accepted: it is a boolean (spec 09) |
| Checkout D | Provider chip row | Figma draws the "METAMASK • WALLETCONNECT • COINBASE" chip as a radio card | Accepted: the chip is a label, not a choice (spec 09) |
| Checkout M | Top bar title | "Pagamento com carteira" was cut at 390 px | Fixed: bar gap 16 to 8 px (`mobile-top-bar.tsx`); still ellipsised below about 370 px |
| Checkout M | Heading and radios | "Carteira" vs Figma "Carteira conectada"; unselected radios in Figma are dark rings | Accepted: heading copy kept (tests and a11y names rely on it); a dark ring on the card fails the 3:1 non-text contrast (a11y wins) |
| Checkout M | Extra "Dados do colecionador" section | Not in Figma's mobile frame (it only shows wallet choice) | Accepted: the profile fields are required by the order |
| Login, sign-up D | Page vs modal | Modal over the home page in Figma | Accepted: pages (spec 04). The card itself matches: 500 px wide, 600 px tall, tabs, fields, divider, social buttons, bottom bar |
| Login D | "Esqueceu a senha?" | Regular in Figma, bold ours | Accepted: not worth a one-off weight; still the accent color |
| Profile D | Menu, form grid, "Alterar senha", "Salvar" | Matches (sizes, 6 px active bar, field grid). Ours adds hint lines, shows the ".eth" suffix inside the ENS field instead of a leading select, and a "Remover" that dims when there is no avatar | Accepted: hints and the disabled state are a11y/behaviour; the suffix is spec 08's decision |
| Wallets D | Principal / secondary forms | Matches the grid. Ours prefills both wallets (fixture data) and lists the secondary form open | Accepted: fixture data |
| Receipt D | Summary band | 11 px; Figma 13 px | Fixed: `text-caption font-normal` (dt stays bold) |
| Receipt D | Page vs modal | Figma shows only the modal on an empty page; ours keeps the header | Accepted: page with the app shell (spec 10) |
| Receipt D | Extra rows and notes | Subtotal, Desconto, "Explorador simulado" note and "Continuar explorando" link | Accepted: spec 10 amendment (simulated explorer) and the added summary rows |

## Owner's design-fix list (2026-10-29, priority over the deviations above)

| # | Item | Result |
|---|---|---|
| 1 | Desktop card hover buttons | Kept. Picked the **light glyph** for all three: the heart now has the same `text-foreground` as cart and search (`actionClass`), and only a favorited item turns `primary` (with the filled heart), so the state is not carried by color alone. Light is the design system's color for icon buttons on `ink`; accent stays the "on" state. |
| 2a | Mobile details zoom button | Inside the image's top-right corner (the track has a 24 px gutter, so the offset is 39 px, not 15 px). |
| 2b | Mobile details background | One `surface-card` panel from the top bar down: new `panel` flag in the inner shell config (`$nftId.tsx`), a wrapper in `app-shell.tsx` with `max-lg:min-h-dvh max-lg:bg-surface-card`. The back and heart circles are now `surface-raised` with a 20 % `primary` border (Figma `#2F1D15`), so they read on the panel. |
| 2c | Cart button beside "Comprar NFT" | `shop.svg` (`BagIcon`, filled) in a `surface-raised` circle with the soft border. Color: Figma's glyph measures `#B39463` (`secondary`, the same tan as the tab bar icons), not the orange accent; `text-secondary` was used to match the frame. One-line change to `text-text-accent` if orange is wanted. |
| 2d | Steppers, buy pill, heart | Qtd. buttons are 18 × 28 `primary` pills (`QuantityStepper size="pill"`; the cart cards keep the 22 px squares); the pill is 196 wide (narrower) with the `bg-primary-cta` fill; the heart is an outline heart in a dark circle until favorited (filled heart when favorited). A stepper at its bound is dimmed, as before (a11y: the default 1/1 edition has a maximum of 1). |
| 3a | Mobile card favorite | Solid `surface-card` circle (was 70 % `ink`), inside the image's top-right corner (`top-4 right-3`); outline heart, filled heart + `primary` when favorited. The orange hearts seen on a signed-in account are real favorites. |
| 3b | Mobile hero | Background is a 135 deg gradient (`primary` 30 % over `ink` into `surface-card`, `bg-hero-card`) with two 248 px circles placed from the mask's geometry (overlap = the lighter lens); the thumbnail of the next slide now sits inside the artwork's bottom-left corner at every width (it was hidden under 400 px because it overlapped the copy). **Deviation (a11y wins):** Figma's card is brighter (primary at about 42 %, lens about `#96673F`); the copy over it measures 2.8:1 there, so the gradient starts at 30 % and the circles are 5 % (`contrast over artwork` stays green). |
| 3c | Tab bar icons | Always the filled glyphs (`home`, `heart-filled`, `shop`, `user`); inactive `secondary`, active `text-accent`; the dot under the active icon is removed (the current page is still `aria-current`). |
| 3d | Tab bar center button and notch | The FAB is `bg-primary-fab`: 45 % `primary` at the top to solid `primary` at 80 %, vertical as in Figma (it was a 137 deg fade that thinned out toward the bottom). The notch is an `ink` half-disc of 47 px radius around the button (Figma's ring, measured on the PNG) instead of the 42 px mask, so the cut-out reads as a solid ring; the old `tab-bar-notch` mask utility is gone. Not drawn: the small rounded "ears" where the bar's top edge meets the ring (added in the follow-up pass, see below). |
| 4 | "Meu perfil" menu | Measured on the PNG: every label is `text-accent` (`#E89B55`) in Figma; what differs is the icon: **active icon `primary` (`#D28A4C`), inactive icons `secondary` (`#B39463`)**, with the 6 px bar on the active row. Done that way (icons only); the labels stay accent as in Figma. Same component on mobile. |

## Test changes caused by the fidelity pass

- `loading-states` skeletons follow the new sizes (card text lines, details breadcrumb and action row, cart cards gap, summary value column).
- `catalog.spec.ts` "the segment tabs scroll sideways": the 14 px tabs now fit a 390 px phone, so the test checks the 320 px width (same assertion, the narrowest supported screen).
- The receipt's summary band is 13 px from `lg` only: at 13 px on mobile the tooltip of the shortened hash stayed open over the back button while the keyboard walked the page (`focus stays visible and uncovered`).

## Verification

- Baselines regenerated with `pnpm exec playwright test --grep @visual --update-snapshots --workers=3`: `home`, `home-loading` (desktop and mobile), `details` and `details-viewport`, `cart`, `checkout` changed as described above and were reviewed one by one. `details-loading` (desktop and mobile) did not change.
- `pnpm test:visual:update -- --workers=3` does not pass the flag on (pnpm hands `--workers=3` to Playwright as a file filter and 6 workers run). Use `pnpm exec playwright test --grep @visual --update-snapshots --workers=3`.

## Follow-up pass (2026-10-29, owner review of the deployed app)

Same method (Chrome DevTools at 414 and 390, 1440 for shared parts, crops against the PNGs). Contrast numbers were measured on the screenshot of the hero with the text hidden, the way the `contrast over artwork` test does it.

| # | Item | Before | After |
|---|---|---|---|
| 1 | Tab bar notch "ears" | The bar's top corners met the ring at a right angle | Two 14 px squares at the ring's ends are `ink` outside a quarter circle, so the bar's corners are rounded into the ring (`mobile-tab-bar.tsx`). The FAB gradient and the solid 47 px ring are unchanged |
| 2 | Mobile filter button, odd half-orange edge | `Button` has `border border-transparent`; a `background-image` gradient is painted from the padding box and *repeats* into the transparent border, so a 1 px strip of the opposite end of the gradient showed along the edges | `bg-origin-border` in the shared `Button` base (`button.tsx`): the gradient now covers the border box, no strip. The same fix applies to every gradient button (`bg-primary-cta`, `bg-primary-fab` users). Focus ring is the global `:focus-visible` one, untouched (still keyboard only) |
| 3 | Details mobile top bar 10 px low | Circles centered at y 50, Figma 40 | `MobileTopBar` takes `raised` (`pt-3` instead of `pt-5.5`), set from the `panel` flag in `app-shell.tsx`, so only the details route moves. Back and heart circles now center at y 40 as in Figma; the artwork starts at 68 (Figma 66). Cart, checkout, wallets etc. keep 50 |
| 4 | Brighter mobile hero | Gradient started at 30 % `primary` over `ink`, circles 5 % | Gradient starts at 42 % (Figma ~42 %) in the top-left corner, which holds only the eyebrow and title, and fades along the 135 deg diagonal into `surface-card`, so the description and the link sit on a darker part. A radial glow (26 % `primary`, 170 px) sits behind the artwork. Circles unchanged (5 %): at 8 % the description fell to 4.38:1. Measured at 390: eyebrow 7.5:1, title 7.8:1, description 4.72:1, EXPLORAR 4.64:1, the test's threshold is 4.5:1 and was not touched. Still not Figma's lighter lens in the middle (that would sit under the copy) |
| 5a | Login and sign-up card (D) | Tabs 18 px bold with 16 px padding; intro 12 px wrapping before "perfil"; fields on `ink`; social buttons white and bold; divider inset; stack 4 to 9 px off | Tabs 20 px medium with 10 px padding (glyph widths 69 and 130 px as in Figma); intro 13 px, 16 px line, unwrapped width; fields on `surface-card` from `lg` (mobile stays on `ink`, as Figma's mobile frame); field gap 12; button 45 px; divider full card width; social labels `text-secondary`; "Esqueceu a senha?" regular; close button 20 px from the top. Every row of the form lands within 2 px of Figma |
| 5b | Profile (D) | Menu labels 14 px, avatar label bold 14, "Alterar" 16 px and 125 px wide | Menu labels 15 px (glyph width 160 px as in Figma), "Avatar" label 15 px regular, "Alterar" and "Remover" 14 px (98 px button, 24 px gap), "Salvar" 14 px |
| 5c | Wallets (D) | Section titles 18 px, "Salvar carteira" 16 px, 202 px wide | Titles 17 px, button 14 px with 6 px padding (about 138 px; Figma squeezes the label into 131) |
| 5d | Receipt (D) | Summary band 13 px; token id lines 12 px; totals and line amounts 16 px | Band 14 px, token id and edition 14 px, totals labels 15 px (regular values 18 px, "Total" 18 px bold), line amounts 18 px (glyph widths as in Figma). Mobile unchanged |

Checked and left alone: card corner radius of the sign-up modal, the profile ENS suffix and the extra hint lines (already accepted above), the band's divider style (Figma floats short rules, ours are full-height cell borders), and the item column offsets of the account menu (Figma's differ per row by a few px, no rule to copy).

## Test changes caused by the follow-up pass

- None in the specs. The `contrast over artwork` test and every other a11y check pass untouched (251 passed in `a11y.spec.ts`).
- Baselines regenerated: `mobile-chromium/home`, `home-viewport` (hero, filter button, ears; Playwright's per-pixel threshold let the old image pass, so both files were deleted and written again to keep the baseline honest), `details` and `details-viewport` (top bar). Desktop baselines did not change.

## Not done / dropped

- Pager dots of the related row (at most 5 related items, they would be an inert control): kept as decided.
- Cart button glyph uses `secondary` (as measured); switching to accent is one class (`text-text-accent`) in `mobile-buy-bar.tsx`: kept as decided.
- Figma's mid-card lighter lens in the mobile hero (it sits under the description and fails 4.5:1).
