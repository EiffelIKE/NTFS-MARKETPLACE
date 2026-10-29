# 14 — Docs & delivery · Requirements

> Status: Done. The blockers are resolved and the open questions took their recommended defaults (see [Decisions](design.md#9-decisions)). Delivered: `README.md`, `ARCHITECTURE.md`, the build identifier, the clean-checkout script and the deploy check of 2026-10-29.

Write the two delivery documents — `README.md` for running and evaluating the app, `ARCHITECTURE.md` for how and why it is built — and verify that the deliverable runs from a clean checkout and that the public deploy matches the delivered code with mocks and realtime working.

Brief coverage: §4 (cache, retry and sync policy documented), §6 (transport and its limits in the mock environment), §8 (asset replacements and accessibility adjustments documented), §12 (deploy, README contents, ARCHITECTURE contents, commands, clean checkout).

## User stories

- **US-1** — As an evaluator, I follow the README from a fresh clone to a running app, sign in with a demo account, pick a scenario, reproduce each failure flow and reset.
- **US-2** — As an evaluator, I read `ARCHITECTURE.md` and understand the contracts, events, session, cart, cache and reconciliation policies, and every deviation from Figma and the brief, without reading the code first.
- **US-3** — As an evaluator, I open the public URL and the deployed app is the delivered code, with mocks and realtime working and deep links surviving a refresh.

## Acceptance criteria

### README.md

- **DOC-01** — THE SYSTEM SHALL document prerequisites (mise, or Node 24.11 and pnpm 10.34.3 directly), installation with `pnpm install --frozen-lockfile`, and the first run.
- **DOC-02** — THE SYSTEM SHALL list every environment variable with type, default and purpose, matching `.env.example` and the env schema.
- **DOC-03** — THE SYSTEM SHALL list the fictitious demo accounts (Ana, Bruno, Carla) with email, password and what each one's seeded data demonstrates.
- **DOC-04** — THE SYSTEM SHALL document scenario selection (`?scenario=`, mock panel via `?mockPanel=1` or `Alt+Shift+M`, `window.__mock`), every scenario id with its effect, and reset (`?reset=1`, panel, `__mock.reset()`).
- **DOC-05** — THE SYSTEM SHALL list every command required by brief §12 (development with mocks, build, preview, typecheck, lint, unit tests, E2E, E2E report, visual tests, Lighthouse, docs regeneration) with what each produces and where.
- **DOC-06** — THE SYSTEM SHALL give step-by-step reproduction for each failure flow in design §2 (scenario or control call, steps, expected UI), covering every brief §6 bullet and the realtime cases of brief §7.
- **DOC-07** — THE SYSTEM SHALL link the public deploy URL, the repository, and the Lighthouse summary, and SHALL state which screens have no Figma frame.

### ARCHITECTURE.md

- **DOC-08** — THE SYSTEM SHALL describe the source layout and the responsibilities and import boundaries between routes, features, API, contracts, mocks and realtime.
- **DOC-09** — THE SYSTEM SHALL document the REST contracts (operation table with method, path, auth, request/response schema names, error codes), the error envelope and taxonomy, and the idempotency rules; the operation table SHALL be generated from `src/contracts/operations.ts`, so it cannot drift.
- **DOC-10** — THE SYSTEM SHALL document the Socket.IO events (`nft.updated`, `order.updated`): envelope, versioning, dedupe, subscriptions per session, reconnection and REST reconciliation, and the transport used in the mock environment with its limitations.
- **DOC-11** — THE SYSTEM SHALL document the session policy (token storage, expiry, redirect preservation, user switch isolation), the cart state (server cart, guest cart, merge), and the checkout/order state machine.
- **DOC-12** — THE SYSTEM SHALL document the cache, retry and synchronization policy: Query defaults and per-query overrides, the query-key catalog, an invalidation matrix (mutation or event → keys), optimistic updates with rollback, and stale-response handling.
- **DOC-13** — THE SYSTEM SHALL collect every deviation, limitation and UX decision recorded by specs 00–13 (their "notes for `ARCHITECTURE.md`" sections), grouped by Figma, accessibility, assets, brief and technical, each with its reason and a link to the spec.
- **DOC-14** — THE SYSTEM SHALL document the testing strategy (unit, contract, E2E, visual, Lighthouse), mapping each brief §9 scenario to its test file.

### Delivery verification

- **DOC-15** — WHEN the delivery check runs on a fresh copy of the repository with only tracked files, THE SYSTEM SHALL install, typecheck, lint, unit-test, build and pass the E2E suite without private services, network access beyond the package registry, or local state.
- **DOC-16** — THE SYSTEM SHALL expose the build's commit identifier in the deployed app (a `<meta name="kurio-build">` tag), and the README SHALL explain how to compare it with the delivered commit.
- **DOC-17** — WHEN the deploy check runs against the public URL, THE SYSTEM SHALL show: direct access and refresh on every route; the not-found view; `?scenario=` switching; a full purchase confirmed through `order.updated`; and a realtime price change reaching an open cart.

## Out of scope

- A real backend, CI pipeline or monitoring.
- Translating the documents to pt-BR. *(Open question 1.)*
- Re-deciding anything: this spec only collects and verifies decisions made in specs 00–13.

## Blockers (resolved)

- **Vercel project and deploy** (DOC-07, DOC-16, DOC-17): resolved. Deployed at <https://ntfs-marketplace.vercel.app/> through Vercel's integration with the repository.
- **Repository** (DOC-07, DOC-15, DOC-16): resolved. <https://github.com/EiffelIKE/NTFS-MARKETPLACE>; `dev` was merged into `main` by pull request.

## Open questions (resolved)

All four took the recommended default; the choices are recorded in [`design.md` §9](design.md#9-decisions).

1. **Document language**: English.
2. **Generated sections**: the operation, error-code and scenario tables are generated by `scripts/docs.ts` between marker comments and checked by a unit test.
3. **Diagrams**: two Mermaid diagrams in `ARCHITECTURE.md` (data flow; order state machine).
4. **Clean-checkout method**: a `--no-local` clone of the committed `HEAD` (`scripts/delivery-check.sh`).
