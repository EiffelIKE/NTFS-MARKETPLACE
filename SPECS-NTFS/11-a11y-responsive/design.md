# 11 — Accessibility & responsiveness · Design

> Status: Draft — see [Open questions](requirements.md#open-questions). Inventories in §3–§5 list what specs 04–10 are expected to build; each row is confirmed or corrected when its owner spec is Done.

Implements [`requirements.md`](requirements.md). No new dependencies: axe comes from `@axe-core/playwright` (spec 01), state control from `window.__mock` (spec 02). Figma input: every screenshot in `figma_tokens/screenshots/`, for the tablet and zoom judgments in §7.

## 1. Test support (`e2e/support/a11y.ts`)

Extends the spec 01 helpers (`expectNoAxeViolations`, `expectNoHorizontalOverflow`):

| Helper | Does |
|---|---|
| `scanStates(page, route, states)` | For each state (`loaded`, `empty`, `error`), prepares it through `mock(page)` (scenario or rule), navigates, waits for `aria-busy="false"`, runs axe |
| `tabTo(page, name, { max })` | Presses `Tab` until the focused element's accessible name matches, failing after `max` presses; returns the press count, so focus-order tests are readable |
| `expectFocusVisible(page)` | The focused element has an outline ≥ 2 px or the ring's box-shadow, and its bounding box is not covered by the header, tab bar or a fixed bar (`elementFromPoint` at its center returns it or a descendant) |
| `expectFocusOn(page, locator)` | Polls `document.activeElement` |
| `liveMessages(page)` | Collects text written to the spec 01 announcer regions and the sonner list during a test (a `MutationObserver` installed with `addInitScript`), so tests assert "announced once" |
| `withTextSpacing(page)` | Injects the WCAG 1.4.12 stylesheet (line-height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em) |
| `zoom(page, factor)` | Sets the viewport to `1280 / factor` CSS px wide and the device scale factor to `factor`; this is how Chromium reflows at browser zoom |

## 2. Route × state matrix (A11Y-01, A11Y-02)

Private routes log in as Ana through `loginAs` (spec 02 helper). Each cell is an axe scan in both projects.

| Route | Loaded | Empty | Error | Overlays |
|---|---|---|---|---|
| `/` | default | `?scenario=empty` | `server-down` | filter sheet (mobile), search focus |
| `/?favorites=1` | Ana | Bruno | — | — |
| `/nfts/emerald-ape-042` | default | — | `server-down`; `/nfts/nao-existe` (404) | gallery viewer, if spec 06 adds one |
| `/cart` | Ana | Bruno | `server-down` | remove confirmation, coupon error |
| `/checkout` | Ana | — (redirect, spec 09) | `payment-declined` | wallet connect, review step |
| `/orders/ord_000001` | Ana | — | Bruno (403) | confirmation modal (desktop) |
| `/login`, `/signup` | guest | — | invalid submit | desktop auth modal over `/` |
| `/profile` | Ana | Carla (sparse) | invalid submit | avatar dialog, password form |
| `/wallets` | Ana | Carla (none) | `WALLET_DUPLICATE` | add/edit wallet dialog |
| not found | `/nao-existe` | — | — | — |
| any | — | — | — | header account menu, mock panel (`?mockPanel=1`) |

## 3. Keyboard paths (A11Y-04 – A11Y-08)

| Flow | Path proved with `tabTo` + keys | Focus checks |
|---|---|---|
| Catalog | skip link → search → type + `Enter` → filter group (checkboxes `Space`, slider arrows) → sort select → card link → pagination `Enter` | results update without moving focus; pagination keeps focus on the pagination control and announces the page |
| Details | gallery thumbnails (arrows or `Tab`) → edition chips (radio group, arrows) → quantity stepper → favorite → add to cart | sold-out chip is skipped or `aria-disabled` with reason; stepper limits announced |
| Cart | quantity stepper → remove (confirm dialog) → coupon field `Enter` → checkout link | after removal, focus moves to the next line's first control, or to the empty-state heading |
| Checkout | each field in visual order → wallet / network choice → review → confirm | invalid submit focuses the first invalid field (A11Y-08); revalidation dialog traps focus |
| Auth | modal tabs ("Entrar \| Criar conta") as a tablist → fields → password toggle → submit | out-of-scope social buttons are `aria-disabled` with "Disponível em breve" |
| Account | profile fields → avatar upload (file input reachable) → password form → wallet edit dialog | dialog return focus |

Fallback focus targets (A11Y-06): a removed cart line → next line or the cart `h1`; a modal replaced by navigation → the new page's `h1`; a dialog whose trigger was inside a list that refetched → the list's heading.

Route-change focus (A11Y-07): a small `useRouteFocus()` in `app/` subscribes to the router's `onResolved` event, skips the first load and same-path navigations, then focuses `main h1` (`tabIndex={-1}`, no visible ring on programmatic focus). Screen readers read the focused heading; whether they also read the new `document.title` varies, so the manual pass (open question 1) decides if the polite region announces the title too.

## 4. Overlays (A11Y-02, A11Y-06)

| Overlay | Owner | Primitive | Return focus |
|---|---|---|---|
| Login / sign-up modal (desktop) | 04 | `Dialog` | `Entrar` button |
| Header account menu | 04 | `DropdownMenu` | avatar button |
| Filter sheet (mobile) | 05 | `Sheet` (bottom) | "Filtros" button |
| Remove-item confirmation | 07 | `AlertDialog` | next line (§3) |
| Quote changed / re-confirm | 09 | `AlertDialog` | confirm button |
| Wallet connect progress | 09 | `Dialog`, non-dismissable while pending | wallet choice |
| Order confirmation (desktop) | 10 | `Dialog` | page `h1` |
| Add/edit wallet, avatar | 08 | `Dialog` | its trigger |
| Mock panel | 02 | `Sheet` | launcher |

Checks per overlay: focus moves in, `Tab`/`Shift+Tab` cycle inside, `Esc` closes (except the pending wallet dialog, which explains why), scrim click closes, title labels the dialog, background is `inert`.

## 5. Live feedback inventory (A11Y-09, A11Y-10)

One channel per event (spec 01 rule). Polite unless stated.

| Event | Owner | Channel | Message (pt-BR, final copy in owner spec) |
|---|---|---|---|
| Favorite added / removed | 06 | announce | "Adicionado aos favoritos" / "Removido dos favoritos" |
| Favorite rollback | 06 | toast (error) | "Não foi possível salvar o favorito" |
| Added to cart | 06 | toast | "Adicionado ao carrinho" + action "Ver carrinho" |
| Quantity changed / item removed | 07 | announce | "Quantidade atualizada: N" / "<nome> removido" |
| Coupon applied / rejected | 07 | inline field status / field error | — |
| Realtime price or availability change in cart | 07 | announce + inline badge | "O preço de <nome> mudou para X ETH" |
| Realtime change on details | 06 | announce | "Disponibilidade atualizada" |
| Order pending → confirmed / declined | 09 | announce (assertive for declined) | "Pagamento confirmado" / "Pagamento recusado" |
| Session expired | 04 | toast (error) | "Sua sessão expirou" |
| Socket disconnected / reconnected | 03 | announce, debounced | "Conexão em tempo real perdida" / "restabelecida" |
| Catalog results updated | 05 | announce | "N resultados" (only when the count changes) |

`liveMessages` asserts each row fires once per event, including when spec 03 delivers a duplicate event.

## 6. Semantics and images (A11Y-11 – A11Y-13)

- Headings: one `h1` per route; card names are `h3` under a section `h2`. A Playwright check walks `h1–h6` and fails on a skipped level.
- Images: the main artwork and hero use the fixture alt. Thumbnails that repeat the main image get `alt=""` inside a button named "Ver imagem N de M". Card images inside a card link use `alt=""` when the card link already has the NFT name, so the name is not read twice; this is a deliberate adjustment recorded in §9.
- Non-color cues to verify on real screens: sold-out chip (strikethrough + "Esgotado"), previous price (strikethrough + "Antes"), order status (icon + text), active filter (check + count), pagination current page (`aria-current` + fill).

## 7. Responsive rules (A11Y-15 – A11Y-17)

| Width | Shell (spec 01) | Catalog | Details | Cart / checkout | Account |
|---|---|---|---|---|---|
| 320–767 | mobile | 2-column grid, filter sheet | single column, fixed buy bar | single column, fixed summary | single column |
| 768–1023 | mobile | 3-column grid, filter sheet | 2 columns (gallery, info), buy bar inline | 2 columns from `md` if the summary fits ≥ 280 px, else single | 2-column form |
| ≥ 1024 | desktop | sidebar + grid (3 columns at 1440) | Figma desktop | Figma desktop | Figma desktop |

- Fixed bars reserve their height with bottom padding on `main`, plus `scroll-padding-bottom` equal to the bar height, so focused elements scroll into view above them.
- Zoom (A11Y-16): at 200 % of 1280 the viewport is 640 CSS px, inside the mobile composition; checks are overflow, no overlap of the fixed bars, and that the filter sheet and dialogs scroll internally.
- Text spacing: long pt-BR labels ("Igual à carteira principal", network names) wrap; no fixed heights on text containers.

## 8. E2E (`e2e/a11y.spec.ts`, both projects)

| Test | Proves |
|---|---|
| Matrix §2: axe per route × state, and per overlay | A11Y-01, A11Y-02 |
| Keyboard purchase: from `/` to a confirmed order using only keys (Ana, `default`, clock-controlled settlement) | A11Y-04, A11Y-05 |
| Each overlay in §4: focus in, cycle, `Esc`, return target | A11Y-06 |
| In-app navigation focuses the new `h1`; changing a filter does not move focus | A11Y-07 |
| Invalid sign-up, checkout and wallet forms: focus on first invalid field, `aria-describedby` resolves to the error text; API error (`EMAIL_TAKEN`) appears on the field | A11Y-08 |
| `liveMessages`: favorite, add to cart, quantity, realtime price change (via `__mock.updateNft`, twice with the same version) → one message each | A11Y-09 |
| Background refetch with unchanged data announces nothing | A11Y-10 |
| Heading walk and titles on every route | A11Y-11 |
| Every `img` has `alt`; repeated thumbnails are `alt=""` | A11Y-12 |
| Overflow at 320, 390, 768, 1024, 1440 on every route, overlays open and closed; `zoom(page, 2)`; `withTextSpacing` | A11Y-15, A11Y-16 |
| Mobile: tab to the last control of details, cart and checkout → `expectFocusVisible` passes above the fixed bar | A11Y-05, A11Y-17 |
| Reduced motion: hero carousel does not auto-advance after `clock.runFor(10_000)`; skeleton and highlight animations are `none` | A11Y-18 |

The contrast rule (A11Y-14) is covered by axe `color-contrast` on real screens; text over images is checked by sampling: a test screenshots the hero title box and computes the luminance range behind the text, failing if any sample pixel gives < 4.5 : 1 with the title color.

## 9. Audit log and deviations

`SPECS-NTFS/11-a11y-responsive/audit.md` (created by T01): one row per finding — route, viewport, rule or check, owner spec, fix, status. Fixes land in the owner feature's code; this spec never adds per-screen overrides.

Adjustments recorded for `ARCHITECTURE.md` (spec 14):

1. Focus moves to the page heading after in-app navigation.
2. Card images use empty alt inside named card links; thumbnails that repeat the main image use empty alt.
3. Tablet compositions in §7 (no Figma frame).
4. `scroll-padding` and bottom padding reserve space for fixed bars.
5. Any disabled axe rule (A11Y-03), with its reason.
