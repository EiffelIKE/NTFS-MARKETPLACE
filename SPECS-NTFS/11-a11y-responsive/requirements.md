# 11 — Accessibility & responsiveness · Requirements

> Status: Draft — see [Open questions](#open-questions). It audits screens that specs 04–10 build, so its inventories are refined when those specs are Done.

Verify and harden accessibility and responsive behavior across every screen once specs 04–10 have landed. This is an audit pass, not the first time accessibility is considered: spec 01 provides the primitives (focus ring, field errors, dialog focus, announcer, skeleton semantics, overflow helpers, axe helper), and each screen spec builds its own states with them. This spec runs one consistent matrix over all routes, viewports and overlays, fixes what fails in the owner feature's code, and records accessibility adjustments relative to Figma.

Brief coverage: §8 (keyboard and visible focus, dialog/drawer focus, semantics and field errors, text alternatives, contrast and non-color states, accessible feedback for mutations and realtime changes, no overflow or content loss on zoom, 390 / 768 / 1440), §9 scenario 11 (keyboard navigation, dialog focus, form validation), §10 (Lighthouse accessibility ≥ 95, measured in spec 13).

## User stories

- **US-1** — As a keyboard user, I can complete every flow (browse, filter, open details, favorite, add to cart, check out, sign in, edit my profile and wallets) without a mouse, always seeing where focus is.
- **US-2** — As a screen-reader user, I hear what changed after each action and when a price, availability or order status changes in real time.
- **US-3** — As a user who zooms to 200 % or reads on a 320 px wide window, nothing is cut off and I never need to scroll sideways to read a line.
- **US-4** — As a tablet user at 768 px, the layout is deliberate (no stretched phone layout, no squeezed desktop).
- **US-5** — As an evaluator, I can run one command that proves these properties on every screen in both Playwright projects.

## Acceptance criteria

### Automated scan

- **A11Y-01** — THE SYSTEM SHALL run axe (WCAG 2.2 A/AA tags, spec 01 helper) on every route in design §2, in both Playwright projects, in its loaded, empty and error states where the route has them, and SHALL report zero serious or critical violations.
- **A11Y-02** — THE SYSTEM SHALL run the same scan with each overlay open: login/sign-up modal (desktop), mobile filter sheet, order confirmation modal, header account menu, mock panel, and every confirmation dialog the screen specs add.
- **A11Y-03** — WHEN an axe rule is disabled for a scan, THE SYSTEM SHALL name the rule, the element and the reason in design §9 and in `ARCHITECTURE.md`; a blanket rule exclusion SHALL NOT be used.

### Keyboard and focus

- **A11Y-04** — THE SYSTEM SHALL let each flow in design §3 be completed with the keyboard alone, in a focus order that follows the visual order, with no keyboard trap outside open dialogs.
- **A11Y-05** — WHEN any interactive element receives keyboard focus, THE SYSTEM SHALL show the spec 01 focus indicator, and the element SHALL not be hidden behind the sticky header, the tab bar or a fixed bottom bar (WCAG 2.4.11).
- **A11Y-06** — WHEN a dialog, sheet or menu opens, THE SYSTEM SHALL move focus inside, trap it, close on `Esc`, and return focus to the trigger — or, when the trigger no longer exists (item removed, modal replaced by a route), to a documented fallback target in design §4.
- **A11Y-07** — WHEN a route changes through in-app navigation, THE SYSTEM SHALL move focus to the new page's `h1` (or `main`) and announce the new document title, so screen-reader users notice the change. Search-param-only changes on the same route (filters, sort, page) SHALL NOT move focus.
- **A11Y-08** — WHEN a form submit fails validation or the API returns field errors, THE SYSTEM SHALL focus the first invalid field, and each error SHALL be programmatically associated with its field; a form-level error SHALL be announced assertively.

### Live feedback

- **A11Y-09** — THE SYSTEM SHALL announce every mutation outcome and realtime change listed in design §5 exactly once, through the spec 01 channel assigned there (toast or polite/assertive region), and SHALL never announce the same event twice.
- **A11Y-10** — WHILE a region is loading or refetching in the background, THE SYSTEM SHALL expose its busy state without moving focus, and SHALL not announce background refetches that change nothing.

### Semantics and content

- **A11Y-11** — THE SYSTEM SHALL give every page exactly one `h1`, a heading order without skipped levels, unique landmark labels, and a document title in the pattern `"<screen> · KURIO"`.
- **A11Y-12** — THE SYSTEM SHALL give each NFT image the fixture alt text, mark decorative images and repeated thumbnails appropriately (design §6), and give every icon-only control a pt-BR name.
- **A11Y-13** — THE SYSTEM SHALL convey every state (selected edition, sold out, price drop, order status, invalid field, active filter, current page) by text or shape in addition to color.
- **A11Y-14** — THE SYSTEM SHALL meet WCAG 2.2 AA contrast for text and state-bearing UI on the real screens, including text over artwork or gradients (hero, promo cards), not only on the token pairs that spec 01 tests.

### Responsive and zoom

- **A11Y-15** — THE SYSTEM SHALL show no unintended horizontal overflow and no clipped content on every route at 320, 390, 768, 1024 and 1440 CSS px wide, with overlays both closed and open.
- **A11Y-16** — WHEN the page is zoomed to 200 % at 1280 px, or text spacing is increased per WCAG 1.4.12, THE SYSTEM SHALL keep all content and functionality available without overlapping text.
- **A11Y-17** — THE SYSTEM SHALL lay out each screen at 768 px per the tablet rules in design §7, and fixed bottom bars (tab bar, details buy bar, cart summary, checkout confirm) SHALL never cover the last content or the focused element.
- **A11Y-18** — WHEN the user prefers reduced motion, THE SYSTEM SHALL keep carousels, skeletons, sheet/dialog transitions and realtime highlight effects static on every screen.

### Verification

- **A11Y-19** — THE SYSTEM SHALL include `e2e/a11y.spec.ts` (brief §9 scenario 11) covering design §8 in both Playwright projects, and an audit log (`audit.md` in this folder) listing each finding, its owner spec and its fix.

## Out of scope

- Building the primitives (focus ring, field components, announcer, dialog focus): spec 01. Each screen's own states: specs 04–10.
- Lighthouse accessibility score: measured in spec 13; this spec makes it reachable.
- Windows forced-colors mode, RTL and languages other than pt-BR.
- Formal WCAG conformance claim or third-party audit.

## Open questions

Each has a recommended default that applies unless the user decides otherwise.

1. **Manual screen-reader pass** — recommended: one documented smoke pass with Orca on Linux (Chromium) over the purchase flow, results in `audit.md`. Automated tests cannot prove announcement wording. Alternative: automated checks only.
2. **Target size on mobile** — recommended: WCAG 2.5.8 minimum (24 × 24), as spec 01 set, keeping Figma sizes where they are larger. Alternative: 44 × 44 for every mobile control, which changes several Figma proportions (chips, stepper).
3. **Route-change focus (A11Y-07)** — recommended: focus the `h1` (with `tabIndex={-1}`) after in-app navigation. Alternative: focus `main`, which announces less context.
4. **Desktop auth modal** — depends on spec 04's decision on modal vs. `/login` routes. Recommended default: the modal is a `Dialog` with its own URL state, so its focus return target is the `Entrar` button, and the full page is the target after a direct load.
5. **Tablet composition (design §7)** — recommended as written (mobile shell, 3-column grid, 2-column details from 768). Needs confirmation once specs 05–09 show how their layouts behave at 768.
