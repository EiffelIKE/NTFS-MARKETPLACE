# 04 — Auth & session · Tasks

> Status: Done

Implements [`requirements.md`](requirements.md) following [`design.md`](design.md). Work top to bottom; check a task only when its proof passes. Commands run inside the mise toolchain.

Starts after specs 01, 02 and 03 are Done. It uses these pieces from them:
- spec 01: `PasswordInput`, `Field`, `Alert`, `Avatar`, `DropdownMenu`, `Tooltip`, `UnavailableLink`, `notify`, `announce`, `focusFirstInvalid`, the header `session` input and the axe helper;
- spec 02: `authApi`, schemas, scenarios, `loginAs`;
- spec 03: `realtime.setSession` and `__mock.realtime`.

## Blockers (user-provided)

None. The Figma auth screens are in `figma_tokens/screenshots/`.

## Tasks

- [x] **T01 — Form layer** · AUTH-01, AUTH-02, AUTH-04, AUTH-05
  - `pnpm add @tanstack/react-form@^1.33.5`.
  - `components/form/`:
    - `app-form.ts` (`createFormHook`);
    - `TextField`, `PasswordField`, `SubmitButton`, `FormAlert`;
    - `server-errors.ts`.
  - Confirm the dynamic-validation API (`onDynamic` + `revalidateLogic`) in 1.33.5. If it differs, use the fallback in design §8 and update the design.
  - **Proof:** `server-errors.test.ts` (13 tests: server errors, clearing, validation timing, `submitForm`); the `/dev/ui-kit` "Formulários" section and its E2E test show blur, submit and change-after-submit timing. The dynamic-validation API matched the design, so the fallback was not needed.

- [x] **T02 — Session controller and storage** · AUTH-06, AUTH-07, AUTH-08, AUTH-10, AUTH-13, AUTH-17, AUTH-18
  - `features/auth/model/session-storage.ts` and `session.ts` (design §3), with `useSession()`.
  - **Proof:** `session.test.ts` (41 tests).

- [x] **T03 — HTTP interceptors** · AUTH-09, AUTH-13
  - `lib/http/auth.ts` with `installAuthInterceptors` and `isSessionError`.
  - **Proof:** `auth.test.ts` (11 tests).

- [x] **T04 — Bridge and router context** · AUTH-08, AUTH-14, AUTH-15, AUTH-17
  - `app/session-bridge.ts` (design §5).
  - `RouterContext.session`, and the root `beforeLoad` awaits `ready`.
  - Replace spec 03's temporary guest `setSession`.
  - **Proof:** `session-bridge.test.ts` (11 tests: clear and reset order, public-route toast, protected-route navigation, logout, other tab, guard-triggered expiry). The spec 00 smoke E2E passes with private routes behind `loginAs`.

- [x] **T05 — Guards and auth routes** · AUTH-11, AUTH-12
  - `model/redirects.ts`.
  - Add `requireAuth` and `staticData.requiresAuth` to `checkout`, `orders/$orderId`, `profile` and `wallets`.
  - Add `authSearch` and `redirectIfAuthenticated` to `login` and `signup`.
  - Update the spec 00 smoke test where a private placeholder is now behind the guard: sign in first with `loginAs`.
  - **Proof:** `redirects.test.ts` (9 tests) and `auth-search.test.ts`; E2E protected-redirect, every-private-route and close-target tests.

- [x] **T06 — Auth page frame** · AUTH-19, AUTH-20, AUTH-22
  - `AuthPage`: desktop panel, mobile bare page, tabs, close, single `h1`, titles, footer links.
  - `SocialLoginButtons`, and "Esqueceu a senha?" as `UnavailableLink`.
  - **Proof:** E2E unavailable-actions, keyboard-order, h1/title and axe tests in both projects; visual check in design §14.

- [x] **T07 — Login form** · AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-12, AUTH-14
  - `login-form.tsx` and `use-login.ts`: the expired notice, the credential-failure handling, the `announce` on success and the redirect navigation.
  - **Proof:** E2E wrong password, empty submit, triple click, offline and password-storage tests.

- [x] **T08 — Sign-up form** · AUTH-01, AUTH-02, AUTH-05, AUTH-06, AUTH-07
  - `signup-form.tsx` and `use-signup.ts`: the confirm refine, the password hint, the conflict mapping and the success toast.
  - **Proof:** E2E sign-up success, empty and mismatch, and conflict tests.

- [x] **T09 — Header user menu and logout** · AUTH-16, AUTH-21
  - `user-menu.tsx` connected to the spec 01 header `session` input.
  - `use-logout.ts`.
  - The guest "Entrar" redirect carry-over on auth pages.
  - **Proof:** E2E logout and menu keyboard tests (desktop; the mobile project has no menu, see design §14).

- [x] **T10 — E2E suite and helper** · AUTH-24
  - Amend `loginAs` in `e2e/support/mock.ts` to seed `kurio.session`.
  - `e2e/auth.spec.ts` with every test in design §10.
  - **Proof:** `pnpm test:e2e`: 163 passed, 7 skipped by design, in both projects.

- [x] **T11 — Docs hand-off**
  - Append design §13 to the spec 14 notes list.
  - README (owned by spec 14): the fixture credentials table, plus how `session-short` and `expireSessions()` reproduce expiry.
  - **Proof:** Spec 14 design §3 lists the spec 04 notes; its README outline (§2) already has the credentials table and the expiry rows (`session-short`, `expireSessions()`).

## Run log (2026-10-28)

- Gate: `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm format:check`, `pnpm test` (**494 unit tests** in 32 files), `pnpm build` and `pnpm test:e2e` (**163 passed, 7 skipped** by design, in `desktop-chromium` and `mobile-chromium`) all exit 0. `auth.spec.ts` has 36 tests per project; 5 skip on mobile because they need the header menu (logout, user switch, menu keyboard and update, the close button).
- **Open warning:** `pnpm build` still reports one chunk over 500 kB, owned by spec 13. It is now the mock layer (`browser-*.js`, 511 kB, demo code), because the form and auth code split out of the entry: `index-*.js` is 450 kB (it was 661 kB in spec 01's run).
- **Bug found by the E2E run:** the restore started when `app.tsx` was imported, before the mock worker was ready, so `auth.session` got a 404 and the stored session stayed unverified. It now starts in `bootApp()` after the worker (design §14).
- **Library behavior found by the unit tests:** `handleSubmit` refuses a first submit that carries a stale blur error the user has already fixed. `submitForm` re-validates first (design §14).
- The 401 of restoring a dead session is logged by the browser, so tests that `?reset=1` while a session is seeded call `forgetSession` first (`mocks.spec.ts`, `realtime-resilience.spec.ts`).
- Spec 03's `/dev/realtime` tests were rewritten to sign in with `loginAs` and a navigation. The temporary bearer interceptor is deleted.
- No negative proofs needed beyond the unit tests: the stale-token, `INVALID_CREDENTIALS` and concurrent-401 cases fail if the interceptor or `expire` is changed.

## Coverage

| Requirement | Tasks | Proof |
|---|---|---|
| AUTH-01 | T01, T08 | E2E empty / mismatch sign-up |
| AUTH-02 | T01, T08 | E2E email / username conflicts; `server-errors.test.ts` |
| AUTH-03 | T07 | E2E wrong password |
| AUTH-04 | T01, T07 | E2E offline login |
| AUTH-05 | T01, T07, T08 | E2E triple click → one request |
| AUTH-06 | T02, T07, T08 | storage holds only the payload (unit); `autocomplete` asserted in E2E |
| AUTH-07 | T02, T07, T08 | E2E sign-up → signed in |
| AUTH-08 | T02, T04 | restore unit cases; reload E2E |
| AUTH-09 | T03 | `auth.test.ts` |
| AUTH-10 | T02 | task order and isolation (unit) |
| AUTH-11 | T05 | E2E protected redirect |
| AUTH-12 | T05, T07 | E2E resume with search and hash; `/login` while signed in |
| AUTH-13 | T02, T03 | `ensureValid` and 401 unit cases |
| AUTH-14 | T04, T05, T07 | E2E local and server-side expiry |
| AUTH-15 | T04 | bridge unit test (E2E in specs 06 and 09) |
| AUTH-16 | T09 | E2E logout |
| AUTH-17 | T02, T04 | epoch / clear unit tests; user-switch E2E with socket check |
| AUTH-18 | T02 | cross-tab unit; two-page E2E |
| AUTH-19 | T06 | visual check; E2E in both projects |
| AUTH-20 | T06 | E2E unavailable actions |
| AUTH-21 | T09 | E2E header name; menu keyboard |
| AUTH-22 | T06 | keyboard order + axe E2E |
| AUTH-23 | T01–T05 | `pnpm test` |
| AUTH-24 | T10 | `pnpm test:e2e` |
