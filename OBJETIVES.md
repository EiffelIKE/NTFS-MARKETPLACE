# Frontend App — NFT Marketplace

Implement the **NFT Marketplace** in React and TypeScript, following the [Figma layout](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

The challenge evaluates visual fidelity, interaction quality, API integration, asynchronous state management, real-time functionality, accessibility, and performance.

## 1. Scope

Deliver the discovery, purchase, and collector account flows, with desktop and mobile versions. APIs, authentication, wallets, and payments must work with simulated data. Real integrations with blockchains, wallet extensions, and payment gateways are out of scope.

Figma defines the visual identity and screen composition. This brief defines the behaviors and evaluation scenarios. States that are not shown in the designs must follow the same visual style.

## 2. Required Stack

| Responsibility                    | Technology      |
| --------------------------------- | --------------- |
| Interface                         | React           |
| Language                          | TypeScript      |
| Routing                           | TanStack Router |
| Remote state                      | TanStack Query  |
| HTTP client                       | Axios           |
| Data integration                  | REST APIs       |
| Real-time functionality           | Socket.IO       |
| Styling                           | Tailwind CSS    |
| Components                        | shadcn/ui       |
| Mocking                           | MSW             |
| E2E and visual regression testing  | Playwright      |
| Performance and quality auditing  | Lighthouse      |

The technologies must be used meaningfully in the solution. The build tool, project organization, and supporting libraries are up to the engineer.

## 3. Screens and Flows

| Screen               | Required Features                                                             |
| -------------------- | ----------------------------------------------------------------------------- |
| Home                 | Highlights, catalog, search, filters, sorting, and navigation to the NFT        |
| NFT details          | Gallery, information, edition, quantity, favorites, and purchase                |
| NFT cart             | Quantity editing, removal, coupon, and pricing summary                         |
| Checkout             | Collector details, wallet and network selection, order review and submission   |
| Order confirmation   | Result, transaction identifier, items, fees, and total                         |
| Login                | Authentication, validation, and return to the previous flow                    |
| Sign-up              | Account creation, validation, and conflict handling                            |
| Collector profile    | Editing personal details, avatar, and password                                 |
| Wallets              | Adding and editing primary and secondary wallets                              |

Implement the available desktop and mobile frames. Profile, wallets, and confirmation must also work on mobile, even without a dedicated frame.

Editorial pages, support, activity, offers, and downloads are not part of the deliverable. External links and auxiliary actions must behave coherently; actions outside the scope must not appear to have succeeded functionally.

### Catalog and Details

- Search, filters, sorting, and pagination must be part of the URL state and survive refreshes and history navigation.
- Filters must be combinable; changing a filter must reset pagination.
- Queries must reflect the parameters sent to the API, with handling for empty results, failures, and out-of-order responses.
- The details page must support direct access, nonexistent NFTs, unavailable editions, and quantity limits.
- Favorites must persist for the authenticated user.

### Cart

- Add, update, and remove items, respecting availability for each NFT and edition.
- Keep the cart after a refresh and preserve guest items when authenticating.
- Apply and remove coupons, handling invalid or expired codes.
- Display subtotal, discount, network fee, and total consistent with the API response.
- Reflect price and availability changes received while the cart is open.

ETH amounts must be transmitted as decimal strings and retain precision in calculations and display. Quantities are integers. The API quote is the reference for finalizing the order.

### Checkout and Confirmation

- Validate the fields in the layout and allow review before submission.
- Use registered wallets, with network selection and simulated connection, rejection, and disconnection.
- Revalidate price, availability, coupon, and fees before confirming the purchase. Changes must require renewed user confirmation.
- Prevent duplicate orders from repeated clicks or resubmissions after a timeout.
- Represent pending, confirmed, and declined orders, with recovery after refresh or reconnection.
- Display confirmation only for an order actually confirmed in the simulation.
- Preserve items on failure; after confirmation, remove only the purchased items and quantities from the cart.

The receipt must reproduce the order snapshot. Subsequent catalog changes must not alter its amounts. Transaction references and explorer links are simulated.

### Account and Session

Sign-up, login, logout, and sessions are required and must be integrated with the simulated API. Checkout, profile, wallets, favorites, and orders require authentication.

The session must be recoverable after a refresh. Handle expiration during navigation and checkout, preserving context so the flow can resume. Logout and user switching must clear private cached data and subscriptions from the previous session.

Validate sign-up, profile, password, and wallet forms, including errors returned by the API. Confirmed changes must persist after a refresh. Use fictitious credentials and do not store passwords in plain text.

## 4. Integration and State

Use TanStack Router for routes, search parameters, and protection of private flows. Use TanStack Query for queries, mutations, and cache synchronization. REST calls must go through Axios.

The solution must ensure:

- typed contracts between transport, state, and interface;
- loading, empty, error, success, and background update states;
- consistent invalidation after mutations and events;
- cancellation or discarding of stale responses;
- data isolation by user and query parameters;
- failure recovery without duplicating operations;
- handling of nonexistent routes and direct access to every required screen.

Apply an optimistic update to at least one interaction, with rollback on failure. The cache, retry, and synchronization policies must be documented.

## 5. REST Contracts

Define and document the contracts used. The minimum resources are:

| Resource            | Operations                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| Session and account | Sign-up, login, session lookup, logout, and expiration                        |
| NFTs                | Listing with search/filters/sorting/pagination and details by identifier      |
| Favorites           | Retrieval, addition, and removal                                             |
| Cart                | Retrieval, addition, update, and removal of items                             |
| Quote               | Validation of coupon, availability, discounts, fees, and total                 |
| Orders              | Idempotent creation and retrieval of status and receipt                      |
| Profile             | Retrieval, details/avatar updates, and password changes                      |
| Wallets             | Retrieval, registration, and updates                                         |

Responses must represent validation errors, invalid sessions, insufficient permissions, nonexistent resources, availability conflicts, and transient failures.

Order mutations must accept an idempotency key. In the simulation, the same attempt must retrieve the same order; reusing the key with different content must produce a conflict.

## 6. Mocking with MSW

Implement mocks at the network layer, reusing contracts and scenarios across development, demonstration, and tests. Components, hooks, and the Axios client must not contain fictitious responses or alternative business logic paths.

Mocks must maintain consistent state across the catalog, favorites, cart, profile, wallets, and orders. Local persistence is allowed to support refreshes; resetting must fully restore a known scenario.

### Simulating Network Conditions and Failures

Simulate network conditions and failures with MSW, including slowness, variable latency, timeouts, connection unavailability, and HTTP error responses. Scenarios must be configurable and reproducible, allowing evaluation of loading, error feedback, and interface recovery.

Provide fixtures with enough variety to exercise filters and pagination, at least two users, and deterministic scenarios for:

- success and empty results;
- variable latency and out-of-order responses;
- connection failures and HTTP 4xx/5xx responses;
- expired sessions and unauthorized access;
- sign-up conflicts or form validation conflicts;
- invalid or expired coupons;
- price changes or sold-out editions during purchase;
- timeout after order creation, with recovery through idempotency;
- confirmed and declined payments.

Also use MSW to simulate events, with an integration compatible with the Socket.IO protocol, such as [@mswjs/socket.io-binding](https://github.com/mswjs/socket.io-binding). Document the transport used and its limitations in the mock environment.

Scenarios must exercise `socket.io-client`. Replacing the socket with direct calls to setters, callbacks, or the cache does not meet the requirement.

The mock layer must be enabled through configuration and available in the demonstration build. Changes to simulated data must be reflected in both REST responses and the corresponding events.

## 7. Real-Time Functionality with Socket.IO

Implement at least the following events:

| Event           | Expected Behavior                                                  |
| --------------- | ------------------------------------------------------------------ |
| `nft.updated`   | Update price and availability in the catalog, details, and cart     |
| `order.updated` | Update order status and display confirmation or rejection           |

Events must carry a stable identity, the affected resource, and a version. The client must tolerate duplicates and old events without reverting a newer state or reapplying effects.

After reconnection, reconcile active resources with the REST API. Events from a previous session must not update another user's data. Listeners and subscriptions must be released at the end of their lifecycle.

Implement this scenario:

1. An NFT is in the cart.
2. Its price or availability changes during navigation.
3. The interface communicates the change and updates the summary.
4. Checkout prevents confirmation with an outdated quote.

A connection interruption while an order is pending must also work. After reconnecting or reloading the page, the user must recover its state without creating another purchase. Confirmed or declined orders are terminal.

## 8. Interface, Responsiveness, and Accessibility

Preserve Figma's typography, colors, spacing, hierarchy, images, proportions, and composition. Adapt shadcn/ui components to the project's visual identity.

All screens must work on desktop, tablet, and mobile, with attention to filters, navigation, forms, cart, and checkout. Evaluate widths of at least 390, 768, and 1440 pixels.

Use **skeletons with a shimmer effect** in data-dependent components during loading, including the catalog, details, and cart summary. Preserve content dimensions to avoid layout shifts and respect the reduced motion preference.

The following are required:

- keyboard navigation and visible focus;
- focus management in dialogs and drawers;
- appropriate semantics, labels, and error messages associated with fields;
- text alternatives for relevant images;
- readable contrast and states that do not rely solely on color;
- accessible feedback for mutations and real-time changes;
- no unintended horizontal overflow or content loss when zooming.

Use assets from the design file when available, and keep required images and fonts accessible for local execution. Document any asset replacement or accessibility adjustment relative to the layout.

## 9. Testing with Playwright

Deliver E2E tests that can run with the mocks, covering:

1. Search, combined filters, sorting, pagination, and restoration through history navigation.
2. Direct access to details and handling of nonexistent resources.
3. Sign-up, login, session expiration, logout, and user switching.
4. Favorites, including mutation failure and state recovery.
5. Cart, quantities, removal, coupons, and persistence after refresh/login.
6. Complete purchase, from catalog to confirmed receipt.
7. Payment failure, repeated clicks, and timeout with recovery of the same order.
8. Editing profile, avatar, password, and wallets, with validation errors.
9. Price/availability changes through Socket.IO during checkout.
10. Duplicate or old events, disconnection, and resumption of a pending order.
11. Keyboard navigation, dialog focus, and form validation.
12. Skeletons during slow loading, failure feedback, and recovery after retrying.

Run the main flows in Chromium, using desktop and mobile viewports. Include visual regression for home, details, cart, and checkout, with version-controlled baselines and stable data.

Each test must start from an isolated state. Control the clock, latency, and event triggering in time-sensitive scenarios. Deliver an HTML report and traces for failures.

Checks must observe the interface and operation results. Real-time tests must go through the Socket.IO client, and REST tests through the MSW handlers.

## 10. Performance and Lighthouse

Audit the home and NFT details pages with Lighthouse in mobile and desktop profiles, using an optimized build and the default mock scenario.

| Category       | Target |
| -------------- | -----: |
| Performance    |   ≥ 90 |
| Accessibility  |   ≥ 95 |
| Best Practices |   ≥ 95 |
| SEO            |   ≥ 90 |

Run three measurements per page and profile, and report the median for each category. Version-control the audit configuration and deliver HTML/JSON reports, tool versions, environment details, and execution conditions.

Record LCP, CLS, and TBT. Explain results below the targets and identify the causes. The audit must load the deliverable's images, fonts, and functionality, without simplifications made solely to improve the score.

## 11. Evaluation Criteria

| Criterion                         |  Points | Expected Evidence                                                   |
| --------------------------------- | ------: | ------------------------------------------------------------------- |
| Visual fidelity and responsiveness |      20 | Adherence to Figma and consistency across screen sizes              |
| Flows and user experience         |      20 | Complete purchase and account flows, validation, and error recovery  |
| Integration and state             |      15 | Consistent use of Router, Query, Axios, contracts, and cache          |
| Real-time functionality           |      10 | Events, reconnection, ordering, and synchronization with REST         |
| Mocking                           |      10 | MSW, deterministic scenarios, persistence, and reset                  |
| Testing                           |      10 | Coverage of flows and failures with Playwright                       |
| Accessibility                     |       5 | Keyboard operation, semantics, focus, and feedback                   |
| Performance                       |       5 | Results and analysis of Lighthouse audits                            |
| Architecture and documentation    |       5 | Typing, responsibilities, and reproducible execution                  |
| **Total**                         | **100** |                                                                     |

Disqualifying conditions are: failure to meaningfully use the required stack, main flows that are only visual, purchase confirmation without a response from the simulation, exposure of data between users, events simulated directly in the UI, or absence of runnable E2E tests.

## 12. Delivery

Deliver source code, lockfile, assets, mocks, fixtures, tests, and audit configurations.

**Deployment is mandatory**. Submit the repository link and a public application URL. [Vercel](https://vercel.com/docs/frameworks/frontend/vite) is recommended; [Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) and [Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) are also accepted.

The published version must match the delivered code and remain accessible during evaluation, with mocks and real-time flows working. Direct access and route refreshes must work in the published environment.

The solution's `README.md` must contain setup instructions, environment variables, fictitious credentials, scenario selection and reset, execution commands, and instructions for reproducing failure flows.

Document REST contracts and events, session policy, cart state, cache strategy, and reconciliation between REST and Socket.IO. Record limitations, UX decisions, and any deviations from Figma in `ARCHITECTURE.md`.

Provide commands for development with mocks, build, preview, type checking, linting, Playwright tests, and Lighthouse audits.

The deliverable must run from a clean checkout without depending on private services or the production backend.
