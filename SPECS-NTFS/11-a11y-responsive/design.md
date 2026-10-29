# 11 — Accessibility & responsiveness · Design

> Status: Done (2026-10-28). The inventories in §2–§5 were written against specs 04–10 as shipped; §10 records what the audit found and changed, §11 the decisions.

Implements [`requirements.md`](requirements.md). No new dependencies: axe comes from `@axe-core/playwright` (spec 01), state control from `window.__mock` (spec 02). Visual inputs: `figma_tokens/screenshots/` for the screens that have a frame, and the running app at 390 / 768 / 1440 through the Chrome DevTools MCP for the tablet and zoom judgments in §7.

This spec changes code only where the audit found a defect, in the owner feature's files; it adds no per-screen overrides. Findings and fixes are logged in [`audit.md`](audit.md).

## 1. Test support (`e2e/support/a11y.ts`)

Extends the spec 01 helpers (`expectNoAxeViolations`, `expectNoHorizontalOverflow`):

| Helper | Does |
|---|---|
| `tabTo(page, name, { max, visible })` | Presses `Tab` until the focused element's `role "name"` (from `ariaSnapshot`) matches, failing after `max` presses with the stops it saw; returns the press count. With `visible`, every stop passes `expectFocusVisible` |
| `tabThrough(page, count)` | `count` presses of `Tab`, each stop checked with `expectFocusVisible` (used to walk whole pages with fixed bars) |
| `expectFocusVisible(page)` | The focused element has an outline of at least 2 px (on the element, its input group, or its label for visually hidden native controls) and the hit test at the centre of that box returns it or a descendant, so no fixed bar covers it |
| `expectFocusTrapped(page, container)` | 14 presses of `Tab` / `Shift+Tab`; focus is inside `container` after each |
| `recordLiveMessages(page)` + `liveMessages(page)` | An init-script `MutationObserver` that records each text that appears in a live region (`aria-live`, `status`, `alert`) and each toast as it is added, so a test asserts "announced once" on what a screen reader receives |
| `expectInvalidFieldsDescribed(scope)` | Every `[aria-invalid=true]` in `scope` has an `aria-describedby` that resolves to non-empty text; returns how many there were |
| `expectNoClippedText(page)` | No visible text container that clips its overflow (`hidden`/`clip`) cuts its own text (`sr-only` and ellipsis names excluded) |
| `withTextSpacing(page)` | The WCAG 1.4.12 stylesheet (line-height 1.5, letter-spacing 0.12 em, word-spacing 0.16 em, paragraph spacing 2 em) |
| `zoomTo(page, factor)` | Viewport of `1280 / factor` CSS px: Chromium's layout at browser zoom (200 % = 640 px, 400 % = the 320 px reflow of WCAG 1.4.10, which is also a 200 px tall window) |
| `expectReadableOverArtwork(page, scope)` | For every text element in `scope`: hides the text, screenshots its box and compares each pixel behind it with the text color at the AA ratio for its size (4.5, or 3 for large text) |
| `expectSettledOpacity(page)` | Polls until no `transition-opacity` element is mid-fade (`0 < opacity < 1`); `expectNoAxeViolations` calls it first (design §10, flake 3) |

## 2. Route × state matrix (A11Y-01, A11Y-15, A11Y-16)

`e2e/a11y.spec.ts` runs one table, `SCREENS`, through four groups: axe (A11Y-01), overflow at 320 / 390 / 768 / 1024 / 1180 / 1440 (A11Y-15), heading / title / landmark rules (A11Y-11) and 200 % / 400 % zoom plus text spacing (A11Y-16). Private routes sign in as Ana, Bruno or Carla through `loginAs`; a scenario is applied on a bare page first, because switching it drops the sessions.

| Route | Loaded | Empty / sparse | Error |
|---|---|---|---|
| `/` | default | `empty` scenario | `server-down` |
| `/?favorites=1` | Ana | Bruno (none) | — |
| `/nfts/$nftId` | `emerald-ape-042`; `obsidian-mask-007` (every edition sold out) | — | `server-down`; `/nfts/nao-existe` (404) |
| `/cart` | Ana | `empty` scenario | `server-down` |
| `/checkout` | Ana | — (an empty cart redirects, spec 09) | declined payment: spec 09 suites |
| `/orders/$orderId` | `ord_000001` (Ana) | — | Bruno on Ana's order |
| `/login`, `/signup` | guest | — | invalid submit (§8, forms) |
| `/profile` | Ana | Carla (sparse) | invalid submit (§8, forms) |
| `/wallets` | Ana | Carla (none) | invalid submit (§8, forms) |
| not found | `/nao-existe` | — | — |

`/dev/ui-kit` and `/dev/realtime` are developer routes, covered by spec 01 and spec 03. A route that renders no `h1` in a state fails the matrix before axe runs, which is how the details error state's missing title was found.

## 3. Keyboard paths (A11Y-04 – A11Y-08)

| Flow | Path proved | Focus checks |
|---|---|---|
| Purchase | catalog card link → details → "COMPRAR" / "Comprar NFT" → cart → "Conectar e finalizar" → checkout → "Confirmar compra" → review → "Conectar …" → "Confirmar pagamento" → receipt, by `tabTo` and `Enter` only, both projects | every stop has the indicator and is uncovered; each arrival focuses its `h1`; the receipt heading ends focused |
| Sign in | direct visit to `/profile` → login → e-mail, senha, `Enter` | lands on the profile `h1` |
| Catalog filters | the filter checkbox (desktop sidebar, or the mobile sheet opened with `Enter`) → `Space` | the URL changes and focus stays on the checkbox; a search-param change never moves focus |
| Fixed bars (mobile) | 45 presses of `Tab` through details, cart, checkout, receipt and profile | no stop is covered by the bar or the tab bar |

Route focus (A11Y-07): `useRouteFocus()` (`app/use-route-focus.ts`, mounted in `AppShell`) subscribes to the router's `onRendered` event. It acts only when the path changed and there is a previous location, waits up to 90 frames for `main h1`, sets `tabIndex = -1` when the page did not, and focuses it with `preventScroll` (scroll restoration stays the router's). It leaves focus alone when something other than the header, a nav or `body` already holds it: the cart heading, the receipt heading, a dialog that opened. Whether a screen reader also reads the new `document.title` varies, which is what the deferred manual pass would settle.

## 4. Overlays (A11Y-02, A11Y-06)

Every `Dialog`, `Sheet` and `DropdownMenu` in `src/` (grep: `search-dialog`, `filters-sheet`, `zoom-dialog`, `review-dialog`, `wallet-picker`, `user-menu`, `mock-panel`):

| Overlay | Owner | Primitive | Return focus |
|---|---|---|---|
| Header account menu (desktop) | 04 | `DropdownMenu`, non-modal (§11) | avatar button |
| Search dialog | 05 | `Dialog` | the opener, remembered by the dialog (it has no Radix trigger); after a submit, the catalog heading |
| Mobile filter sheet | 05 | `Sheet` | "Filtros" button |
| Image zoom | 06 | `Dialog` | "Ampliar imagem" |
| Checkout review | 09 | `Dialog`; the wallet connection runs inside it | "Confirmar compra" (`onCloseAutoFocus`) |
| Mock panel | 02 | `Sheet` as a dialog | launcher |

`wallet-picker.tsx` only uses the dialog primitives' names for its own cards, not an overlay of its own. Login, sign-up and the receipt are pages (specs 04 and 10), so there is no desktop auth modal and no confirmation modal to return from, and the cart's remove action has no confirmation dialog (it announces and moves focus, spec 07).

Checks per overlay (`overlays` in the spec): focus is inside after opening, `Tab` and `Shift+Tab` cycle inside, axe passes with it open, `Esc` closes, and focus is on the return target. Scrim click and the pending-wallet rule are covered by specs 05 and 09.

## 5. Live feedback inventory (A11Y-09, A11Y-10)

One channel per event (spec 01 rule). What the shipped specs do, and what `live feedback` asserts:

| Event | Owner | Channel | Asserted |
|---|---|---|---|
| Added to cart | 06 / 07 | toast "Adicionado ao carrinho" + "Ver carrinho" | once |
| Favorite toggled | 06 | state of the button (`aria-pressed`); no message | — |
| Favorite refused | 06 | toast "Não foi possível atualizar seus favoritos." | once, and the heart returns |
| Cart line removed | 07 | polite "<nome> removido do carrinho" | once |
| Quantity changed | 07 | the stepper's `output` is a live region | spec 07 suite |
| Coupon applied / removed | 07 | polite "Cupom … aplicado / removido"; refusal in the field | spec 07 suite |
| Realtime price or availability in the cart | 07 | polite, one message per cart | once; a redelivered event adds nothing |
| Cart changed by a merge at sign-in | 07 | toast with the list of changes, 12 s | spec 07 suite |
| Catalog count | 05 | polite "N NFTs encontrados" | none on first load, one per change |
| Payment declined | 09 | assertive "Pagamento recusado. …" | once, in the `alert` region |
| Payment processing / wallet connected | 09 | polite | spec 09 suites |
| Session expired / other tab | 04 | toast | spec 04 suites |
| Background refetch with the same data | — | nothing | a reconnection reconciliation changes no live text |
| Socket connected / lost | 03 | no product UI shows the connection, so nothing is announced | — |

The draft's "Realtime change on details → announce" and "favorite added / removed → announce" rows were not built by their specs and are not required: the details screen shows availability in the page, and the pressed state of the heart is the feedback a screen reader reads on the control that was used.

## 6. Semantics and images (A11Y-11 – A11Y-13)

- Headings: one visible `h1`, no skipped level, a title ending in " · KURIO" (the home page carries the site title, `KURIO — Marketplace de NFTs`), on every cell of §2. The test walks `h1–h6` with `checkVisibility()`.
- Landmarks: one `main`; a landmark role that appears more than once is named, and names are not repeated.
- Images: every visible `img` has an `alt` attribute; an image inside a link or button whose own label already contains the alt text must have `alt=""`, so the name is not read twice. The test runs over home, details and cart.
- Non-color cues, reviewed on the real screens (rows in `audit.md`): the current page (`aria-current` + fill), the active segment (`aria-selected` + underline), the selected edition (`aria-checked` + border), a sold-out edition (strikethrough + "esgotada" in its name, disabled), the previous price (strikethrough, with a hidden "Preço anterior:"), the order status (text + icon), invalid fields (message + `aria-invalid`), the active filter (check mark + count).

## 7. Responsive rules (A11Y-15 – A11Y-17)

| Width | Shell (spec 01) | Catalog | Details / cart / checkout / receipt | Account |
|---|---|---|---|---|
| 320–767 | mobile | 2-column grid, filter sheet | single column, fixed bar | single column |
| 768–1023 | mobile | 3-column grid, filter sheet | the same single column, centered at 600 px, fixed bar | the same, centered |
| ≥ 1024 | desktop | sidebar + grid | Figma desktop | Figma desktop |

Fixed bars (tab bar, details buy bar, cart summary sheet, checkout action bar, receipt action) use `useBottomBarInset(ref)` (`hooks/use-bottom-bar-inset.ts`): it publishes the bar's height as `--bottom-bar-inset` on `<html>` (0 when the bar is static, which short viewports make it). Pages pad their bottom with `var(--bottom-bar-inset, <fallback>)`, and `base.css` sets `html { scroll-padding-bottom: var(--bottom-bar-inset, 0px) }`, so content ends above the bar and a control focused with the keyboard scrolls into view above it. The fallbacks equal the old constants, so the first paint is unchanged.

Toasts: below `lg` they sit at the top center (`12px + safe area`); from `lg` bottom-right, 24 px. The bottom of a phone screen belongs to the bars, and a toast there covered "Salvar" of the profile for as long as it lasted (§10, issue 2).

Zoom (A11Y-16): 200 % of 1280 is a 640 px layout, inside the mobile composition; 400 % is 320 × 200, where the bars turn static. The matrix checks overflow in both, and text spacing at 390 and 1280 (overflow and clipped text).

## 8. E2E (`e2e/a11y.spec.ts`, both projects; 238 runs)

| Group | Proves |
|---|---|
| axe on every route and state | A11Y-01 |
| no overflow on every route and state | A11Y-15 |
| overlays | A11Y-02, A11Y-06 |
| keyboard paths and route focus | A11Y-04, A11Y-05, A11Y-07 |
| forms | A11Y-08 (sign-up empty and `EMAIL_TAKEN`, login refusal, profile, wallets, checkout) |
| live feedback | A11Y-09, A11Y-10 |
| semantics, titles and images; states without color alone | A11Y-11, A11Y-12, A11Y-13 |
| zoom and text spacing on every route | A11Y-16 |
| tablet at 768 px | A11Y-17 |
| reduced motion | A11Y-18: no running animation of an infinite or long kind with skeletons, a spinner and an overlay on screen; the hero does not advance by itself |
| contrast over artwork | A11Y-14 (hero, promos, featured banner, blog cards) |

Added to earlier suites: `favorites.spec.ts` (the heart before the list is known, a list that failed) and the stabilized `cart.spec.ts`, `favorites.spec.ts` and `purchase.spec.ts` rows of §10.

No axe rule is disabled anywhere (A11Y-03): every scan runs the full WCAG 2.0/2.1/2.2 A and AA tag set and fails on serious or critical results.

## 9. Audit log and deviations

[`audit.md`](audit.md) has one row per finding: where, rule or check, owner spec, fix, status. Adjustments for `ARCHITECTURE.md` (spec 14):

1. Focus moves to the page heading after an in-app navigation to another path.
2. The header account menu is non-modal.
3. Toasts are top-center on phones (amends spec 01 design §11, item 19).
4. The hero card on mobile has a minimum height of 190, not a fixed one, and its overlapping thumbnail is hidden under 400 px; on desktop at 1024–1279 the hero art shrinks instead of overflowing.
5. Fixed bars publish their height; pages and `scroll-padding-bottom` read it.
6. Tablet composition: the mobile composition, centered at 600 px, with the 3-column grid.
7. Interactive heart: inert (`aria-disabled`, `aria-busy`) until the favorites list is known.
8. The cart-merge report toast lasts 12 s.
9. No axe rule disabled.

## 10. Issues handed over by earlier specs

1. **Heart before the list loads (spec 06).** `useIsFavorite` became `useFavoriteState` (`pressed`, `known`, `loading`, `retry`). While the list is unknown the button is `aria-disabled` and `aria-busy` and a click does nothing; if the read failed, the click asks for the list again. A guest is known (nothing to load) and still goes to login. `Button` now lets a caller's `aria-busy` through. Proof: two rows in `favorites.spec.ts`.
2. **Fixed bars and toasts on phones (spec 08).** The toast moved to the top (§7). Each bar now measures itself, which also fixed constants that were guesses: the details page and the receipt reserved 11.5 rem and 8.5 rem, the cart and checkout measured themselves. Checked: the profile's "Salvar" ends at the tab bar's top edge with the toast shown above it; every fixed-bar page passes the 45-stop focus walk; at 768 px the last content of details, cart and checkout ends above the bar.
3. **Flakes.**
   - `cart.spec.ts`, "a line above the limit after the merge is capped and reported in one toast" (mobile, once in a full run): a test that waited wrongly. The merge ends and shows its toast, which lasts about 4 s, but the test first waited for the cart to paint, so under load the toast could be gone. The test now checks the toast first, and the report toast lasts 12 s, which is also the right time to read a list of changes (WCAG 2.2.1).
   - `favorites.spec.ts`, "an expired session rolls back…" (desktop, once): the test clicked the heart straight after the `h1` appeared, then expired the sessions while the favorites list and the socket handshake were still in flight; a read that meets the 401 ends the session by itself, before the toggle (the pattern spec 08 found). It now waits for the heart to be live (the list is known) and for the socket first.
   - `purchase.spec.ts`, axe on `quote-total` (spec 10's patch): not sound. The patch waited for `data-outdated` to go away, but the attribute goes away when the fade back to full opacity starts, and axe reads the computed opacity. `expectNoAxeViolations` now waits until no `transition-opacity` element is mid-fade, which covers every scan of a dimmable figure in every spec.
   - Residual, not on the list: `favorites.spec.ts`, "three rapid clicks end on…" failed 4 of 50 runs on the code before this spec and 1 of 240 after it, only under 12 parallel workers. In the failing run the server saw `add` then `remove` and no third request. Not reproduced under a debugger; left as is and reported.
4. **200 % zoom (spec 07 and the rest).** Run on every cell of §2. It found nothing at 200 % or 400 % beyond what the overflow sweep found at 1024 and the hero at 390 (below).

Found by the new matrix: the desktop composition overflowed sideways between 1024 and about 1200 px (the segment tabs and sort select did not wrap, and the hero art kept its 450 px); the mobile hero cut off its eyebrow and the "EXPLORAR" link at 390, 360 and 320 px because the Figma frame is 414 wide; the header account menu failed `aria-hidden-focus`; the search dialog lost focus on close; the details error state had no document title.

## 11. Decisions taken while implementing

1. Route focus is one hook in the shell, not a per-page responsibility (§3).
2. The account menu is `modal={false}`. A modal Radix menu hides the page with `aria-hidden` while the page stays focusable, which axe reports (`aria-hidden-focus`); a menu does not need a trap, and `Tab` closing it is the usual behavior.
3. The search dialog remembers its opener, because it is opened from two places outside it and has no `DialogTrigger`.
4. Toasts go to the top on phones (§7). The alternative, raising the toast above each screen's bar, still covers the last control of a screen that ends at the bar.
5. The hero thumbnail is hidden under 400 px and the main art is `clamp(5rem, 33vw, 8.625rem)`: both are decoration, and the copy and the link matter more than a 14 px overlap of the art.
6. The heart stays focusable while unknown (`aria-disabled`, not `disabled`), so a keyboard user does not lose their place when the list arrives.
7. The fade check is in `expectNoAxeViolations`, not in each test.
8. The manual screen-reader pass is deferred (requirements, decision 1).
9. The text-clipping check ignores `sr-only` and ellipsis names, which clip by design.
