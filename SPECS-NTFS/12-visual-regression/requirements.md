# 12 — Visual regression · Requirements

> Status: Done. The draft's container approach was replaced by host baselines (see design §0).

Add Playwright screenshot baselines for the four screens the brief names — home, NFT details, cart and checkout — in the desktop and mobile projects, with data, clock, fonts and animation frozen so a diff means the UI changed. Baselines are version-controlled and tagged with the platform that rendered them.

Brief coverage: §9 (visual regression for home, details, cart and checkout, version-controlled baselines, stable data, isolated state, clock control, HTML report and traces).

## User stories

- **US-1** — As a developer, I find out in the test run when a change alters how a main screen looks, with an image diff in the HTML report.
- **US-2** — As an evaluator, I can run the visual suite on a clean Linux checkout and get the same pixels as the committed baselines.
- **US-3** — As a developer who changed a screen on purpose, I regenerate the baselines with one command and review the diff before committing.

## Acceptance criteria

### Coverage

- **VR-01** — THE SYSTEM SHALL keep baselines for home (`/`), NFT details (`/nfts/emerald-ape-042`), cart (`/cart`, signed in as Ana) and checkout (`/checkout`, signed in as Ana, first step), each in the desktop (1440 × 900) and mobile (390 × 844) Playwright projects.
- **VR-02** — THE SYSTEM SHALL capture each screen as a full-page screenshot, plus a viewport screenshot for mobile home and details, so their fixed bottom bars are verified in place. Cart and checkout fit one mobile viewport, so their full-page capture already is the viewport one.
- **VR-03** — THE SYSTEM SHALL capture the loading-skeleton state of home and details, so layout-shift regressions in skeletons are visible.

### Determinism

- **VR-04** — WHEN a visual test starts, THE SYSTEM SHALL start from an isolated state: a fresh browser context, the mock database reset to the `default` scenario through `?reset=1`, and only spec 02 anchor data.
- **VR-05** — THE SYSTEM SHALL install Playwright's clock at a fixed instant before navigation and pin `Date` to it, so dates and relative times render the same way on every run.
- **VR-06** — WHEN a screenshot is taken, THE SYSTEM SHALL have finished loading: no element with `aria-busy="true"` or `data-outdated`, the mock's realtime socket connected, `document.fonts.ready` resolved, every `img` (including lazy ones) loaded and decoded, and no pending API request in the mock request log.
- **VR-07** — THE SYSTEM SHALL disable CSS animations and transitions, emulate reduced motion, hide the text caret, and hide scrollbars during capture.
- **VR-08** — WHEN a region cannot be made deterministic, THE SYSTEM SHALL mask it, and SHALL list every mask with its reason in design §4. Masking SHALL NOT be used for content that the clock or fixtures can fix.

### Workflow

- **VR-09** — THE SYSTEM SHALL generate baselines with the Chromium that ships with the installed `@playwright/test`, and SHALL tag each baseline with the platform that rendered it, so a run on another OS reports a missing baseline instead of pixel noise.
- **VR-10** — THE SYSTEM SHALL store baselines under `e2e/__screenshots__/` with names that identify the screen, state, project and platform, and SHALL commit them with the code.
- **VR-11** — THE SYSTEM SHALL compare with an explicit tolerance (design §5), and SHALL write expected, actual and diff images to the HTML report and a trace to `test-results` on failure.
- **VR-12** — THE SYSTEM SHALL provide `test:visual` (compare) and `test:visual:update` (regenerate) scripts, and the default `test:e2e` run SHALL include the visual tests.

## Out of scope

- Figma fidelity itself: owner specs compare each screen against the Figma screenshots by eye; this spec only detects changes after that.
- Screens not named by the brief (login, profile, wallets, confirmation) and tablet width. Spec 11 covers their layout with functional checks.
- Cross-browser baselines (Chromium only, as the brief asks) and cross-OS baselines (Linux only; see design §6).
- A CI pipeline: not set up until the user asks (spec 00).

## Decisions on the draft's open questions

1. **Container runtime** — dropped. No container; baselines come from the Playwright Chromium on the developer's Linux machine (design §0).
2. **Skeleton baselines** — yes, for home and details in both projects.
3. **Checkout state** — the first step with Ana's prefilled data and the primary wallet selected. The review step is covered by the functional specs.
4. **Tolerance** — `maxDiffPixelRatio: 0.001`, `threshold: 0.2`; 144 repeated runs were stable (design §5).
