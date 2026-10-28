# 02 — Contracts & mocks · Requirements

Define the typed REST contract for every resource in brief §5 and implement it at the network layer with MSW, over a persisted mock database with deterministic fixtures, scenarios and network-condition injection. Screens (specs 04–10) consume these contracts through typed endpoint functions; they never see mock code. The Socket.IO transport is spec 03; this spec only emits the domain changes that spec 03 broadcasts.

Brief coverage: §3.1–3.4 (data rules behind every flow), §4 (typed contracts, stale-response support, isolation by user), §5 (REST contracts, error taxonomy, idempotency), §6 (MSW, persistence, reset, network conditions, scenarios, demo build), §9 (isolated state, clock and latency control).

## User stories

- **US-1** — As a developer of screen specs, I call typed endpoint functions whose requests and responses are validated against one shared contract, so transport, cache and UI agree on shapes.
- **US-2** — As an evaluator, I open the deployed demo and every flow works against a simulated API that keeps its state across refreshes, and I can reset it to a known state.
- **US-3** — As an evaluator or test author, I select a named scenario (empty catalog, slow network, offline, declined payment, …) and get the same behavior every time.
- **US-4** — As a test author, I control latency, failures, session expiry, catalog changes and order settlement from Playwright, without touching application code.
- **US-5** — As a collector, my favorites, cart, profile, wallets and orders are mine alone; another account never sees or changes them.

## Acceptance criteria

### Contracts

- **API-01** — THE SYSTEM SHALL define every path parameter, query parameter set, request body and response body of the REST API as Zod schemas in one contracts module, exporting the inferred TypeScript types. The endpoint functions and the mock handlers SHALL import the same schemas.
- **API-02** — THE SYSTEM SHALL provide at least these operations (full table in `design.md`):
  - session and account: sign-up, login, session lookup, logout, expiration;
  - NFTs: listing with search, filters, sorting, pagination and facets; details by id; related items; home highlights;
  - favorites: retrieval, addition, removal;
  - cart: retrieval, add item, update quantity, remove item, apply and remove coupon, merge a guest cart;
  - quote: validation of coupon, availability, discount, network fee and total for a payment network;
  - orders: idempotent creation, retrieval by id, listing of the user's orders;
  - profile: retrieval, details update, avatar upload and removal, password change;
  - wallets: retrieval, registration, update; wallet connection and disconnection (simulated);
  - payment networks: listing with fees.
- **API-03** — WHEN the client receives a response, THE SYSTEM SHALL parse it with the operation's response schema before returning it. WHEN parsing fails, THE SYSTEM SHALL reject with an `ApiError` of kind `contract` that names the operation, and SHALL NOT return unvalidated data.
- **API-04** — THE SYSTEM SHALL expose one typed endpoint function per operation, built on the single Axios instance from spec 00. Features SHALL reach the REST API only through these functions.
- **API-05** — THE SYSTEM SHALL let every read operation accept an `AbortSignal` and forward it to Axios, so a cancelled query aborts its request (FND-16).

### Money and quantities

- **API-06** — THE SYSTEM SHALL transmit every ETH amount as a decimal string (non-negative, no exponent, at most 18 fractional digits) and every quantity as a positive integer. Contract schemas SHALL reject a JSON number where an ETH amount is expected.
- **API-07** — THE SYSTEM SHALL do all ETH arithmetic and comparison with an arbitrary-precision decimal library in one money module shared by the client and the mocks. No ETH value SHALL be converted to a JavaScript `number`.
- **API-08** — THE SYSTEM SHALL format ETH for display as `1.19 ETH`: dot as decimal separator, no digit grouping, at least two fractional digits, and every significant fractional digit kept (formatting never rounds). *(Decision 4.)*
- **API-09** — WHEN the mock API computes a quote or an order, THE SYSTEM SHALL satisfy `total = subtotal − discount + networkFee` exactly, with `subtotal` the sum of `unitPrice × quantity` over purchasable lines, and SHALL apply one documented rounding rule to percentage discounts.

### Errors

- **API-10** — WHEN the API responds with a non-2xx status, THE SYSTEM SHALL return a JSON error envelope with a machine-readable `code`, a pt-BR `message`, optional per-field messages and optional structured `details`.
- **API-11** — THE SYSTEM SHALL represent, with distinct status and code:
  - validation errors (422, with field messages);
  - missing, invalid or expired session and invalid credentials (401);
  - insufficient permissions (403);
  - nonexistent resources (404);
  - availability conflicts (409, with the available quantity);
  - other conflicts (409): duplicate email, duplicate wallet, changed quote, idempotency mismatch, pending order, rejected or missing wallet connection;
  - transient failures (429, 500, 503).

  The code list SHALL be a closed union in the contracts.
- **API-12** — THE SYSTEM SHALL extend spec 00's `ApiError` with the parsed envelope (`code`, `fields`, `details`). WHEN an error body is missing or does not match the envelope, THE SYSTEM SHALL use the code `UNKNOWN` and keep the HTTP status. The retry rule from spec 00 stays unchanged.

### Catalog and favorites (mock API behavior)

- **API-13** — WHEN the NFT listing is requested, THE SYSTEM SHALL support:
  - free-text search, case- and accent-insensitive, over name, collection, creator and attributes;
  - category filter (multi-select), network filter (multi-select) and min/max price filter;
  - segment (all, new, trending) and sort (recent, price ascending, price descending, popular);
  - favorites-only (requires a session);
  - page and page size.

  Filters SHALL combine with AND across dimensions and OR within a dimension. Ordering SHALL be stable (ties broken by id).
- **API-14** — THE SYSTEM SHALL return, with each listing page: the items, page, page size, total items, total pages, the normalized parameters it applied, and facets (count per category and per network, and the price bounds), each facet computed with every other active filter applied. WHEN the page is beyond the last page, THE SYSTEM SHALL return no items with the real totals. WHEN a parameter is invalid, THE SYSTEM SHALL return 422.
- **API-15** — WHEN details are requested for an unknown NFT id, THE SYSTEM SHALL return 404. Details SHALL include the gallery images, editions (label, supply, available quantity, maximum per order; every edition sells at the NFT's price, as in Figma) and a `version` that increases on every price or availability change.
- **API-16** — THE SYSTEM SHALL store favorites per user, require a session for them, make add and remove idempotent, and return 404 for an unknown NFT.

### Cart, coupons and quote (mock API behavior)

- **API-17** — THE SYSTEM SHALL keep one cart per user and one per guest (identified by a guest cart id issued by the API). WHEN an item is added or its quantity changed, THE SYSTEM SHALL require an integer ≥ 1 (422 otherwise). It SHALL return 409 with the available quantity when the quantity exceeds the smaller of availability and the per-order maximum. It SHALL return 409 when the edition is sold out.
- **API-18** — WHEN a signed-in user merges a guest cart, THE SYSTEM SHALL add the guest lines to the user's cart, summing quantities of the same NFT and edition and capping them at the limit. It SHALL report every adjusted line and delete the guest cart. Merging a cart that no longer exists SHALL succeed with no changes.
- **API-19** — THE SYSTEM SHALL return each cart line with its current unit price, the price when it was added, availability, maximum quantity and a status (`ok`, `price_changed`, `limited`, `unavailable`).
- **API-20** — WHEN a coupon is applied, THE SYSTEM SHALL reject an unknown code (`COUPON_INVALID`), an expired code (`COUPON_EXPIRED`) and a code whose minimum subtotal is not met (`COUPON_NOT_APPLICABLE`), each with 422. Removing the coupon SHALL always succeed.
- **API-21** — WHEN a quote is requested for the current cart and a payment network, THE SYSTEM SHALL return lines, subtotal, discount, network fee, total, coupon, network, blocking issues and a quote id. The quote id SHALL change whenever any of those values change. The network fee is a fixed amount per payment network. *(Decision 3.)*

### Orders and wallets (mock API behavior)

- **API-22** — WHEN an order is created, THE SYSTEM SHALL require a session and an `Idempotency-Key` header, and SHALL handle a repeated key this way:
  - the same key with the same body returns the same order (200), with no second order created;
  - the same key with a different body returns 409 `IDEMPOTENCY_CONFLICT`;
  - a user with a pending order gets 409 `ORDER_PENDING` (with that order's id) for a new key.
- **API-23** — WHEN an order is created, THE SYSTEM SHALL revalidate price, availability, coupon and fee against the given quote id. WHEN anything changed, THE SYSTEM SHALL create nothing and return 409 `QUOTE_CHANGED` with the fresh quote, or 409 `INSUFFICIENT_AVAILABILITY`. It SHALL require an active connection for the chosen wallet, provider and network (409 `WALLET_NOT_CONNECTED` otherwise), and SHALL validate the collector details from the Figma checkout form.
- **API-24** — THE SYSTEM SHALL create orders as `pending` and reserve their quantities. After the scenario's settlement delay, the order SHALL move to `confirmed` or `declined`:
  - `confirmed`: record a simulated transaction hash and explorer URL, and remove only the purchased quantities from the buyer's cart;
  - `declined`: record a reason, release the reservation and leave the cart untouched.

  Both states are terminal. Status SHALL derive from persisted timestamps, so it progresses correctly after a reload.
- **API-25** — THE SYSTEM SHALL store a snapshot of lines, prices, coupon, fee and totals in each order. Later catalog changes SHALL NOT alter an order's amounts.
- **API-26** — WHEN an order of another user is requested, THE SYSTEM SHALL return 403 `FORBIDDEN`. For an unknown id it SHALL return 404.
- **API-27** — THE SYSTEM SHALL keep at most one primary and one secondary wallet per user (the two Figma slots), each with the Figma wallet fields (display name, nickname, network, profile name, address, optional alternate wallet or ENS, provider, referral code, email, ENS name). It SHALL validate the address against the chosen network's family:
  - EVM (`0x` and 40 hex characters) for Ethereum and Polygon;
  - Solana (base58, 32–44 characters) for Solana.

  The rules for registration and update:
  - an invalid field or an address that does not fit the network returns 422;
  - registering a slot that is already used returns 409 `WALLET_ROLE_TAKEN`;
  - the same address in both slots returns 409 `WALLET_DUPLICATE`.
- **API-28** — WHEN a wallet connection is requested, THE SYSTEM SHALL approve it or reject it with 409 `WALLET_REJECTED` according to the scenario. It SHALL support explicit disconnection and a simulated disconnection triggered from the test control API.

### Account and session (mock API behavior)

- **API-29** — WHEN signing up with username, email and password (the Figma fields), THE SYSTEM SHALL validate every field (422 with field messages) and reject an existing email, compared case-insensitively, with 409 `EMAIL_TAKEN` on `email`, and an existing username with 409 `USERNAME_TAKEN` on `username`. On success it SHALL return the same session payload as login.
- **API-30** — WHEN logging in, THE SYSTEM SHALL return an opaque bearer token with its expiry and the user, or 401 `INVALID_CREDENTIALS` without revealing which field was wrong. Session lookup SHALL return the user or 401 (`UNAUTHENTICATED` or `SESSION_EXPIRED`). Logout SHALL invalidate the token, and SHALL succeed even when the token is already invalid. *(Decision 1.)*
- **API-31** — THE SYSTEM SHALL store passwords only as salted PBKDF2 hashes, in the mock database and in fixtures, and SHALL never persist or log a plaintext password.
- **API-32** — THE SYSTEM SHALL:
  - update the Figma profile fields (display name, username, email, ENS name, wallet nickname) with validation and uniqueness conflicts;
  - accept an avatar upload (PNG, JPEG or WebP, ≤ 2 MB; 415 or 413 otherwise) and serve it back;
  - change the password only with the correct current password (422 on `currentPassword` otherwise), revoking the user's other sessions.

  Confirmed changes SHALL persist across reloads.
- **API-33** — WHEN a private operation is called without a valid session, THE SYSTEM SHALL return 401. Every private response SHALL contain only the session user's data, and no operation SHALL read or change another user's data.

### Mock infrastructure

- **API-34** — THE SYSTEM SHALL intercept REST calls with an MSW service worker in the browser, enabled by a validated environment flag. The worker SHALL be included in the production (demo) build when the flag is on. WHEN the flag is off, no mock code SHALL be in the bundle. The app SHALL render only after the worker is ready.
- **API-35** — THE SYSTEM SHALL keep all fictitious data and simulated behavior under the mocks module. Components, hooks, endpoint functions and the Axios client SHALL NOT import it, and a lint rule SHALL enforce this. The only exception is the bootstrap's dynamic import.
- **API-36** — THE SYSTEM SHALL hold all simulated data in one typed mock database. Each operation SHALL keep the catalog, users, sessions, favorites, carts, coupons, orders, profiles, wallets and connections consistent with each other. The database SHALL be persisted in `localStorage` with a schema version. WHEN the stored data is missing, corrupt or of another version, THE SYSTEM SHALL reseed it.
- **API-37** — WHEN a mutation changes an NFT's price or availability, or an order's status, THE SYSTEM SHALL increase that resource's version and publish a domain change (type, resource id, version, owner for private resources) on an in-process bus. Spec 03 SHALL forward these changes over Socket.IO, so REST and events always derive from the same state.
- **API-38** — THE SYSTEM SHALL generate the fixtures deterministically. They SHALL include:
  - at least 100 NFTs across all Figma categories and networks, with prices spanning the Figma filter range (0.02–12.30);
  - sale prices, rarities, editions of every kind, and sold-out and low-stock editions;
  - the NFT names and prices drawn in Figma, with the nine grid NFTs first in the default sort so page 1 matches the Figma grid;
  - at least two users with documented fictitious credentials and distinct favorites, wallets, carts and orders;
  - valid, expired and minimum-subtotal coupons.

  All images SHALL be served from the app's origin.
- **API-39** — THE SYSTEM SHALL offer named scenarios that cover every condition listed in brief §6 (mapping in `design.md`). A scenario SHALL be selectable through `?scenario=<id>`, the mock panel and the test control API. Selecting one SHALL reset the database to that scenario's seed. The active scenario SHALL persist across reloads.
- **API-40** — WHEN a reset is requested (`?reset=1`, the panel or the test control API), THE SYSTEM SHALL restore the active scenario's seed and default configuration in full, including sessions and overrides.
- **API-41** — THE SYSTEM SHALL simulate, reproducibly:
  - fixed latency and variable latency from a seeded generator;
  - out-of-order responses (a later request answered first);
  - timeouts, either before or after the operation is applied;
  - connection unavailability;
  - HTTP 4xx and 5xx responses injected per operation for the next N calls.
- **API-42** — THE SYSTEM SHALL expose a typed test control API on `window.__mock` in mock-enabled builds. It SHALL be able to:
  - select a scenario, reset, and read or change the configuration;
  - add failure rules;
  - expire sessions;
  - change an NFT edition's price or availability;
  - settle an order;
  - disconnect a wallet;
  - read the request log.
- **API-43** — THE SYSTEM SHALL schedule every mock delay and settlement with the page's timers, and Axios SHALL use timer-based timeouts, so Playwright's clock controls latency, timeouts and settlement.
- **API-44** — THE SYSTEM SHALL provide a mock panel, hidden by default and opened with `?mockPanel=1` or `Alt+Shift+M`. It SHALL show the active scenario, switch scenarios, reset and adjust latency. It SHALL be keyboard operable and labelled in pt-BR. *(Decision 2.)*

### Verification

- **API-45** — THE SYSTEM SHALL include unit tests for the money module, the contracts, the error envelope and the fixtures, plus contract tests that run every operation through the real endpoint functions against the handlers in Node. The contract tests SHALL cover success, each documented error, two-user isolation, idempotency, quote arithmetic and request abort.
- **API-46** — THE SYSTEM SHALL include E2E tests, in both Playwright projects against the preview build, proving:
  - the worker serves the API;
  - scenario selection and reset;
  - persistence across reload;
  - isolation between tests;
  - offline and latency behavior under a controlled clock;
  - the mock panel's keyboard access and its axe check.

## Out of scope

- Socket.IO client, the mock socket server, the event envelope, dedupe and reconnection: spec 03 (consumes API-37).
- Token storage, auth interceptor, 401 handling, route guards: spec 04. Guest cart id storage and merge trigger: spec 07.
- Query keys, query options, mutations and cache invalidation: each feature spec, on top of the endpoint functions.
- Screen UI for loading, empty and error states: screen specs.
- Wallet connection UX and checkout form behavior (prefill, "Usar outra carteira?"): spec 09. Profile and wallet form behavior ("Igual à carteira principal", avatar crop): spec 08. Their fields are fixed here from the Figma screenshots.

## Prerequisites

- **Artwork exports** — delivered 2026-10-27: the four unique Figma artworks in `src/assets/NFTs/{250,750,1000}/`, one WebP per artwork in each width, served through `srcset` (design §9). Nothing pending.

## Decisions (approved 2026-10-27)

1. **Session transport (API-30)** — opaque bearer token returned by login and sign-up. The client stores it and sends `Authorization: Bearer <token>` (spec 04). The guest cart uses an analogous `X-Guest-Cart-Id` header. Cookies were rejected because MSW can only write them through `document.cookie` (never HttpOnly), so they add no protection in the simulation and are harder to control in tests.
2. **Mock panel exposure (API-44)** — hidden by default in every mock-enabled build, including the demo. It opens with `?mockPanel=1` or `Alt+Shift+M` and is documented in the README. `?scenario=`, `?reset=1` and `window.__mock` always work. This keeps the panel out of visual regression and Lighthouse.
3. **Payment network and fee (API-21)** — the quote takes the payment network (Ethereum, Polygon, Solana), and each network has a fixed fee. The cart quotes with Ethereum by default. At checkout the network follows the user's choice, restricted to the networks the chosen wallet supports. Amounts are always in ETH.
4. **ETH display (API-08)** — dot decimal separator everywhere (`1.19 ETH`), as in the Figma cards and details. The Figma filter label `0,02 - 12,30 ETH` becomes `0.02 - 12.30 ETH`, recorded as a deviation.

Technical choices that need no product input are made in [`design.md`](design.md): MSW 2.x instead of 3.x (§1), the Axios fetch adapter (§1), a custom mock database (§7), a server-side guest cart (§4).
