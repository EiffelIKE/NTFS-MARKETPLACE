import { z } from 'zod'

import {
  CollectorDetails,
  CreateOrderBody,
  NetworkId,
  WalletProvider,
  networkFamily,
  type Order,
  type Profile,
  type Wallet,
} from '@/contracts'
import { ApiError } from '@/lib/http/errors'

/**
 * The checkout form (spec 09 design §4). Values are plain text so inputs stay controlled; the
 * rules are the contract's: each field reuses the schema of `CollectorDetails`, and the order body
 * is parsed with `CreateOrderBody` at the end, so the client never sends what the API refuses.
 * The form is flat (`walletAddress`, not `collector.walletAddress`), so API `fields` map by name.
 */
const COLLECTOR = CollectorDetails.shape

export const CheckoutFormSchema = z.object({
  walletId: z.string().min(1, 'Selecione uma carteira.'),
  provider: WalletProvider,
  network: NetworkId,
  displayName: COLLECTOR.displayName,
  username: COLLECTOR.username,
  profileName: COLLECTOR.profileName,
  email: COLLECTOR.email,
  ensName: COLLECTOR.ensName,
  referralCode: COLLECTOR.referralCode,
  walletAddress: COLLECTOR.walletAddress,
  /** Optional: empty is absent, anything else follows the contract's rule. */
  alternateWallet: z.string().superRefine((value, ctx) => {
    if (value.trim() === '') return
    const parsed = COLLECTOR.alternateWallet.safeParse(value)
    if (!parsed.success) {
      ctx.addIssue({
        code: 'custom',
        message: parsed.error.issues[0]?.message ?? 'Valor inválido.',
      })
    }
  }),
  note: CreateOrderBody.shape.note.unwrap(),
})

export type CheckoutValues = z.input<typeof CheckoutFormSchema>
export type CheckoutField = keyof CheckoutValues

/** What a wallet fills in (CHK-06); the user's edits to these survive a wallet switch. */
export const WALLET_FIELDS = [
  'profileName',
  'alternateWallet',
  'referralCode',
  'provider',
  'network',
] as const satisfies readonly CheckoutField[]

/** The wallet checkout opens with: the primary one, else the secondary (design §4). */
export function defaultWallet(wallets: readonly Wallet[]): Wallet | undefined {
  return wallets.find((wallet) => wallet.role === 'primary') ?? wallets[0]
}

/** What a wallet fills in: the payment side of the form. */
function walletValues(wallet: Wallet) {
  return {
    walletId: wallet.id,
    provider: wallet.provider,
    network: wallet.network,
    profileName: wallet.profileName,
    walletAddress: wallet.address,
    alternateWallet: wallet.alternateWallet ?? '',
    referralCode: wallet.referralCode,
  } satisfies Partial<CheckoutValues>
}

/** The profile fills the person, the wallet fills the payment (CHK-06). */
export function prefill(profile: Profile, wallet: Wallet): CheckoutValues {
  return {
    displayName: profile.displayName,
    username: profile.username,
    email: profile.email,
    ensName: profile.ensName ?? '',
    note: '',
    ...walletValues(wallet),
  }
}

/** What a wallet suggests: the values the form holds for it until the user edits them. */
export function walletBaseline(baseline: CheckoutValues, wallet: Wallet): CheckoutValues {
  return { ...baseline, ...walletValues(wallet) }
}

/**
 * The values a wallet switch changes (CHK-10, CHK-06): the address always, and every wallet field
 * the user did not edit, meaning the one still equal to what the previous wallet suggested
 * (`baseline`). An edited network that the new wallet cannot use goes back to the wallet's own,
 * since an EVM address cannot pay on Solana (CHK-11).
 */
export function walletSwitchPatch(
  wallet: Wallet,
  current: CheckoutValues,
  baseline: CheckoutValues,
): Partial<CheckoutValues> {
  const fresh = walletValues(wallet)
  const patch: Partial<CheckoutValues> = {
    walletId: fresh.walletId,
    walletAddress: fresh.walletAddress,
  }
  for (const field of WALLET_FIELDS) {
    if (current[field] === baseline[field]) Object.assign(patch, { [field]: fresh[field] })
  }
  const network = patch.network ?? current.network
  if (networkFamily(network) !== wallet.family) patch.network = wallet.network
  return patch
}

/** `CreateOrderBody` for the form's values and the quote the user reviewed (CHK-18, CHK-23). */
export function toCreateOrderBody(values: CheckoutValues, quoteId: string): CreateOrderBody {
  const alternateWallet = values.alternateWallet.trim()
  const note = values.note.trim()
  return CreateOrderBody.parse({
    quoteId,
    walletId: values.walletId,
    provider: values.provider,
    network: values.network,
    collector: {
      displayName: values.displayName,
      username: values.username,
      profileName: values.profileName,
      email: values.email,
      ensName: values.ensName,
      referralCode: values.referralCode,
      walletAddress: values.walletAddress,
      ...(alternateWallet && { alternateWallet }),
    },
    ...(note && { note }),
  })
}

/** The form's values for an order's data: a declined attempt reopens as the user filled it. */
export function valuesFromOrder(
  order: Pick<Order, 'wallet' | 'network' | 'collector' | 'note'>,
): CheckoutValues {
  const { collector } = order
  return {
    walletId: order.wallet.id,
    provider: order.wallet.provider,
    network: order.network,
    displayName: collector.displayName,
    username: collector.username,
    profileName: collector.profileName,
    email: collector.email,
    ensName: collector.ensName,
    referralCode: collector.referralCode,
    walletAddress: collector.walletAddress,
    alternateWallet: collector.alternateWallet ?? '',
    note: order.note ?? '',
  }
}

export interface MappedServerFields {
  /** The same error with `collector.<f>` rewritten to `<f>`, for the form layer (CHK-08). */
  error: ApiError
  /** Messages for keys the form has no input for; they go to the form-level alert. */
  unmapped: string[]
}

/** Splits an API `VALIDATION_FAILED` by what the form can show next to a field. */
export function mapServerFields(
  error: ApiError,
  formFields: readonly string[],
): MappedServerFields {
  const fields: Record<string, string[]> = {}
  const unmapped: string[] = []
  for (const [path, messages] of Object.entries(error.fields ?? {})) {
    const name = path.startsWith('collector.') ? path.slice('collector.'.length) : path
    const first = messages[0]
    if (!first) continue
    if (formFields.includes(name)) fields[name] = messages
    else unmapped.push(first)
  }
  return {
    error: new ApiError('http', error.message, {
      status: error.status,
      code: error.code,
      fields,
    }),
    unmapped,
  }
}
