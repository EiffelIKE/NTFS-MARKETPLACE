// The generated tables of README.md and ARCHITECTURE.md and of their pt-BR copies (spec 14 §1, §11,
// DOC-04, DOC-09). Each one sits between `<!-- generated:NAME -->` and `<!-- /generated:NAME -->`;
// `docs.test.ts` fails when the text between the markers differs from what `renderSections()`
// produces for that file's locale, and `pnpm docs:update` (`UPDATE_DOCS=1`) rewrites it. Only the
// column headers and the prose cells are translated; code cells are identical in every locale.
import { ERROR_DEFAULTS } from '../src/contracts/errors.ts'
import {
  OPERATION_IDS,
  OPERATIONS,
  type AuthMode,
  type OperationId,
} from '../src/contracts/operations.ts'
import { SCENARIO_LIST } from '../src/mocks/scenarios.ts'

export const SECTION_NAMES = ['operations', 'errors', 'scenarios'] as const
export type SectionName = (typeof SECTION_NAMES)[number]

export const LOCALES = ['en', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]

interface OperationDoc {
  /** Request schema, or what stands in for it (query, path, header). */
  request: string
  /** Success status and schema. */
  success: string
  /** Error statuses and codes the operation can answer, besides the generic 5xx and 429. */
  errors: string
}

// Typed over every operation id: adding an operation to `OPERATIONS` fails the type check until it
// is described here, so the table cannot lose a row. Schema names are the Zod exports of
// `src/contracts/`.
const DOCS: Record<OperationId, OperationDoc> = {
  'auth.signup': {
    request: '`SignupBody`',
    success: '201 `SessionPayload`',
    errors: '422, 409 `EMAIL_TAKEN` / `USERNAME_TAKEN`',
  },
  'auth.login': {
    request: '`LoginBody`',
    success: '200 `SessionPayload`',
    errors: '422, 401 `INVALID_CREDENTIALS`',
  },
  'auth.session': { request: '—', success: '200 `SessionInfo`', errors: '401' },
  'auth.logout': { request: '—', success: '204', errors: '—' },
  'nfts.list': {
    request: '`NftListQuery`',
    success: '200 `NftListResponse`',
    errors: '422, 401 (with `favorites`)',
  },
  'nfts.get': { request: '—', success: '200 `NftDetail`', errors: '404' },
  'nfts.related': { request: '—', success: '200 `{ items: NftSummary[] }`', errors: '404' },
  'highlights.get': { request: '—', success: '200 `Highlights`', errors: '—' },
  'networks.list': { request: '—', success: '200 `{ items: PaymentNetwork[] }`', errors: '—' },
  'explorer.getTransaction': {
    request: '—',
    success: '200 `ExplorerTransaction`',
    errors: '404',
  },
  'favorites.list': { request: '—', success: '200 `{ nftIds: NftId[] }`', errors: '401' },
  'favorites.add': { request: '—', success: '204', errors: '401, 404' },
  'favorites.remove': { request: '—', success: '204', errors: '401' },
  'cart.get': { request: '—', success: '200 `Cart`', errors: '401' },
  'cart.addItem': {
    request: '`AddCartItemBody`',
    success: '200 `Cart`',
    errors: '422, 404, 409 `INSUFFICIENT_AVAILABILITY` / `EDITION_UNAVAILABLE`',
  },
  'cart.updateItem': {
    request: '`UpdateCartItemBody`',
    success: '200 `Cart`',
    errors: '422, 403, 404, 409',
  },
  'cart.removeItem': { request: '—', success: '200 `Cart`', errors: '403, 404' },
  'cart.applyCoupon': {
    request: '`{ code }`',
    success: '200 `Cart`',
    errors: '422 `COUPON_INVALID` / `COUPON_EXPIRED` / `COUPON_NOT_APPLICABLE`',
  },
  'cart.removeCoupon': { request: '—', success: '200 `Cart`', errors: '—' },
  'cart.merge': {
    request: '`{ guestCartId }`',
    success: '200 `CartMergeResult`',
    errors: '401, 422',
  },
  'quote.get': { request: 'query `network`', success: '200 `Quote`', errors: '422' },
  'orders.create': {
    request: '`CreateOrderBody` + `Idempotency-Key`',
    success: '201 `Order` (200 on replay)',
    errors:
      '401, 422, 409 `QUOTE_CHANGED` / `INSUFFICIENT_AVAILABILITY` / `IDEMPOTENCY_CONFLICT` / `ORDER_PENDING` / `WALLET_NOT_CONNECTED`',
  },
  'orders.get': { request: '—', success: '200 `Order`', errors: '401, 403, 404' },
  'orders.list': {
    request: 'query `status`',
    success: '200 `{ items: OrderSummary[] }`',
    errors: '401',
  },
  'profile.get': { request: '—', success: '200 `Profile`', errors: '401' },
  'profile.update': {
    request: '`UpdateProfileBody`',
    success: '200 `Profile`',
    errors: '401, 422, 409 `USERNAME_TAKEN` / `EMAIL_TAKEN`',
  },
  'profile.uploadAvatar': {
    request: 'multipart `file`',
    success: '200 `Profile`',
    errors: '401, 413, 415',
  },
  'profile.removeAvatar': { request: '—', success: '200 `Profile`', errors: '401' },
  'profile.changePassword': {
    request: '`ChangePasswordBody`',
    success: '204',
    errors: '401, 422',
  },
  'wallets.list': { request: '—', success: '200 `{ items: Wallet[] }`', errors: '401' },
  'wallets.create': {
    request: '`CreateWalletBody`',
    success: '201 `Wallet`',
    errors: '401, 422, 409 `WALLET_DUPLICATE` / `WALLET_ROLE_TAKEN`',
  },
  'wallets.update': {
    request: '`WalletFields`',
    success: '200 `Wallet`',
    errors: '401, 403, 404, 422, 409 `WALLET_DUPLICATE`',
  },
  'walletConnections.list': {
    request: '—',
    success: '200 `{ items: WalletConnection[] }`',
    errors: '401',
  },
  'walletConnections.connect': {
    request: '`{ walletId, provider, network }`',
    success: '201 `WalletConnection`',
    errors: '401, 403, 404, 422, 409 `WALLET_REJECTED`',
  },
  'walletConnections.disconnect': { request: '—', success: '204', errors: '401, 403, 404' },
}

// The few cells of `DOCS` that are English prose rather than code or numbers.
const DOCS_PT_BR: Partial<Record<OperationId, Partial<OperationDoc>>> = {
  'nfts.list': { errors: '422, 401 (com `favorites`)' },
  'orders.create': {
    success: '201 `Order` (200 em replay)',
  },
}

const AUTH_LABEL: Record<Locale, Record<AuthMode, string>> = {
  en: {
    none: 'none',
    optional: 'optional bearer',
    lenient: 'bearer, ignored if invalid',
    required: 'bearer',
    cart: 'bearer or guest cart id',
  },
  'pt-BR': {
    none: 'nenhuma',
    optional: 'bearer opcional',
    lenient: 'bearer, ignorado se inválido',
    required: 'bearer',
    cart: 'bearer ou id do carrinho de visitante',
  },
}

const HEADERS: Record<Locale, Record<SectionName, string[]>> = {
  en: {
    operations: ['Operation', 'Method and path', 'Auth', 'Request', 'Success', 'Errors'],
    errors: ['Code', 'Status', 'Default message (pt-BR)'],
    scenarios: ['Scenario', 'Name in the panel', 'Effect', 'Seed'],
  },
  'pt-BR': {
    operations: ['Operação', 'Método e caminho', 'Autenticação', 'Requisição', 'Sucesso', 'Erros'],
    errors: ['Código', 'Status', 'Mensagem padrão (pt-BR)'],
    scenarios: ['Cenário', 'Nome no painel', 'Efeito', 'Seed'],
  },
}

const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

function table(header: string[], rows: string[][]): string {
  const lines = [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ]
  return lines.join('\n')
}

function operations(locale: Locale): string {
  return table(
    HEADERS[locale].operations,
    OPERATION_IDS.map((id) => {
      const { method, path, auth } = OPERATIONS[id]
      const doc = { ...DOCS[id], ...(locale === 'pt-BR' ? DOCS_PT_BR[id] : undefined) }
      return [
        `\`${id}\``,
        `\`${method} ${path}\``,
        AUTH_LABEL[locale][auth],
        doc.request,
        doc.success,
        doc.errors,
      ]
    }),
  )
}

function errors(locale: Locale): string {
  return table(
    HEADERS[locale].errors,
    Object.entries(ERROR_DEFAULTS).map(([code, { status, message }]) => [
      `\`${code}\``,
      String(status),
      message,
    ]),
  )
}

function scenarios(locale: Locale): string {
  return table(
    HEADERS[locale].scenarios,
    SCENARIO_LIST.map((scenario) => [
      `\`?scenario=${scenario.id}\``,
      scenario.label,
      scenario.description,
      `\`${scenario.seed}\``,
    ]),
  )
}

/** The body of every generated section for a locale, without its marker comments. */
export function renderSections(locale: Locale = 'en'): Record<SectionName, string> {
  return { operations: operations(locale), errors: errors(locale), scenarios: scenarios(locale) }
}

export const markers = (name: SectionName) =>
  ({ open: `<!-- generated:${name} -->`, close: `<!-- /generated:${name} -->` }) as const

/** The text between a section's markers, or `null` when the document has no such section. */
export function readSection(document: string, name: SectionName): string | null {
  const { open, close } = markers(name)
  const start = document.indexOf(open)
  const end = document.indexOf(close)
  if (start === -1 || end === -1 || end < start) return null
  return document.slice(start + open.length, end).trim()
}

/** Replaces the text between a section's markers; the document is returned as is without them. */
export function writeSection(document: string, name: SectionName, body: string): string {
  const { open, close } = markers(name)
  const start = document.indexOf(open)
  const end = document.indexOf(close)
  if (start === -1 || end === -1 || end < start) return document
  return `${document.slice(0, start + open.length)}\n\n${body}\n\n${document.slice(end)}`
}
