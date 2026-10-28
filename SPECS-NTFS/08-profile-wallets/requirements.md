# 08 — Profile & wallets · Requirements

> Status: Done (mobile layout decided at the start of the implementation; see Decisions and design §14)

Build the collector account screens: "Perfil do Colecionador" (profile details, avatar, password change) and "Carteiras" (primary and secondary wallet slots), both private, on top of the spec 02 profile and wallet operations. Desktop follows the Figma frames; mobile has no frame and follows the composition of design §8.

Brief coverage: §3 (Collector profile, Wallets; both must work on mobile), §3.4 (validation including API errors, persistence after refresh, no plaintext passwords), §4 (states, per-user isolation), §8 (responsiveness, accessibility), §9 (E2E scenario 8).

## User stories

- **US-1** — As a collector, I edit my display name, username, email, ENS name and wallet nickname, and my changes are still there after a refresh.
- **US-2** — As a collector, I upload or remove an avatar and see it in the header right away.
- **US-3** — As a collector, I change my password by confirming the current one, and other devices are signed out.
- **US-4** — As a collector, I register and edit a primary and a secondary wallet with an address that fits the chosen network, so checkout can use them.
- **US-5** — As a collector on a phone, I can do all of the above without a desktop.

## Acceptance criteria

### Access and navigation

- **ACC-01** — THE SYSTEM SHALL serve `/profile` and `/wallets` only to signed-in users; a guest SHALL be sent to `/login?redirect=<path>` by spec 04's guard and come back after login.
- **ACC-02** — THE SYSTEM SHALL show the "Meu perfil" account menu on both screens with the Figma items. "Dados do perfil" → `/profile`, "Carteiras" → `/wallets`, "Lista de interesse" → `/?favorites=1`, "Sair" → spec 04 logout. "Atividade", "Ofertas", "Arquivos baixados" and "Suporte" SHALL be unavailable links (spec 01) that never fake a destination. The current item SHALL carry `aria-current="page"` and the Figma active bar.

### Profile details

- **ACC-03** — WHEN `/profile` opens, THE SYSTEM SHALL load `profile.get` and fill "Nome de exibição", "Nome de usuário", "E-mail", "Nome ENS" (with a fixed `.eth` suffix) and "Apelido da carteira". Empty values (new accounts) SHALL show empty fields.
- **ACC-04** — WHEN "Salvar" is pressed, THE SYSTEM SHALL validate every profile field on the client with the spec 02 `UpdateProfileBody` schema (all fields required, as Figma marks them) and, when valid and changed, send `profile.update`.
- **ACC-05** — WHEN the API returns 422 `VALIDATION_FAILED`, 409 `USERNAME_TAKEN` or 409 `EMAIL_TAKEN`, THE SYSTEM SHALL show each message on its field, keep the typed values and focus the first invalid field.
- **ACC-06** — WHEN the profile is saved, THE SYSTEM SHALL update the session user shown in the header (display name, avatar) without a reload, show "Perfil atualizado.", and show the saved values after a refresh.

### Avatar

- **ACC-07** — WHEN "Alterar" is activated, THE SYSTEM SHALL open a file picker limited to PNG, JPEG and WebP; WHEN a file is chosen, it SHALL check type and size (≤ 2 MB) on the client and upload it with `profile.uploadAvatar` immediately (not on "Salvar").
- **ACC-08** — WHEN the client check or the API (413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`) rejects the file, THE SYSTEM SHALL show the message under the avatar and keep the previous avatar.
- **ACC-09** — WHEN "Remover" is activated, THE SYSTEM SHALL call `profile.removeAvatar` and show the placeholder; "Remover" SHALL be unavailable while there is no avatar. Avatar changes SHALL reach the header without a reload.

### Password

- **ACC-10** — THE SYSTEM SHALL treat the "Alterar senha" section as optional: when all three fields are empty, "Salvar" SHALL NOT change the password. WHEN any of them is filled, all three SHALL be required, the new password SHALL follow the spec 02 policy and differ from the current one, and "Confirmar nova senha" SHALL match.
- **ACC-11** — WHEN the section is valid, THE SYSTEM SHALL send `profile.changePassword` after the profile update (if any). WHEN the API rejects the current password (422 on `currentPassword`), THE SYSTEM SHALL show it on that field.
- **ACC-12** — WHEN the password changes, THE SYSTEM SHALL clear the three fields, keep the current session, and show "Senha alterada. As outras sessões foram encerradas.". Other sessions of the user SHALL be signed out on their next request (spec 04 handles the 401).
- **ACC-13** — WHEN the profile update succeeds and the password change fails, THE SYSTEM SHALL report each outcome separately: the profile shows as saved and only the password section keeps its error.
- **ACC-14** — THE SYSTEM SHALL use spec 01's `PasswordInput` (show/hide toggle) for the three fields with `autocomplete` values `current-password` and `new-password`, and SHALL never store or log a password.

### Wallets

- **ACC-15** — WHEN `/wallets` opens, THE SYSTEM SHALL load `wallets.list` and show the "Carteira principal" and "Carteira secundária" sections with the caption "Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.".
- **ACC-16** — WHEN a slot has a wallet, THE SYSTEM SHALL show its form filled and "Salvar carteira" SHALL send `wallets.update`. WHEN the primary slot is empty, its form SHALL be open for creation. WHEN the secondary slot is empty, THE SYSTEM SHALL show "Você ainda não adicionou uma carteira secundária." and an "Adicionar" action that opens its form.
- **ACC-17** — THE SYSTEM SHALL validate the wallet form on the client with the spec 02 `WalletFields` rules: required fields as marked, "Rede" among Ethereum, Polygon and Solana, "Tipo de carteira" among MetaMask, WalletConnect and Coinbase Wallet, and "Endereço da carteira" matching the selected network's family. Changing "Rede" SHALL revalidate an address already typed.
- **ACC-18** — WHEN "Igual à carteira principal" is checked, THE SYSTEM SHALL open the secondary form prefilled with the primary's display name, profile name, network, wallet type, referral code, email and ENS name, leaving nickname, address and alternate wallet empty. It SHALL be unavailable while there is no primary wallet.
- **ACC-19** — WHEN the API returns 422, 409 `WALLET_DUPLICATE` or 409 `WALLET_ROLE_TAKEN`, THE SYSTEM SHALL show the message on the named field (or in the form for `WALLET_ROLE_TAKEN`), keep the typed values, and for `WALLET_ROLE_TAKEN` refetch the wallets so the slot switches to edit mode.
- **ACC-20** — WHEN a wallet is saved, THE SYSTEM SHALL show "Carteira salva.", keep the saved values after a refresh, and make the wallet list used by checkout (spec 09) current without a reload.

### States, layout and accessibility

- **ACC-21** — WHILE profile or wallets load, THE SYSTEM SHALL show field-shaped skeletons at the form's final size. WHEN loading fails, THE SYSTEM SHALL show an inline alert with "Tentar novamente".
- **ACC-22** — WHILE a save is in flight, THE SYSTEM SHALL disable a second submit of the same form ("Salvar" / "Salvar carteira" in `loading`), so repeated clicks send one request.
- **ACC-23** — THE SYSTEM SHALL render the desktop frames from `lg` and the mobile composition of design §8 below `lg`, with every field and action reachable at 390 and at 200 % zoom without horizontal scrolling.
- **ACC-24** — THE SYSTEM SHALL give every field a visible label, mark required fields in text as well as with the Figma `*`, and connect errors to their fields (spec 01 `Field`).

## Out of scope

- "Atividade", "Ofertas", "Arquivos baixados", "Suporte" screens (unavailable links).
- Deleting a wallet, swapping primary and secondary, wallet connection (spec 09).
- Avatar cropping UI: the image fills the circle with `object-cover`; the mock adapter already resizes it (spec 02).
- Email verification, account deletion, unsaved-changes prompts.

## Decisions (formerly open questions)

1. **Mobile layout** (no Figma frame): confirmed as proposed. `/profile` shows the account menu as a compact list at the top (with "Sair"), then the single-column form with "Salvar" at the end; `/wallets` is an inner screen ("Carteiras", back via the shared top bar) with the two slots stacked and no menu. Tablet (768) is the same with two-column fields from `md`. Details in design §8 and §14.
2. **One "Salvar" for profile and password**: kept (ACC-11, ACC-13).
3. **"Igual à carteira principal"**: a `Checkbox` with the same label (deviation from Figma's single radio).
4. **"Adicionar" on an open primary slot**: hidden while the form is visible; it only appears on an empty, closed secondary slot.
5. **Mobile logout**: "Sair" is part of the account menu on both widths (ACC-02), which is what lets the mobile E2E project run the logout and user-switch tests of spec 04.
