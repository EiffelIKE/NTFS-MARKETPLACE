# 04 — Auth & session · Requirements

> Status: Ready for review

Build sign-up, login and logout on spec 02's auth operations, and the client session around them:
- token storage and restore after a refresh;
- the request headers and the 401 handling;
- route guards with a `redirect` back to where the user was;
- expiry handling that preserves context;
- isolation when the identity changes (Query cache, realtime socket, in-flight results).

It also introduces the shared form layer (TanStack Form + Zod) that specs 08 and 09 reuse, and the signed-in header menu.

Brief coverage: §3 (Login / Sign-up screens; out-of-scope actions must not fake success), §3.4 (sign-up, login, logout, session restore, expiry during navigation and checkout with resume, user switch clears private data and subscriptions, validation including API errors, no plaintext passwords), §4 (per-user isolation, no duplicate operations, direct access to every screen), §8 (keyboard, labels, live feedback), §9 (E2E scenario 3).

Figma input: desktop "Login" and "Cadastro" (a modal panel over home with "Entrar | Criar conta" tabs) and mobile "Login" and "Cadastro" (full page), from `figma_tokens/screenshots/` and [`screens.md`](../../figma_tokens/screens.md#login-and-sign-up).

## User stories

- **US-1** — As a visitor, I create a collector account with a username, email and password, and I am signed in right away.
- **US-2** — As a collector, I sign in and land back on the page I was trying to reach, with its filters and state intact.
- **US-3** — As a collector, I stay signed in after a refresh until my session expires.
- **US-4** — As a collector whose session expires mid-flow (for example during checkout), I sign in again and resume where I was.
- **US-5** — As a collector who signs out, or hands the device to someone else, nothing of mine stays visible or keeps updating.
- **US-6** — As a keyboard or screen-reader user, I complete both forms and understand every error.

## Acceptance criteria

### Forms

- **AUTH-01** — THE SYSTEM SHALL validate the sign-up form on the client with spec 02's `SignupBody` schema, plus a "Confirmar senha" field that must match, before sending anything. Errors SHALL appear per field after the field is left or a submit is attempted, and SHALL update as the user types after a failed submit.
- **AUTH-02** — WHEN sign-up returns 422 `VALIDATION_FAILED`, 409 `EMAIL_TAKEN` or 409 `USERNAME_TAKEN`, THE SYSTEM SHALL show the API message on the matching field, keep the entered values, and move focus to the first invalid field.
- **AUTH-03** — WHEN login returns 401 `INVALID_CREDENTIALS`, THE SYSTEM SHALL show "E-mail ou senha incorretos." as a form-level alert, without marking either field. It SHALL clear the password and move focus to it.
- **AUTH-04** — WHEN a submit fails for any other reason (network, timeout, 429, 5xx), THE SYSTEM SHALL show a form-level alert with a pt-BR message, keep every value, and re-enable the submit.
- **AUTH-05** — WHILE a sign-up or login request is pending, THE SYSTEM SHALL disable the submit button and show its loading state. Repeated clicks or Enter presses SHALL send at most one request.
- **AUTH-06** — THE SYSTEM SHALL NOT keep passwords anywhere outside the form state: no storage, no URL, no logs. Each field SHALL use the right `autocomplete` value (`email`, `username`, `current-password`, `new-password`).

### Session

- **AUTH-07** — WHEN login or sign-up succeeds, THE SYSTEM SHALL store the session payload (token, expiry, user) in `localStorage` and mark the session authenticated.
- **AUTH-08** — WHEN the app loads with a stored session, THE SYSTEM SHALL verify it with `auth.session` before any route renders:
  - success: keep it, with the refreshed user;
  - 401: discard it and treat the visit as expired (AUTH-13);
  - network or 5xx failure after the standard retries: keep the stored session without signing the user out.
- **AUTH-09** — THE SYSTEM SHALL send `Authorization: Bearer <token>` on every API request while authenticated, and otherwise `X-Guest-Cart-Id` when spec 07 has stored a guest cart id. It SHALL never send both.
- **AUTH-10** — THE SYSTEM SHALL let other specs register post-sign-in tasks (spec 07's guest cart merge). These run after login, sign-up and a successful restore, before the redirect resolves. A failing task SHALL NOT block sign-in.

### Guards and redirects

- **AUTH-11** — WHEN a visitor without a session opens `/checkout`, `/orders/$orderId`, `/profile` or `/wallets`, THE SYSTEM SHALL redirect to `/login?redirect=<full path with search and hash>` without rendering the private screen.
- **AUTH-12** — WHEN login or sign-up succeeds, THE SYSTEM SHALL navigate to the `redirect` param (same-origin paths only, spec 00) or to `/`, replacing the auth page in history. WHEN an authenticated user opens `/login` or `/signup`, THE SYSTEM SHALL redirect the same way.

### Expiry

- **AUTH-13** — THE SYSTEM SHALL treat the session as expired:
  - when its local `expiresAt` has passed at navigation into a protected route;
  - when a verification older than 60 s fails on that navigation;
  - when any request that carried the current token gets 401 `SESSION_EXPIRED` or `UNAUTHENTICATED`.

  Concurrent failures SHALL trigger the expiry handling once.
- **AUTH-14** — WHEN the session expires on a protected route, THE SYSTEM SHALL sign out locally and redirect to `/login?redirect=<current path>&reason=expired`. The login page SHALL say "Sua sessão expirou. Entre novamente para continuar.", and signing in SHALL return to the same path. Screen-owned drafts (spec 09 checkout) survive, because they are keyed by user.
- **AUTH-15** — WHEN the session expires on a public route, THE SYSTEM SHALL sign out locally, keep the user on the page, and show a toast with an "Entrar" action that opens login with `redirect` set to the current path.

### Sign-out and isolation

- **AUTH-16** — WHEN the user chooses "Sair", THE SYSTEM SHALL call `auth.logout` (ignoring its failure), sign out locally, show "Você saiu da sua conta.", and leave a protected route for `/`.
- **AUTH-17** — WHEN the identity changes (guest → user, user → guest, user A → user B), THE SYSTEM SHALL:
  - cancel in-flight queries and clear the whole Query cache;
  - reset the realtime socket to the new identity (spec 03);
  - increment a session epoch that mutations check before writing results.

  No data, event or late response from the previous identity SHALL appear afterwards.
- **AUTH-18** — WHEN another tab of the same browser signs in, signs out or switches user, THE SYSTEM SHALL apply the same identity change in this tab, without calling the API. A sign-out SHALL show "Sua sessão foi encerrada em outra aba."

### Screens

- **AUTH-19** — THE SYSTEM SHALL render `/login` and `/signup` per Figma:
  - **desktop:** the auth panel with "Entrar | Criar conta" tabs, a close button and the bottom accent bar, centered on the page under the header (decision 1);
  - **mobile:** a bare full page with the KURIO logo, a title, the form, the social buttons and the footer link to the other page.

  Both pages SHALL keep the `redirect` param when switching between them.
- **AUTH-20** — THE SYSTEM SHALL render "Esqueceu a senha?", "Continuar com Google" and "Continuar com Facebook" as unavailable actions, using the spec 01 `UnavailableLink` behavior (tooltip and toast "Disponível em breve"). They SHALL never navigate, authenticate or send a request (decision 2).
- **AUTH-21** — WHILE authenticated, THE SYSTEM SHALL show in the desktop header the user's avatar (or initials) and display name instead of "Entrar". The keyboard-accessible menu SHALL contain "Meu perfil" → `/profile`, "Carteiras" → `/wallets`, "Lista de interesse" → `/?favorites=1` and "Sair". It SHALL update when spec 08 changes the profile.
- **AUTH-22** — THE SYSTEM SHALL give every field an accessible name, mark errors with `aria-invalid` and `aria-describedby`, announce form-level alerts with `role="alert"`, and give the password toggle a name and a pressed state. Both pages SHALL have one `h1` and the titles "Entrar · KURIO" and "Criar conta · KURIO".

### Tests

- **AUTH-23** — THE SYSTEM SHALL include unit tests for the session controller (storage, restore outcomes, expiry, epoch, cross-tab), the HTTP auth interceptor, server-error mapping and redirect targets.
- **AUTH-24** — THE SYSTEM SHALL include E2E tests (`e2e/auth.spec.ts`, both projects, preview build) for brief scenario 3:
  - sign-up, including conflicts and validation;
  - login, including wrong credentials;
  - protected redirect and resume;
  - session expiry, both local and server-side;
  - logout;
  - user switch with socket reset;
  - cross-tab sign-out;
  - unavailable actions;
  - keyboard order and axe.

## Out of scope

- Password recovery, social login, email verification, "remember me" and refresh tokens: not in the brief. Their entry points are unavailable actions (AUTH-20).
- Guest cart id storage and the merge itself: spec 07, which registers a post-sign-in task (AUTH-10).
- Profile editing, avatar and password change: spec 08, which reuses this spec's form layer and session user update.
- Checkout draft persistence: spec 09.
- A mobile header menu: Figma has none; mobile users reach "Sair" from the profile screen (spec 08).

## Decisions (for review)

1. **Desktop auth is a page, not a modal over home.** `/login` and `/signup` render the Figma panel (500 wide, tabs, × close, 10 px accent bar) centered under the header, over the plain page background. There is no home page and no scrim behind it.
   - **Why:** both routes must work on direct access and as redirect targets. A real modal over home would load the home data just to dim it, and would need focus trapping for a panel that is the whole page.
   - **Close (×):** goes to `redirect` when that path is public, otherwise to `/`.
   - Recorded as a deviation.
2. **Unavailable auth actions** use the same pattern as spec 01's unavailable links: a tooltip plus the "Disponível em breve" toast, no navigation. The social buttons keep their Figma look and brand icons, with `aria-disabled="true"`.
3. **Form library: TanStack Form** (`@tanstack/react-form`). It fits the TanStack stack, accepts Zod 4 directly as a Standard Schema with no resolver package, and has typed field APIs that specs 08 and 09 reuse.
4. **Session storage in `localStorage`** under the bearer-token transport (spec 02 decision 1). It is readable by any script on the origin. `ARCHITECTURE.md` records that a production backend would use an HttpOnly cookie.
5. **Clear the whole Query cache on every identity change**, including guest → user. Public data refetches cheaply, and no per-key bookkeeping can miss a private entry.
