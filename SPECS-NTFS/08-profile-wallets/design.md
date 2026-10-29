# 08 — Profile & wallets · Design

> Status: Done — §8 (mobile) is final; §14 lists what changed while implementing

Implements [`requirements.md`](requirements.md). Contracts, operations, error codes and fixtures are spec 02's; the form approach (field validation with the spec 02 request schemas, mapping API `fields` onto inputs, `focusFirstInvalid`) is the one spec 04 adopts for login and sign-up.

## 1. Dependencies

None new. Uses spec 01 (`Field`, `Input`, `InputGroup`, `PasswordInput`, `Select`, `Checkbox`, `Avatar`, `Button`, `Skeleton`, `Alert`, `UnavailableLink`, toasts), spec 02 (`profileApi`, `walletsApi`, schemas `UpdateProfileBody`, `ChangePasswordBody`, `CreateWalletBody`, `WalletFields`, `isApiError`) and spec 04 (route guard, session user cache helper, logout action, form helpers).

## 2. Layout

```
src/features/account/
  api/
    account-keys.ts         # profile + wallets keys (user-scoped)
    profile-queries.ts      # profileQueryOptions
    profile-mutations.ts    # useUpdateProfile, useChangePassword, useUploadAvatar, useRemoveAvatar
    wallets-queries.ts      # walletsQueryOptions (also used by spec 09)
    wallets-mutations.ts    # useCreateWallet, useUpdateWallet
  model/
    profile-form.ts         # form schema (profile + optional password section), defaults from Profile
    wallet-form.ts          # form schema, defaults, copyFromPrimary()
    avatar-file.ts          # client type/size check (ACC-07)
  components/
    account-layout.tsx      # menu + content column
    account-nav.tsx         # "Meu perfil" menu (ACC-02)
    profile-form.tsx
    avatar-field.tsx
    password-section.tsx
    wallet-slot.tsx         # one section: header, empty state, form
    wallet-form.tsx
    account-skeleton.tsx
src/routes/profile.tsx                  # path /profile, spec 04 `requireAuth` in beforeLoad
src/routes/wallets.tsx                  # path /wallets
```

Spec 04 guards per route with `requireAuth` (no `_authenticated` layout).

> Implemented layout: `api/` as above; `model/` has `avatar-file.ts`, `profile-form.ts`, `wallet-form.ts` and `use-account.ts` (session user id, `useProfile`, `useWallets`); `components/` has `account-layout`, `account-nav`, `account-states` (skeletons, `LoadError`), `account-styles`, `avatar-field`, `profile-form`, `profile-page`, `use-wallet-form`, `wallet-fields`, `wallet-slot` and `wallets-page`. `password-section`, `wallet-form` and `account-skeleton` were folded into those (design §14).

## 3. Queries and cache

```ts
export const accountKeys = {
  profile: (userId: string) => ['account', userId, 'profile'] as const,
  wallets: (userId: string) => ['account', userId, 'wallets'] as const,
}
```

- `profileQueryOptions(userId)` and `walletsQueryOptions(userId)`: `staleTime: 60_000`. Route loaders call `ensureQueryData` without awaiting, so the skeleton shows on slow networks.
- **Writes:** every profile mutation returns `Profile` → `setQueryData(profile)` and spec 04's session helper patches the session user (`displayName`, `username`, `email`, `avatarUrl`), so the header avatar and menu update (ACC-06, ACC-09). Wallet mutations return `Wallet` → replace or insert it in the cached list by `role`, then `invalidateQueries(wallets)` in the background so spec 09 sees server truth (ACC-20).
- User scoping plus spec 04's cache clear on user switch keep one user's account data away from another's.

## 4. Profile form (`profile-form.tsx`, ACC-03 – ACC-06, ACC-10 – ACC-14)

**Fields** (desktop two-column grid as Figma; labels and `*` from Figma):

| Field | Schema source | Input |
|---|---|---|
| Nome de exibição* | `UpdateProfileBody.displayName` | `Input`, `autocomplete="nickname"` |
| Nome de usuário* | `.username` | `Input`, `autocapitalize="none"`, hint "Letras minúsculas, números e _" |
| E-mail* | `.email` | `Input type="email"`, `autocomplete="email"` |
| Nome ENS* | `.ensName` | `InputGroup`: name input + static `.eth` addon (Figma draws a select with one option; deviation) |
| Apelido da carteira* | `.walletNickname` | `Input` |
| Avatar | separate operations (§5) | `avatar-field.tsx` |
| Senha atual / Nova senha / Confirmar nova senha | `ChangePasswordBody` + client confirm | `PasswordInput` ×3 |

**Client schema (`model/profile-form.ts`)** — implemented flat, see §14.5:

```ts
const PasswordSection = z.object({ currentPassword: z.string(), newPassword: z.string(), confirmPassword: z.string() })
  .superRefine((v, ctx) => {
    const touched = v.currentPassword || v.newPassword || v.confirmPassword
    if (!touched) return
    // required × 3, ChangePasswordBody rules on newPassword, confirm === newPassword ("As senhas não coincidem."),
    // newPassword !== currentPassword ("A nova senha deve ser diferente da atual.")
  })
export const ProfileFormSchema = UpdateProfileBody.extend({ password: PasswordSection })
```

**Submit ("Salvar", one button, ACC-11, ACC-13):**

1. Validate the whole form; on failure `focusFirstInvalid` and stop.
2. If profile fields are dirty → `useUpdateProfile`. On error: map `fields`/409 codes to the fields, focus the first, stop (the password request is not sent).
3. If the password section is filled → `useChangePassword`. On error: 422 on `currentPassword` (or other `fields`) to the section; the profile part is already saved and its fields reset to the saved values, so only the section shows errors.
4. Feedback: one toast summarizing what succeeded ("Perfil atualizado.", "Senha alterada. As outras sessões foram encerradas.", or both joined). Nothing dirty → `notify.info('Nenhuma alteração para salvar.')`, no request.

The button is in `loading` from step 2 to 4 (ACC-22). A new account (Bruno, Carla) must fill "Nome ENS" and "Apelido da carteira" before the first save succeeds, since spec 02 makes `UpdateProfileBody` a full replace; the fields show the required errors, which is the intended Figma behavior.

**Error mapping:** `USERNAME_TAKEN` → `username`, `EMAIL_TAKEN` → `email` (spec 02 sets `fields`), `VALIDATION_FAILED` → `fields` by name. Unknown fields or other errors → form-level `Alert` above "Salvar" with the API message.

## 5. Avatar (`avatar-field.tsx`, ACC-07 – ACC-09)

- 50 circle `Avatar` with the image (`object-cover`) or the `EmptyImageIcon` placeholder; primary "Alterar"; text button "Remover".
- "Alterar" triggers a visually hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`.
- `avatar-file.ts` checks MIME and size before upload, with the spec 02 messages: "Envie uma imagem PNG, JPEG ou WebP." / "A imagem deve ter no máximo 2 MB.". The server check stays authoritative (magic bytes).
- While uploading: a local object-URL preview with a spinner overlay, `aria-busy` on the field, both buttons disabled. On success the server URL replaces the preview (object URL revoked); on failure the previous avatar returns and the message shows under the field (`role="alert"` via `FieldError`).
- "Remover" is `disabled` when `avatarUrl` is null; on success the placeholder shows and focus moves to "Alterar".
- Avatar changes never wait for "Salvar"; the hint under the field says "A foto é atualizada imediatamente.".

## 6. Wallets (`wallet-slot.tsx`, `wallet-form.tsx`, ACC-15 – ACC-20)

**Slot states:**

| Slot | Wallet exists | Empty |
|---|---|---|
| Principal | form filled, "Salvar carteira" → `wallets.update` | form open, empty, "Salvar carteira" → `wallets.create({ role: 'primary' })`; "Adicionar" hidden |
| Secundária | form filled → `update` | text "Você ainda não adicionou uma carteira secundária." + "Igual à carteira principal" checkbox + "Adicionar"; either opens the form (`create({ role: 'secondary' })`), with "Cancelar" to close it |

**Fields** (Figma grid): Nome de exibição* · Apelido da carteira*; Rede* (`Select` "Selecione uma rede": Ethereum, Polygon, Solana from `networks.list`) · Nome do perfil*; Endereço da carteira* (placeholder "Endereço 0x da carteira", or "Endereço Solana da carteira" when Solana is selected) · "ENS ou carteira secundária (opcional)" (visible label added, deviation: Figma shows only a placeholder); Tipo de carteira* (`Select` "Selecione uma carteira": MetaMask, WalletConnect, Coinbase Wallet) · Código de indicação*; E-mail* · Nome ENS* (`.eth` addon).

**Validation:** the client schema is spec 02's `WalletFields` with its address/network refinement (see §11 amendment). The address field revalidates when "Rede" changes (ACC-17). Referral code input upper-cases as the user types.

**"Igual à carteira principal" (`copyFromPrimary`):** copies `displayName`, `profileName`, `network`, `provider`, `referralCode`, `email`, `ensName`; leaves `nickname`, `address`, `alternateWallet` empty (copying the address would always hit `WALLET_DUPLICATE`). Unchecking clears the copied values only if the user has not edited them. `disabled` with the hint "Cadastre a carteira principal primeiro." when no primary exists.

**Errors (ACC-19):** `VALIDATION_FAILED` → `fields`; `WALLET_DUPLICATE` → the API message on `address`; `WALLET_ROLE_TAKEN` (another tab created the slot) → form-level `Alert` "Esta carteira já foi cadastrada. Atualizamos os dados." + refetch, the slot switches to edit mode with the server values; the user's typed values are lost (deviation accepted, stated in the alert).

**After save:** toast "Carteira salva."; the form resets to the returned wallet; checkout (spec 09) reads `walletsQueryOptions` and sees it.

Connections (`walletConnections.*`) are not touched here; editing a wallet's address or network does not disconnect it in this spec (spec 09 decides how a stale connection behaves).

## 7. Account menu and routes

**`account-nav.tsx`** (`nav[aria-label="Conta"]`, `surface-card`, 310 wide): title "Meu perfil"; items with spec 01 registry icons (from the Figma frame):

| Item | Icon | Target |
|---|---|---|
| Dados do perfil | `UserOutlinedIcon` | `/profile` |
| Carteiras | `LocationIcon` | `/wallets` |
| Atividade | `ShoppingOutlinedIcon` | `UnavailableLink` |
| Lista de interesse | `HeartIcon` | `/?favorites=1` (spec 05) |
| Ofertas | `ActivityIcon` | `UnavailableLink` |
| Arquivos baixados | `DownloadIcon` | `UnavailableLink` |
| Suporte | `DangerTriangleIcon` | `UnavailableLink` |
| Sair (after a rule, bold) | `LogoutIcon` | spec 04 logout (`button`) |

Active item: 6 px `primary` bar on the left + `aria-current="page"`.

**Routes:**

| Route | `head` title | `staticData.shell` (spec 01) | `h1` |
|---|---|---|---|
| `/profile` | "Meu perfil · KURIO" | `nav: 'home'`, divider, mobile tab `profile` | "Perfil do colecionador" |
| `/wallets` | "Carteiras · KURIO" | `nav: 'home'`, divider, mobile inner "Carteiras" | "Carteiras" (visually hidden on desktop; Figma's first heading is "Carteira principal", rendered as `h2`) |

## 8. Mobile and tablet (decided, no Figma frame)

- **`/profile` below `lg`:** tab bar visible (tab `profile`). Top: `h1` "Meu perfil" and the account menu as a compact `surface-card` list (same items and icons, 48 rows, chevron `ChevronRightIcon`), with "Sair" last. Below it the form in one column (`md`: two columns as desktop), the avatar field first, then the password section, then a full-width "Salvar" (gradient `primary-soft` pill as the mobile frames' primary buttons).
- **`/wallets` below `lg`:** inner top bar "Carteiras" (back → `/profile`), no tab bar. The two slot sections stacked, one-column fields, full-width "Salvar carteira" at the end of each form (not fixed, since two forms share the page).
- **Tablet (768):** the same as mobile, with two-column fields from `md`.
- Field sizes follow the mobile auth frames (358 × 50, radius ~10) for consistency with the only mobile forms Figma has.

## 9. States and accessibility

| State | Rendering |
|---|---|
| Loading | `account-skeleton.tsx`: label + field skeletons in the grid, avatar circle, button; `LoadingRegion` "Carregando perfil" / "Carregando carteiras" |
| Error | `Alert` "Não foi possível carregar seus dados." + "Tentar novamente" |
| Saving | button `loading`, fields stay editable but submit is ignored (ACC-22) |
| 401 during save | spec 04 (session expiry with resume to the same route) |

- Required fields: Figma `*` is `aria-hidden`; the label gets visually hidden "(obrigatório)" and the input `aria-required="true"` (ACC-24).
- Password toggles: `aria-label` "Mostrar senha" / "Ocultar senha" with `aria-pressed` (spec 01 `PasswordInput`).
- Wallet sections are `section` with `aria-labelledby` their `h2`.
- Toasts announce outcomes; field errors are announced through `FieldError` association plus focus.

## 10. Testing

### Unit (Vitest)

| File | Proves |
|---|---|
| `features/account/model/profile-form.test.ts` | Password section skipped when empty; any field filled → all required; mismatch and same-as-current messages; profile fields required (ACC-04, ACC-10) |
| `features/account/model/wallet-form.test.ts` | EVM address rejected for Solana and vice versa; network change revalidates; `copyFromPrimary` leaves nickname/address/alternate empty (ACC-17, ACC-18) |
| `features/account/model/avatar-file.test.ts` | GIF rejected, 2 MB + 1 byte rejected, 2 MB PNG accepted (ACC-07) |

### E2E (`e2e/account.spec.ts`, brief scenario 8; Chromium desktop + mobile projects)

Implemented as listed, plus the account menu rows, the load-failure row and the 320 / 390 / 768 / 1440 overflow row; the two-context password row became a second token (§14.14).

| Test | Proves |
|---|---|
| Guest `goto('/profile')` → `/login?redirect=%2Fprofile`; Ana logs in → back on `/profile` | ACC-01 |
| Ana: fields show seeded values; change display name → "Perfil atualizado.", header shows new name; reload → persisted | ACC-03, ACC-06 |
| Ana: username `brunolima` → `USERNAME_TAKEN` on the field, focus there; email `carla@kurio.example` → `EMAIL_TAKEN` | ACC-05 |
| Bruno: save without ENS/nickname → required errors, no request (`__mock.requests`) | ACC-04 |
| Upload a PNG fixture → header avatar changes; upload a GIF → client error, no request; `__mock.addRule` 413 on `profile.uploadAvatar` → message, previous avatar kept; "Remover" → placeholder | ACC-07 – ACC-09 |
| Wrong current password → error on "Senha atual"; mismatch confirm → client error | ACC-10, ACC-11 |
| Two contexts as Ana; change password in A → toast; B's next navigation lands on login (spec 04); A still signed in | ACC-12 |
| Display name + wrong current password in one save → profile saved, only password error shown | ACC-13 |
| Bruno `/wallets`: primary filled; secondary empty state; "Igual à carteira principal" → prefilled form; same address as primary → `WALLET_DUPLICATE`; EVM address with Solana → field error; valid Polygon address → "Carteira salva."; reload → persisted | ACC-15 – ACC-20 |
| Carla `/wallets`: primary form open and empty; secondary checkbox disabled; create primary → slot in edit mode | ACC-16, ACC-18 |
| Double click on "Salvar carteira" → one `wallets.create` request | ACC-22 |
| Scenario `slow` → skeletons, then form at the same size | ACC-21 |
| Mobile project: `/profile` menu list + form reachable; "Carteiras" row → `/wallets` with back to `/profile`; no horizontal scroll at 390 | ACC-23 |
| axe on `/profile` and `/wallets` (loaded and with errors) | ACC-24 |

## 11. Spec 02 amendments

1. **Shared address/network rule.** `contracts/wallets.ts` exports `addressMatchesNetwork(address: string, network: NetworkId): boolean` and applies it as a `superRefine` on `WalletFields` (issue path `address`, message "Endereço inválido para a rede selecionada."). The wallet handler keeps its check by parsing with the same schema, so the client form and the mock produce the same message (ACC-17). Pure function; respects the contracts lint boundary.

2. **Select messages.** `NetworkId` and `WalletProvider` in `contracts/` carry `{ error: 'Selecione uma rede.' }` and `{ error: 'Selecione uma carteira.' }`. An unchosen select is `''` in the form, so the client schema reports these messages on the select, with no client-only wording.

## 12. Figma references

- `figma_tokens/screenshots/desktop/Perfil do Colecionador.png`, `figma_tokens/screenshots/desktop/Carteiras.png`.
- `figma_tokens/screens.md` → Profile, Wallets. Mobile: no frame (§8 proposal; field style from `mobile/Login.png`, `mobile/Cadastro.png`).

## 13. Deviations and notes for `ARCHITECTURE.md` (spec 14)

- **Mobile profile and wallets** have no Figma frame; composition per §8 and §14.
- **`.eth` select** is rendered as a static suffix (one option only).
- **"Igual à carteira principal"** is a checkbox, not a single radio, and does not copy the address.
- **Unlabelled alternate wallet field** gets a visible label "ENS ou carteira secundária (opcional)".
- **"Adicionar" on the open primary form** is hidden (it would do nothing).
- **Header in the Figma frames** shows "Entrar" on private screens; the app shows the signed-in user (spec 04).
- **One "Salvar"** runs the profile update and the password change in sequence and reports each outcome.
- **Avatar** uploads immediately, separate from "Salvar"; no crop UI.

## 14. Implementation decisions (2026-10-28)

Decisions taken while implementing, where the design was silent or had to give way to what the code showed.

**Amendments to earlier specs (applied in those documents):**

| Spec | Change |
|---|---|
| 02 | `NetworkId` and `WalletProvider` have pt-BR enum messages (§11.2). |
| 04 | The mobile logout and user-switch E2E steps run through the profile screen's "Sair"; the "session the server dropped" test waits for the profile read and the socket before expiring sessions (a 401 on a read in flight made it flaky once `/profile` made requests). |
| 01 / form layer | `components/form/` gains `SelectField`, `EnsField` and `RequiredMark`; `TextField` and `PasswordField` take `required` (the Figma `*`, a hidden "(obrigatório)" and `aria-required`), and `TextField` takes `format` (the referral code is upper-cased as typed). `EnsField` is what spec 09 reuses for its ENS field. |
| 00 / 01 | `e2e/smoke.spec.ts`: `/profile` is a real screen ("Perfil do colecionador", title "Meu perfil · KURIO"). |

**Mobile and layout**
1. **Layout confirmed as §8.** `/profile` below `lg`: the menu list on top (all eight rows, chevrons on the left-aligned rows, "Sair" last), then `h1`, then the form. `/wallets` below `lg`: the existing inner top bar (back is `history.back()`, or home when there is no history, as on every inner screen) and the slots; no menu and no tab bar. Content is a 600 px column from `md` (as the cart), the Figma 310 + 28 + 862 grid from `lg`.
2. **DOM order is visual order.** The avatar field sits after "Apelido da carteira" (Figma position) on every width, instead of moving to the top on phones with CSS order, so keyboard order never differs from reading order.
3. **Headings.** `/profile` has one visible `h1` "Perfil do colecionador" on every width; "Meu perfil" is the menu's title (a paragraph in a `nav` named "Conta"). `/wallets` has a visually hidden `h1` "Carteiras" (the top bar and the section headings name the screen).
4. **Mobile controls** follow the auth screens: 50 tall fields with the 10 px mobile radius, "Salvar" and "Salvar carteira" as full-width 60 px pills. "Cancelar" is an outline button beside "Salvar carteira" (stacked on phones).

**Forms**
5. **The profile form is flat.** The password fields are top-level (`currentPassword`, `newPassword`, `confirmPassword`) in the same schema as the profile fields, not a nested `password` object, so the form layer's `applyServerErrors` (which maps `fields` by top-level name) and `focusFirstInvalid` work unchanged. The schema is `UpdateProfileBody.extend(...).superRefine(...)`; Zod 4 reports password issues together with field issues.
6. **Dirty check against the saved profile** (`profileChanged`, e-mail compared lower-cased), not form state: a save after a save sends nothing new, and an untouched form says "Nenhuma alteração para salvar." without a request. After a successful update, fields whose saved value differs (trimmed, lower-cased e-mail) are rewritten with what the server kept.
7. **Messages.** A password-only save toasts "Senha alterada. As outras sessões foram encerradas.", a profile-only one "Perfil atualizado.", both succeeding the two joined. When the profile saved and the password failed, "Perfil atualizado." is shown and the API message sits on the password field.
8. **Wallet form schema** is `WalletFormValuesSchema.transform(toWalletInput).pipe(WalletFields)`: inputs are strings, an empty alternate wallet is dropped, and the spec 02 rules (including the address and network refinement) are the only rules. The body sent is the schema's trimmed output.
9. **Wallet selects** use the `NetworkId` enum with fixed labels (Ethereum, Polygon, Solana) and `WALLET_PROVIDER_LABELS`, not `networks.list`: the list only adds fees (checkout, spec 09), and a failing extra request would block a form that does not need it.
10. **Slot state lives in the slot.** `useWalletForm` is called by `WalletSlot`, because "Igual à carteira principal" sits in the header and writes into the form before it is shown. Unchecking clears a copied value only while it still equals the copied one. A slot's form resets when its saved wallet changes (`id@updatedAt`), which is how `WALLET_ROLE_TAKEN` switches it to edit mode. That notice ("Esta carteira já foi cadastrada. Atualizamos os dados.") is local state, since the reset would clear a form-level error. "Adicionar" moves focus into the first field.
11. **Revalidating the address** when "Rede" changes calls `validateField('address', 'blur')` only if an address was typed.

**Cache**
12. **Profile writes** cancel an in-flight profile read, `setQueryData`, then patch the session user, all behind the spec 04 epoch guard (a result after a sign-out or user switch is dropped). **Wallet writes** insert the saved wallet in the cached list by role (primary first), then invalidate the list. `profileQueryOptions(userId)` and `walletsQueryOptions(userId)` are the entries spec 09 reads.
13. **Avatar** failures map 413 and 415 (by code or status) to the same texts as the client check. Removing the avatar moves focus to "Alterar" after the request settles, because the focused button is disabled while it runs.

**Tests**
14. Cross-session password test: the "other device" is a second token from `loginAs(page, 'ana', { seed: false })` in the same page. Two browser contexts would not do: each has its own mock database. Its next request answers 401 while the page's session stays.
15. On phones the toast and the fixed tab bar can cover the bottom of the page, so tests that submit twice in a row submit with Enter the second time.
