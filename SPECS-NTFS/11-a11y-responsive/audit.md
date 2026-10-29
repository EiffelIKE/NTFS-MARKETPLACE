# 11 — Audit log (2026-10-28)

One row per finding. "Owner" is the spec whose code was fixed. Viewports: M = 390, T = 768, D = 1440 unless stated. Status: Fixed (with the proof), Documented (why it stays), Pending.

## Findings and fixes

| # | Where | Check | Owner | Finding | Fix | Status |
|---|---|---|---|---|---|---|
| 1 | Details heart, fresh load | A11Y-10 | 06 | The heart showed "not favorited" until the favorites list arrived, so a click asked for "add" on an NFT that was already a favorite | `useFavoriteState`: `aria-disabled` + `aria-busy` until known; a failed read is retried by the click (`favorite-button.tsx`, `use-is-favorite.ts`) | Fixed: 2 rows in `favorites.spec.ts` |
| 2 | Profile, M | A11Y-05, A11Y-17 | 08 | The toast sat at `134 px` above the bottom, over "Salvar", beside the tab bar | Toasts top-center below `lg` (`ui/sonner.tsx`) | Fixed: checked in the browser; the top toast leaves "Salvar" free |
| 3 | Details, cart, checkout, receipt, M/T | A11Y-17 | 06, 07, 09, 10 | Bottom padding was a constant on details (11.5 rem) and the receipt (8.5 rem); no screen scrolled focused controls clear of its bar | `useBottomBarInset` publishes each bar's height; pages pad with it; `html { scroll-padding-bottom }` | Fixed: `focus stays visible and uncovered…`, `tablet at 768 px` |
| 4 | Home, D at 1024–1180 | A11Y-15 | 05 | Sideways scroll: tabs and sort select did not wrap, hero art kept its 450 px (document 1142 wide at 1024) | Header row wraps; hero text and art shrink (`catalog-section.tsx`, `hero-carousel.tsx`) | Fixed: overflow matrix at 1024 and 1180 |
| 5 | Home hero, M at 390 / 360 / 320 | A11Y-16, A11Y-14 | 05 | The fixed 190 px card cut off the eyebrow and "EXPLORAR": Figma's frame is 414 wide, phones are narrower | `min-h-49.5` (skeleton 198 px, 245 px under 380 px, to keep CAT-14's no-shift row), art `clamp(5rem, 33vw, 8.625rem)`, thumbnail hidden under 400 px | Fixed: `contrast over artwork` samples the whole card; screenshots at 414 / 390 / 360 / 320 |
| 6 | Header account menu, D | A11Y-02 | 04 | axe `aria-hidden-focus`: a modal menu hides a page that stays focusable | `DropdownMenu modal={false}` | Fixed: `overlays` |
| 7 | Search dialog, D and M | A11Y-06 | 05 | Esc left focus on `body`: the dialog has no Radix trigger to return to | The dialog remembers its opener | Fixed: `overlays` |
| 8 | Details error state | A11Y-11 | 06 | No document title (the default one stayed) and an `h1` that said only "NFT" | `<title>NFT indisponível · KURIO</title>` and a clearer `h1` (`details-error.tsx`); `loading-states.spec.ts` now expects "NFT indisponível" (the h1 text changed, the assertion is not loosened) | Fixed: `semantics, titles and images` |
| 9 | In-app navigation, all | A11Y-07 | 01 (shell) | Focus stayed on the clicked link or on `body` after a route change | `useRouteFocus()` | Fixed: `in-app navigation moves focus…` |
| 10 | Cart merge toast | flake, WCAG 2.2.1 | 07 | A multi-line report lasted the default few seconds | `duration: 12_000` (`merge-guest-cart.ts`) | Fixed |
| 11 | `cart.spec.ts` merge row, M | flake | test | Waited for the cart before the toast | Toast first | Fixed |
| 12 | `favorites.spec.ts` expiry row, D | flake | test | Expired the sessions with reads in flight | Wait for the live heart and the socket | Fixed |
| 13 | `purchase.spec.ts` quote total | flake | test | The patch waited for an attribute that goes away when the fade starts | `expectSettledOpacity` inside `expectNoAxeViolations` | Fixed |
| 14 | `favorites.spec.ts` "three rapid clicks" | flake | 06 | 4 of 50 runs before and 1 of 240 after, only under 12 workers: the server saw `add`, `remove`, never the third | Not found | Documented, reported |
| 15 | Screen-reader wording | A11Y-09 | all | Not testable by automation | Orca smoke pass over the purchase flow | Pending: no interactive session |

## Reviewed, no change

| Check | Result |
|---|---|
| axe, WCAG 2.0 / 2.1 / 2.2 A + AA, every route and state (22 cells) | 0 serious or critical; no rule disabled |
| Overflow at 320 / 390 / 768 / 1024 / 1180 / 1440 (22 cells) | none after #4 |
| 200 % (640 px) and 400 % (320 × 200) zoom, text spacing at 390 and 1280 (22 cells) | no overflow, no clipped text |
| Heading order, one `h1`, titles, landmark names | clean on every cell |
| Image alt rules on home, details, cart | clean |
| Contrast over artwork: hero, promos, featured banner, blog cards | at least AA over every sampled pixel after #5 |
| Reduced motion: skeleton, spinner, overlay, carousel | static |
| Tablet at 768 | mobile composition, 3 columns, centered 600 px column; no stretched phone layout and no squeezed desktop; viewed in the browser for home, details and cart |

## Non-color cues reviewed (A11Y-13)

| Screen | State | Cue besides color |
|---|---|---|
| Home | current page | `aria-current="page"` and a filled box |
| Home | active segment | `aria-selected` and an underline |
| Home | active filter | a check mark and the count in bold |
| Home, details | previous price | strikethrough, hidden label "Preço anterior:" |
| Details | selected edition | `aria-checked`, a border |
| Details | sold-out edition | strikethrough, "esgotada" in its name, disabled |
| Details | favorite | `aria-pressed`, filled heart, label "Favoritado" (desktop) |
| Cart | line notice | text with the NFT name (and an announcement) |
| Cart, checkout | outdated figure | `aria-busy` while dimmed; text notes after a change |
| Forms | invalid field | message, `aria-invalid`, focus on the first |
| Receipt, checkout | order status | text, icon |
| Toasts | kind | icon and text |

## Pending

- Manual Orca smoke pass over the purchase flow (requirements, decision 1).
