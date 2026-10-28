# 04 — Auth & session · Design

> Status: Done (see §14 for what changed while implementing)

Implements [`requirements.md`](requirements.md). Figma: desktop and mobile "Login" and "Cadastro" screenshots, plus [`screens.md`](../../figma_tokens/screens.md#login-and-sign-up).

## 1. Dependencies

| Package | Version | Kind | Why |
|---|---|---|---|
| `@tanstack/react-form` | `^1.33.5` | runtime | Form state and validation (decision 3). Released 2026-08-11, so it meets `minimumReleaseAge`. Peer `react ^19` ok. Takes Zod 4 schemas as Standard Schema validators, so no resolver package is needed. |

No other additions. This spec uses spec 01's `Field`, `Input`, `PasswordInput`, `Button`, `Alert`, `Avatar`, `DropdownMenu`, `Tooltip`, `UnavailableLink`, `notify` and `announce`; spec 02's `authApi`, `SignupBody`, `LoginBody`, `SessionPayload` and `isApiError`; and spec 03's `realtime.setSession`.

## 2. Layout

```
src/
  lib/http/auth.ts                 # installAuthInterceptors(http, providers): headers + 401 hook (no feature imports)
  components/form/                 # shared form layer (also used by 08 and 09)
    app-form.ts                    # createFormHook: useAppForm, withForm, field + form components
    text-field.tsx  password-field.tsx  submit-button.tsx  form-alert.tsx
    server-errors.ts               # applyServerErrors, clearServerError(s), setFormError
    submit.ts  validation.ts  messages.ts  use-form-focus.ts  form-context.ts
  features/auth/
    model/session.ts               # SessionController singleton: state, storage, restore, expiry, epoch, hooks, cross-tab
    model/session-storage.ts       # kurio.session read/write (zod-validated, try/catch, memory fallback)
    model/redirects.ts             # requireAuth(), redirectIfAuthenticated(), closeTarget(), pathRequiresAuth()
    model/auth-search.ts  messages.ts  signup-schema.ts  instance.ts  use-session.ts
    api/use-login.ts  use-signup.ts  use-logout.ts
    components/auth-page.tsx       # responsive frame: desktop panel / mobile bare page
    components/auth-tabs.tsx  login-form.tsx  signup-form.tsx  social-login.tsx  expired-notice.tsx
    components/user-menu.tsx       # header avatar + dropdown (desktop)
  app/session-bridge.ts            # wires session ↔ Query cache ↔ realtime ↔ router ↔ http providers
  app/boot.ts                      # bootApp(): installs the bridge once, after the mock worker is ready
  routes/login.tsx  signup.tsx     # + requireAuth on checkout, orders/$orderId, profile, wallets
e2e/
  support/mock.ts                  # loginAs() also seeds the app session (amendment)
  auth.spec.ts
```

`features/auth` imports no other feature. The bridge in `app/` is where the session meets the Query client, the realtime manager, the router and spec 07's guest-cart id, so features stay decoupled (spec 00 §3 rules).

## 3. Session controller (`features/auth/model/session.ts`)

```ts
type SessionState =
  | { status: 'restoring' }                                                     // only before `ready` resolves
  | { status: 'guest'; lastSignOut: 'logout' | 'expired' | 'other-tab' | null }
  | { status: 'authenticated'; token: string; expiresAt: string; user: User; verifiedAt: number | null }

interface SessionController {
  get(): SessionState; subscribe(fn: () => void): () => void
  ready: Promise<void>                     // resolves after restore (AUTH-08)
  isAuthenticated(): boolean               // used by spec 05's favorites guard
  token(): string | null
  owner(): { kind: 'user'; userId: UserId } | { kind: 'guest' }   // matches spec 07's CartOwner
  epoch(): number; isCurrent(epoch: number): boolean
  signIn(payload: SessionPayload, via: 'login' | 'signup'): Promise<void>     // AUTH-07, AUTH-10
  signOut(reason: 'logout' | 'expired' | 'other-tab'): void                    // local only, idempotent per token
  expire(token: string): void              // AUTH-13: no-op unless token === current token
  ensureValid(): Promise<boolean>          // guard check (AUTH-13)
  updateUser(user: Partial<Pick<User, 'displayName' | 'username' | 'email' | 'avatarUrl'>>): void   // spec 08
  onSignedIn(task: (ctx: { via: 'login' | 'signup' | 'restore'; userId: UserId }) => Promise<void>): () => void
  onIdentityChange(fn: (prev: Identity, next: Identity) => void): () => void   // the bridge subscribes
}
export function useSession(): SessionState   // useSyncExternalStore
```

**Storage** (`session-storage.ts`):
- Key `kurio.session` holds JSON `SessionPayload`.
- Reads are parsed with the contract schema. An invalid value is removed.
- Every access is in try/catch. Without storage (private mode), the session lives in memory for the tab.
- Nothing else is stored: no password, no form values (AUTH-06).

**Restore** (AUTH-08), started when the module is created:
1. **No stored payload:** `guest`, and `ready` resolves.
2. **Stored payload with a past `expiresAt`:** remove it, go to `guest` with `lastSignOut: 'expired'`, and resolve `ready`.
3. **Otherwise:** call `authApi.session()` with the stored token, using the standard retry policy (`isRetryable`, 2 retries).
   - **200:** `authenticated` with the fresh user and `verifiedAt = now`. Resolve `ready`, then run the `onSignedIn` tasks with `via: 'restore'` without awaiting them.
   - **401:** remove the payload, go to `guest` with `lastSignOut: 'expired'`, and resolve `ready`.
   - **Anything else:** `authenticated` with the stored user and `verifiedAt: null`. Resolve `ready`. The next request or guard check decides.

**Identity changes.** Each transition between guest, user A and user B does four things:
- increments `epoch`;
- writes or removes storage;
- notifies `onIdentityChange` listeners synchronously;
- notifies state subscribers.

A token change for the same user (re-login) also counts, because the old token is dead.

**`signIn(payload, via)`:**
1. Set the state and fire the identity change. The bridge clears the cache and resets the socket.
2. Run the `onSignedIn` tasks in registration order, awaiting each one. Each is wrapped in try/catch: a failure is logged and the task's owner shows its own UI (AUTH-10).
3. Return. The form then navigates.

**`ensureValid()`**, called by `requireAuth`:
1. Not authenticated → `false`.
2. `expiresAt <= Date.now()` → `expire(token)`, then `false`.
3. `verifiedAt` is null or older than 60 s → `authApi.session()`:
   - 401 → `expire`, then `false`;
   - another error → `true`, since the page's own requests decide;
   - success → refresh the user and `verifiedAt`, then `true`.
4. Otherwise `true`.

The check reads `Date.now()`, so `page.clock` drives it in tests.

**Cross-tab** (AUTH-18): a `storage` event on `kurio.session`, ignored when `newValue` equals this tab's current serialized payload:
- `null` → `signOut('other-tab')` and `notify.info('Sua sessão foi encerrada em outra aba.')`;
- a valid payload with another user or token → adopt it, without running the `onSignedIn` tasks (the other tab ran them). The identity-change listener does the clearing.

**Epoch rule for later specs.** A mutation that writes to the cache in `onSuccess` captures `session.epoch()` in `onMutate`, and writes only if `session.isCurrent(epoch)`. `cancelQueries` + `clear()` already covers queries: a fetch that resolves after `clear()` lands in a detached query, not the new cache.

## 4. HTTP integration (`lib/http/auth.ts`, AUTH-09, AUTH-13)

```ts
export function installAuthInterceptors(http: AxiosInstance, p: {
  getToken(): string | null
  getGuestCartId(): string | null           // spec 06 provides (features/cart/model/guest-cart-id.ts); () => null until then
  onUnauthorized(sentToken: string): void
}): void
```

- **Request:** with a token, set `Authorization: Bearer <token>` and delete `X-Guest-Cart-Id`. Without one, set `X-Guest-Cart-Id` when present. The sent token is recorded in `config.meta.sentToken`.
- **Response error**, running after the spec 00 interceptor has produced an `ApiError`: when `status === 401`, `code` is `SESSION_EXPIRED` or `UNAUTHENTICATED`, and `sentToken` is set, call `onUnauthorized(sentToken)`. Then rethrow, so callers still see the error.
  - Login's `INVALID_CREDENTIALS` never matches.
  - A 401 for a token that is no longer current is ignored, which makes concurrent 401s idempotent.
- **`isSessionError(e)`** is exported for features. Features skip their own error toast for these errors, because the expiry flow already informs the user. The rule is one channel per event (spec 01).

## 5. Bridge (`app/session-bridge.ts`)

Created once in `app.tsx`, after `queryClient`, `router` and `realtime` exist:

```ts
installAuthInterceptors(http, { getToken: session.token, getGuestCartId: () => null /* spec 06 replaces with getGuestCartId */, onUnauthorized: (t) => session.expire(t) })
session.onIdentityChange((prev, next) => {
  void queryClient.cancelQueries(); queryClient.clear()                 // AUTH-17
  realtime.setSession(next.kind === 'user' ? { key: `user:${next.userId}`, token: next.token } : { key: 'guest', token: null })
  void router.invalidate()                                               // re-runs guards on the current location
})
session.subscribe(() => { if (expiredJustNow()) handleExpiredOnPublicRoute() })   // AUTH-15
void session.ready.then(() => realtime.setSession(...current identity))  // replaces spec 03's guest default
```

- **Protected route (AUTH-14).** `router.invalidate()` re-runs `requireAuth`, which throws the redirect with `reason: 'expired'`, because `lastSignOut === 'expired'`.
- **Public route (AUTH-15).** The guard does not fire, so the bridge shows `notify.info('Sua sessão expirou. Entre novamente para continuar.', { action: { label: 'Entrar', onClick: () => navigate({ to: '/login', search: { redirect: location.href } }) } })`.

## 6. Routing (AUTH-11, AUTH-12)

**Router context (amends spec 00 §5):** `interface RouterContext { queryClient: QueryClient; session: SessionController }`. The root route's `beforeLoad` awaits `context.session.ready`. Without a stored session it resolves at once, so first render and Lighthouse are unaffected (spec 13). With one, it costs one `auth.session` round trip before the first route renders. The router's `defaultPendingComponent` covers slow networks.

**Guards** (`model/redirects.ts`):

```ts
export async function requireAuth({ context, location }: { context: RouterContext; location: ParsedLocation }) {
  if (await context.session.ensureValid()) return
  const s = context.session.get()
  throw redirect({ to: '/login', search: { redirect: location.href, reason: s.status === 'guest' && s.lastSignOut === 'expired' ? 'expired' : undefined }, replace: true })
}
export function redirectIfAuthenticated({ context, search }) {
  if (context.session.isAuthenticated()) throw redirect({ href: search.redirect ?? '/', replace: true })
}
export function closeTarget(router: AnyRouter, redirectHref: string | undefined): string   // '/' when the target matches a route with staticData.requiresAuth
```

- **Protected routes:** `/checkout`, `/orders/$orderId`, `/profile` and `/wallets` get `beforeLoad: requireAuth` and `staticData.requiresAuth: true`. The file paths stay as spec 00 defined them, with no `_authenticated` layout, so specs 08–10 keep their route files.
- **Favorites mode:** spec 05's `?favorites=1` uses its own guard with `context.session.isAuthenticated()`. The root `beforeLoad` has already awaited `ready`, so that check is reliable.
- **Search schema (amends spec 00 §5):** `/login` and `/signup` share `authSearch = z.object({ redirect: <spec 00 schema>, reason: z.literal('expired').optional().catch(undefined) })`. Both use `beforeLoad: redirectIfAuthenticated`.
- **After success:** `router.navigate({ href: search.redirect ?? '/', replace: true })`, so Back does not return to the auth page. `location.href` keeps the search and hash, so filters, checkout step params and anchors survive the round trip.

## 7. Screens (AUTH-19 – AUTH-22)

Both routes render `AuthPage` with `mode: 'login' | 'signup'`. Shell config (spec 01): nav `home`, divider yes, mobile `bare`. One `h1` per page: visible below `lg` ("Entrar" / "Criar perfil de colecionador") and visually hidden from `lg` ("Entrar" / "Criar conta"), because the desktop tabs carry the visible label.

### Desktop (from `lg`, decision 1)

- **Panel:** `bg-surface-card`, width 500, `mt-[160px]` below the header top, centered, horizontal padding to fit 340-wide fields. A 10 px `bg-primary` bar runs along the bottom edge.
- **Close button:** top-right, `close` icon in `text-primary`, `aria-label="Fechar"`. It is a `Link` to `closeTarget(redirect)`.
- **Tabs:** `nav[aria-label="Acesso à conta"]` with two `Link`s, "Entrar" → `/login` and "Criar conta" → `/signup`, both carrying `search` through. The active one is `text-text-accent` with `aria-current="page"`; the inactive one is foreground. A 1 px `primary` vertical rule separates them, text 18.
- **Subtitle** (13, centered):
  - login: "Entre para gerenciar sua carteira, coleção e perfil de criador.";
  - sign-up: "Crie seu perfil de colecionador e conecte uma carteira quando quiser.".
- **Fields** 340 × 40 (spec 01 `Input`, `ink` background, 1 px `border`, `primary` focus border). Primary submit 340 × 44.
- **"Ou continue com" divider:** a full-width rule with centered text, then the two social buttons, 340 × 40.

### Mobile (below `lg`)

- "KURIO" wordmark: bold ~30, centered, about 150 from the top, `Link to="/"`.
- `h1` (bold 18, centered).
- Fields 358 × 50, radius `input-mobile`.
- Submit 358 × 60, radius `input-mobile`: "Entrar" / "Criar perfil".
- Same divider and social buttons.
- Footer link (`text-secondary`, accent link part):
  - "Novo na Kurio? **Crie uma conta**" → `/signup`;
  - "Já tem uma conta? **Entre**" → `/login`.

  Both keep `search`.
- Safe-area padding at the bottom.

### Fields and copy

| Form | Field | Label (visually hidden) | Placeholder | `autocomplete` |
|---|---|---|---|---|
| Login | email | E-mail | contato@email.com | `email` |
| Login | password | Senha | Digite sua senha | `current-password` |
| Sign-up | username | Nome de usuário | Nome de usuário | `username` |
| Sign-up | email | E-mail | Digite seu e-mail | `email` |
| Sign-up | password | Senha | Senha | `new-password` |
| Sign-up | confirmPassword | Confirmar senha | Confirmar senha | `new-password` |

- **Labels:** Figma shows placeholders only. Visually hidden `<label>`s give the accessible names, and the placeholders stay as drawn.
- **Password hint:** the sign-up password has a visible `FieldDescription`, "Use de 8 a 72 caracteres, com letras e números." (13, `text-secondary`). It is not in Figma, but users need the policy before they fail it. Recorded as a deviation.
- **`PasswordInput`** (spec 01): the toggle has `aria-label="Mostrar senha"` and `aria-pressed`, with the `eye-off` / `eye` icons.
- **Login extras:** "Esqueceu a senha?" sits right-aligned under the password (`UnavailableLink`, 13 accent).
- **Expired notice:** when `search.reason === 'expired'`, a spec 01 `Alert` (info, `role="status"`) above the form says "Sua sessão expirou. Entre novamente para continuar.".

### Social buttons (AUTH-20)

`SocialLoginButtons` renders two `Button variant="outline"`, using the Figma brand icons from `src/assets/social_login/{google,facebook}.svg` (colors kept, `alt=""`): "Continuar com Google" and "Continuar com Facebook". They have `aria-disabled="true"`, the spec 01 `Tooltip` "Disponível em breve" wired with `aria-describedby`, and on activation `notify.info('Disponível em breve')`. They are not in the form's submit path and send no request.

### Header user menu (AUTH-21)

This fills spec 01's header `session` input: `{ kind: 'guest' } | { kind: 'user'; displayName; avatarUrl }`.
- **Guest:** spec 01's "Entrar" button → `/login?redirect=<current href>`. On `/login` and `/signup` the current redirect is carried over instead of nesting.
- **User:** a `DropdownMenu` trigger, a ghost button with a 32 `Avatar` (image or initials) and the display name (max 160 px, truncated with `title`), `aria-label="Conta de <displayName>"`. Items:
  - "Meu perfil" → `/profile`;
  - "Carteiras" → `/wallets`;
  - "Lista de interesse" → `/?favorites=1`;
  - a separator;
  - "Sair".

  Radix provides the arrow-key navigation, `Esc` and focus return.
- **Updates:** `useSession()` drives it, so spec 08's `session.updateUser(...)` updates it without a reload.

## 8. Forms (`components/form/`, AUTH-01 – AUTH-05)

- **`useAppForm`:** built with `createFormHookContexts` and `createFormHook`. It exposes field components bound to spec 01 primitives (`TextField`, `PasswordField`) and form components (`SubmitButton`, `FormAlert`).
  - Fields render `FieldError` once the field is touched or a submit was attempted.
  - `SubmitButton` reads `isSubmitting` and shows the spec 01 loading state, disabled.
- **Validation timing:** the request schema is the form validator (Standard Schema). It runs on submit and on blur; after the first failed submit it also runs on change. This uses TanStack Form's dynamic validation (`validators.onDynamic` with `revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' })`). If that API differs in 1.33, the fallback is `onBlur` plus `onSubmit` validators and a change revalidation gated on `submissionAttempts > 0`.
- **Sign-up schema:** `SignupBody.extend({ confirmPassword: z.string() }).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })`. Only `SignupBody` fields are sent.
- **Server errors:** `applyServerErrors(form, error, { EMAIL_TAKEN: 'email', USERNAME_TAKEN: 'username' })`:
  - writes `error.fields[path]` or the mapped code's message into the field's `errorMap.onServer`;
  - a field's `onChange` listener clears its `onServer` error;
  - returns `false` when nothing mapped, and the caller then shows the `FormAlert`.
- **Focus:** after a failed client or server validation, `focusFirstInvalid(formEl)` (spec 01).
- **Login failure (AUTH-03):** `form.setFieldValue('password', '')`, then focus the password. `FormAlert` (`role="alert"`) says "E-mail ou senha incorretos.".
- **Other failures (AUTH-04):** `FormAlert` with `error.message`, which is already a pt-BR text per kind (spec 02 §6). Values stay.
- **Double submit (AUTH-05):** TanStack Form ignores `handleSubmit` while `isSubmitting`, and the button is disabled, so one request at most. The login and sign-up mutations use `mutations.retry: 0` (spec 00).
- **Success feedback:**
  - login → `announce('Você entrou como <displayName>.')`;
  - sign-up → `notify.success('Conta criada. Boas-vindas, <displayName>!')`;
  - then navigate.

## 9. Logout (`api/use-logout.ts`, AUTH-16)

`logout()`:
1. Call `authApi.logout()` with the current token, catching every error.
2. `session.signOut('logout')`. The bridge clears the cache, resets the socket and invalidates the router.
3. If the current match has `staticData.requiresAuth`, navigate to `/` with replace.
4. `notify.info('Você saiu da sua conta.')`.

Used by the header menu and by spec 08's account menu.

## 10. Testing (AUTH-23, AUTH-24)

### Unit (Vitest)

| File | Covers |
|---|---|
| `features/auth/model/session.test.ts` | Restore: none, past expiry, 200, 401, network after retries (fake timers). `signIn` runs the tasks in order and isolates a failing one. `expire` ignores a stale token and runs once for concurrent calls. The epoch increments on each identity change. `ensureValid` covers local expiry and the 60 s re-verify. Cross-tab: null, another user, and the same value ignored. A corrupt storage value is removed. |
| `lib/http/auth.test.ts` | Bearer only with a token. Guest header only without one, and never both. 401 `SESSION_EXPIRED` with the current token → `onUnauthorized` once; `INVALID_CREDENTIALS` → not called; a stale token → not called. |
| `components/form/server-errors.test.ts` | Dotted `fields` map to fields. Code mapping. An unmapped error → `false`. Editing clears `onServer`. |
| `features/auth/model/redirects.test.ts` | `closeTarget`: public redirect kept, protected → `/`, missing → `/`. `requireAuth` adds `reason=expired` only after an expiry. |

### E2E (`e2e/auth.spec.ts`, both projects, preview build)

**Helper amendment** (`e2e/support/mock.ts`, from spec 02): `loginAs(page, user)` still returns the token, and now also writes the `SessionPayload` to `localStorage['kurio.session']`, so the next navigation starts signed in. Specs 05–10 use it to skip the form.

| Test | Proves |
|---|---|
| `/signup`: fill a new user → "Criar conta" → `/`, the header shows the name, and the toast is shown. Reload → still signed in, with one `auth.session` request | AUTH-01, AUTH-07, AUTH-08, AUTH-21 |
| Sign-up with an empty submit → four field errors, focus on the first, and no `auth.signup` request. Mismatched confirm → "As senhas não coincidem.". `ana@kurio.example` → email error from the API; `anasouza` → username error | AUTH-01, AUTH-02 |
| Login with a wrong password → the alert, the password is empty and focused, and neither field is marked invalid. With `?scenario=slow`, a triple click on "Entrar" → exactly one `auth.login` | AUTH-03, AUTH-05 |
| `?scenario=offline` login → the alert, values kept, button enabled | AUTH-04 |
| Guest opens `/wallets?tab=1#x` → `/login?redirect=…` → login → `/wallets?tab=1#x`; `goBack()` does not show login. Signed in, `/login` → `/` | AUTH-11, AUTH-12 |
| `?scenario=session-short`, `page.clock.install()`, login, `runFor(61_000)` → menu "Carteiras" → login with the expired notice → login → `/wallets` | AUTH-13, AUTH-14 |
| Ana signed in on `/profile`; `expireSessions()`; reload → login with the expired notice and `redirect=/profile` | AUTH-08, AUTH-14 |
| Menu "Sair" → toast, "Entrar" in the header, URL `/`; `snapshot().sessions` has no Ana token; `/profile` → login | AUTH-16 |
| Ana signs in → sign out → Bruno signs in → the header shows Bruno, and `__mock.realtime.connections()` has one connection, for `usr_bruno` (spec 03 helper) | AUTH-17 |
| Two pages in one context, both signed in on `/profile`; "Sair" in page A → page B shows the toast and ends on login | AUTH-18 |
| "Continuar com Google", "Continuar com Facebook" and "Esqueceu a senha?" → "Disponível em breve", URL unchanged, still a guest, no `auth.*` request | AUTH-20 |
| Keyboard: `Tab` order on `/login` is email → password → toggle → "Esqueceu a senha?" → "Entrar" → Google → Facebook (plus the tabs and close before them on desktop); Enter submits. Zero serious or critical axe violations on `/login` and `/signup`, empty and with errors | AUTH-22 |

The 401-on-a-public-route toast (AUTH-15) and expiry during checkout are covered end to end where a private request exists on screen: spec 06 favorites and spec 09 checkout (CHK-28). Here they are unit-tested through the interceptor and the bridge.

## 11. Amendments to earlier specs

Applied in this spec's tasks:

| Spec | Change |
|---|---|
| 00 §5 | `RouterContext` gains `session`. The root `beforeLoad` awaits `session.ready`. `/login` and `/signup` share `authSearch`, which adds `reason`. |
| 00 §6 | `installAuthInterceptors` on the `http` instance. |
| 01 §8 | The header `session` input type (§7) and the guest "Entrar" redirect carry-over on auth pages. |
| 02 §4 | Documentation fix: the `auth.signup` error column also lists 409 `USERNAME_TAKEN` (already in §8.5 and API-29). |
| 02 §13 | The `loginAs` helper also seeds `kurio.session` (§10). |
| 03 §6 | `app.tsx`'s temporary `setSession(guest)` is replaced by the bridge. |

## 12. Figma references

| Element | Source |
|---|---|
| Desktop auth panel, tabs, subtitle, fields, divider, social buttons, × and bottom bar | `screenshots/desktop/Login.png`, `Cadastro.png`; `screens.md` → Login and sign-up; dialog pattern in "Shared observations" |
| Mobile auth pages | `screenshots/mobile/Login.png`, `Cadastro.png` |
| Header "Entrar" (guest) | Home desktop `2:2` (spec 01) |
| Signed-in header | not drawn (§13) |

## 13. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Desktop auth is a page panel**, not a modal over home: no home behind it and no scrim. The × goes to the safe `redirect` or home (decision 1).
- **Unavailable actions:** "Esqueceu a senha?" and social login show "Disponível em breve" and do nothing (decision 2).
- **Visually hidden labels** keep the placeholder-only Figma look. A password policy hint is added under the sign-up password.
- **Signed-in header:** Figma draws only "Entrar". The app shows an avatar, the display name and a menu.
- **Session policy:**
  - bearer token in `localStorage` (an HttpOnly cookie in production);
  - fixed TTL with no refresh, verified at boot and at most every 60 s on protected navigation;
  - 401 with the current token means expired;
  - sign-out is local even if the API call fails.
- **Isolation:** every identity change cancels queries, clears the whole Query cache, replaces the socket (spec 03) and bumps an epoch that guards late mutation results. Other tabs follow through the `storage` event.
- **Boot cost:** a stored session delays the first route by one `auth.session` round trip. A visit without a stored session (including Lighthouse runs) has no cost.

## 14. Implementation decisions (2026-10-28)

Decisions taken while implementing, where the design was silent or had to give way to what the code showed.

**Amendments to earlier specs (applied in those documents):**

| Spec | Change |
|---|---|
| 00 §5, §15 | `RouterContext.session`; the root `beforeLoad` awaits `session.ready`; `/login` and `/signup` share `authSearchSchema` (adds `reason`), which now lives in `features/auth/model/auth-search.ts`; `routes/-login-search.ts` and its test were replaced. |
| 00 §6 | `installAuthInterceptors` is installed on the shared `http` instance by the session bridge. |
| 00 §9 lint | `@typescript-eslint/only-throw-error` allows TanStack's `Redirect` and `NotFoundError`, so `throw redirect()` in guards is not flagged. |
| 01 §8, §12 | `DesktopHeader` takes a `userMenu` slot next to `session`. `ShellSession` keeps its `status` discriminant, and its user variant is `{ status: 'user'; name; avatarUrl? }`. The shell fills it from `useSession()`. The guest "Entrar" carries the URL's `redirect` on `/login` and `/signup`. |
| 02 §13, §15 | `loginAs` seeds `kurio.session` and waits for `window.__mock`. New helper `forgetSession`. Tests that `?reset=1` or switch scenario while a session is seeded call `forgetSession` first, because the mock drops its sessions on reset and the app would log the 401 of restoring a dead one. `mocks.spec.ts` was adjusted that way. |
| 03 §13 | `app.tsx` no longer calls `setSession({ key: 'guest' })`; the bridge does it after the restore and on every identity change. The temporary bearer interceptor in `features/dev-realtime/resources.tsx` is deleted. `/dev/realtime` reads the real session (a status line replaces the token field), and `realtime-resilience.spec.ts` signs in with `loginAs` plus a navigation instead of "Conectar com token". |

**Session**
- `createSessionController(deps)` is a factory (storage, `verify`, clock and retry delays injected), and `instance.ts` holds the singleton, as spec 03 does. Methods are declared as properties, so `session.token` and friends can be passed around unbound.
- **The restore starts in `bootApp()` (`app/boot.ts`), called by `main.tsx` after the mock worker is ready, not at import time.** The first version started it when `app.tsx` was imported, which is before `startMocks()` finishes: the `auth.session` request missed the worker and got a 404. `bootApp` is idempotent.
- A restore is not an identity change: nothing private was loaded before it, so it neither bumps the epoch nor clears the cache. The first realtime identity is set after `restore()` settles.
- Restore retries wait 300 ms and then 900 ms (not the Query defaults of 1 s and 2 s), so an offline visit with a stored session delays the first render by about 1.2 s at most.
- While the stored token is being verified, `token()` returns it (the check carries its own header). `expire()` is a no-op in that state, because the restore decides what a 401 means.
- Boot-time expiry on a **public** route is silent: the header shows "Entrar" and nothing was lost, and a toast raised before the Toaster mounts would be dropped. On a protected route the guard shows the login notice (AUTH-14).
- `IdentityChange` carries `{ prev, next, cause, redirecting }`, with `cause` one of `login`, `signup`, `logout`, `expired`, `other-tab`. `redirecting` is true when a route guard is already sending the user to login: `ensureValid` marks its own expiries, and any `expire` that lands while a guard check is running counts too. Without it, the guard check's 401 produced both the AUTH-15 toast and the AUTH-14 notice.
- Cross-tab: the same token with different user details updates the user in place (a profile edit in another tab) and is not an identity change. A value that does not parse counts as a removal.
- `signIn` runs the tasks after notifying the identity listeners, and the login and sign-up mutations include it, so the form's pending state covers the cart merge and the navigation happens afterwards.

**Bridge**
- A `login` or `signup` change neither navigates nor invalidates the router: the form navigates after the post-sign-in tasks (AUTH-10), and an invalidation would have run `redirectIfAuthenticated` first and left the page before the merge finished.
- `logout` leaves a protected route for `/` (`replace`) from the bridge, not from `useLogout`, so a sign-out in the same tab and one caused elsewhere share the code. A public route is only invalidated.
- On a protected route, `expired` and an `other-tab` sign-out navigate to `/login?redirect=<current href>` (with `reason=expired` only for expiry). The bridge navigates itself instead of relying on `router.invalidate()` to re-run the guard.
- The other-tab sign-out toast is shown for any route.

**HTTP**
- The token a failed request carried is read from `error.cause.config.headers` (the Axios error that spec 00's interceptor keeps as `cause`), not from a `config.meta` field. A 401 caused by an old token therefore never expires the new session, and concurrent 401s act once.

**Forms**
- The dynamic-validation API of the design exists in `@tanstack/react-form` 1.33.5 as written (`validators.onDynamic` with `revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' })`), so the fallback is not needed. `components/form/validation.ts` exports `formValidation()`.
- A field shows its error once it has been blurred or a submit was attempted (`useFieldMessage`), not on first touch: before a submit, validation runs on blur only, and a message left by another field's validation must stay hidden.
- **Library behavior found while testing, handled in `components/form/submit.ts`:** when the first submit finds a stale blur-time error that the user has since fixed, `handleSubmit` refuses to run with the old message. `submitForm(form)` is the shared `<form onSubmit>` body: it ignores a call while submitting (AUTH-05), clears server errors, re-validates with `form.validate('submit')`, then calls `handleSubmit`. A server error that stayed on an edited-but-unsubmitted field would block the same way, hence `clearServerErrors`.
- Server errors are stored in `errorMap.onServer` (field) and `form.errorMap.onServer` (`FormAlert`). Editing a field clears its own; `TextField` and `PasswordField` do it.
- Focus after a failed submit is a state change handled in an effect (`useFormFocus`), because the `aria-invalid` attributes exist only after the re-render.
- The sign-up schema is in `features/auth/model/signup-schema.ts` (a component file cannot export it without breaking fast refresh).

**Screens**
- One form instance serves both compositions. The desktop-only parts (close, tabs, subtitle, accent bar) and mobile-only parts (logo, visible title, footer link) are hidden with CSS. There are two `h1` elements, one per breakpoint, and only the visible one is in the accessibility tree, so each page has one `h1` at any width.
- The sign-up submit reads "Criar conta" from `lg` and "Criar perfil" below it, as in Figma, with both texts in the DOM and one hidden.
- The panel's × is an anchor built by `components/href-link.tsx` (`HrefLink`), because its target is a string with search and hash rather than a typed route. "Lista de interesse" in the menu uses it too, because `/` gets its `favorites` search from spec 05.
- Figma centers the mobile "Nome de usuário" placeholder; it is left-aligned like the other fields (recorded as a deviation).
- The mobile profile screen (spec 08) owns "Sair" on mobile. *Amended by spec 08:* the account menu has it (mobile and desktop), so the mobile project now runs the logout, user-switch and cross-tab steps through it (`signOut` helper in `auth.spec.ts`); only the steps about the header menu itself and the desktop close button stay desktop-only.
- `/dev/ui-kit` has a "Formulários" section that proves the validation timing (T01).

**Visual check 04** (50 % overlay at 1440 and 390 against `figma_tokens/screenshots/`)

| Element | Result |
|---|---|
| Desktop panel: width 500, tabs, subtitle, fields 340 × 40, button 340 × 44, divider, social buttons, accent bar | Matched. The panel sits about 10 px lower than Figma because the page header is taller than the modal's reference frame, and its min height is 600 including the bar. |
| Desktop sign-up | Matched; four fields plus the password hint make the panel taller than login (not drawn in Figma with a hint). |
| Mobile login / sign-up: logo, title, 358 × 50 fields, 358 × 60 button, divider, social buttons, footer link | Matched within 2 px vertically; the footer link sits below the fold at 390 × 844 on sign-up, as the page is longer than the frame with the hint. |
| Field surface | Figma fields are `ink` with a 1 px `border` inside the card, so the auth fields override the default `surface-dark` fill. |

> Amended by spec 05 (2026-10-28): the favorites guard calls `requireAuth` from `beforeLoad` only when `favorites` is set, and the mobile tab bar heart now links to `/?favorites=1` as well as the footer link.
