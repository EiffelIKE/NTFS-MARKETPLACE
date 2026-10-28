# 12 — Visual regression · Requirements

> Status: Draft — see [Open questions](#open-questions). Screen states are confirmed when specs 05–09 are Done.

Add Playwright screenshot baselines for the four screens the brief names — home, NFT details, cart and checkout — in the desktop and mobile projects, with data, clock, fonts and animation frozen so a diff means the UI changed. Baselines are version-controlled and generated in a fixed Linux image, so they match between the developer machine and CI.

Brief coverage: §9 (visual regression for home, details, cart and checkout, version-controlled baselines, stable data, isolated state, clock control, HTML report).

## User stories

- **US-1** — As a developer, I find out in the test run when a change alters how a main screen looks, with an image diff in the HTML report.
- **US-2** — As an evaluator, I can run the visual suite on a clean checkout and get the same pixels as the committed baselines.
- **US-3** — As a developer who changed a screen on purpose, I regenerate the baselines with one command and review the diff before committing.

## Acceptance criteria

### Coverage

- **VR-01** — THE SYSTEM SHALL keep baselines for home (`/`), NFT details (`/nfts/emerald-ape-042`), cart (`/cart`, signed in as Ana) and checkout (`/checkout`, signed in as Ana, first step), each in the desktop (1440 × 900) and mobile (390 × 844) Playwright projects.
- **VR-02** — THE SYSTEM SHALL capture each screen as a full-page screenshot, plus a viewport screenshot for mobile, so the fixed bottom bars are verified in place.
- **VR-03** — THE SYSTEM SHALL capture the loading-skeleton state of home and details, so layout-shift regressions in skeletons are visible. *(Open question 2.)*

### Determinism

- **VR-04** — WHEN a visual test starts, THE SYSTEM SHALL reset the mock database to the `default` scenario through `window.__mock` and use only spec 02 anchor data.
- **VR-05** — THE SYSTEM SHALL install Playwright's clock at a fixed instant before navigation, so dates, relative times, carousels and settlement timers render the same way on every run.
- **VR-06** — WHEN a screenshot is taken, THE SYSTEM SHALL have finished loading: no element with `aria-busy="true"`, `document.fonts.ready` resolved, every `img` (including lazy ones) loaded and decoded, and no pending API request in the mock request log.
- **VR-07** — THE SYSTEM SHALL disable CSS animations and transitions, hide the text caret, and hide scrollbars during capture.
- **VR-08** — WHEN a region cannot be made deterministic, THE SYSTEM SHALL mask it, and SHALL list every mask with its reason in design §4. Masking SHALL NOT be used for content that the clock or fixtures can fix.

### Environment and workflow

- **VR-09** — THE SYSTEM SHALL generate and compare baselines inside a pinned Playwright container image matching the installed `@playwright/test` version, so font rasterization does not depend on the host OS.
- **VR-10** — THE SYSTEM SHALL store baselines under `e2e/__screenshots__/` with names that identify the screen, state and project, and SHALL commit them with the code.
- **VR-11** — THE SYSTEM SHALL compare with an explicit tolerance (design §5) and SHALL show expected, actual and diff images in the HTML report on failure.
- **VR-12** — THE SYSTEM SHALL provide `test:visual` (compare) and `test:visual:update` (regenerate) scripts, and the default `test:e2e` run SHALL skip visual tests outside the container, so host runs do not fail on rasterization differences.

## Out of scope

- Figma fidelity itself: owner specs compare each screen against the Figma screenshots by eye; this spec only detects changes after that.
- Screens not named by the brief (login, profile, wallets, confirmation) and tablet width. Spec 11 covers their layout with functional checks.
- Cross-browser baselines (Chromium only, as the brief asks).
- A CI pipeline: not set up until the user asks (spec 00). The scripts are CI-ready.

## Open questions

Each has a recommended default that applies unless the user decides otherwise.

1. **Container runtime** — recommended: the scripts call `podman` when present and `docker` otherwise (Fedora ships Podman). Alternative: Docker only.
2. **Skeleton baselines (VR-03)** — recommended: yes, for home and details, desktop and mobile (4 more images). They catch layout shift between skeleton and content. Alternative: only the four required screens.
3. **Checkout state** — recommended: the first step with Ana's prefilled data and primary wallet selected, before connecting. Alternative: the review step as well (one more image per project).
4. **Tolerance** — recommended: `maxDiffPixelRatio: 0.001` with the default per-pixel `threshold: 0.2`, tightened once baselines prove stable in a few runs.
