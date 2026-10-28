import { z } from 'zod'

import {
  WALLET_PROVIDER_LABELS,
  WalletFields,
  type NetworkId,
  type Wallet,
  type WalletProvider,
} from '@/contracts'

/** Network options. The ids are the contract's; the labels match `networks.list`. */
export const NETWORK_OPTIONS: readonly { value: NetworkId; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'solana', label: 'Solana' },
]

export const PROVIDER_OPTIONS = (
  Object.entries(WALLET_PROVIDER_LABELS) as [WalletProvider, string][]
).map(([value, label]) => ({ value, label }))

/** What the inputs hold: every value is text, and a select that is not chosen yet is `''`. */
const WalletFormValuesSchema = z.object({
  displayName: z.string(),
  nickname: z.string(),
  network: z.string(),
  profileName: z.string(),
  address: z.string(),
  alternateWallet: z.string(),
  provider: z.string(),
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
})

export type WalletFormValues = z.infer<typeof WalletFormValuesSchema>

/**
 * The inputs as the API schema reads them. An empty optional field is absent, and an unchosen
 * select stays `''`, which the contract's enum rejects with "Selecione ...".
 */
function toWalletInput(values: WalletFormValues): z.input<typeof WalletFields> {
  const { alternateWallet, network, provider, ...rest } = values
  return {
    ...rest,
    network: network as NetworkId,
    provider: provider as WalletProvider,
    ...(alternateWallet.trim() && { alternateWallet }),
  }
}

/**
 * The client schema is the spec 02 `WalletFields`, address and network rule included (ACC-17), so
 * the form and the mock API give the same messages and the same field for each failure.
 */
export const WalletFormSchema = WalletFormValuesSchema.transform(toWalletInput).pipe(WalletFields)

export const EMPTY_WALLET_VALUES: WalletFormValues = {
  displayName: '',
  nickname: '',
  network: '',
  profileName: '',
  address: '',
  alternateWallet: '',
  provider: '',
  referralCode: '',
  email: '',
  ensName: '',
}

export function walletDefaults(wallet?: Wallet): WalletFormValues {
  if (!wallet) return EMPTY_WALLET_VALUES
  return {
    displayName: wallet.displayName,
    nickname: wallet.nickname,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    alternateWallet: wallet.alternateWallet ?? '',
    provider: wallet.provider,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: wallet.ensName,
  }
}

/** The fields "Igual à carteira principal" copies (ACC-18). The address would always collide. */
export const COPIED_FIELDS = [
  'displayName',
  'profileName',
  'network',
  'provider',
  'referralCode',
  'email',
  'ensName',
] as const satisfies readonly (keyof WalletFormValues)[]

export type CopiedField = (typeof COPIED_FIELDS)[number]

/** The primary's values for the copied fields; nickname, address and alternate stay empty. */
export function copyFromPrimary(primary: Wallet): Pick<WalletFormValues, CopiedField> {
  const values = walletDefaults(primary)
  return {
    displayName: values.displayName,
    profileName: values.profileName,
    network: values.network,
    provider: values.provider,
    referralCode: values.referralCode,
    email: values.email,
    ensName: values.ensName,
  }
}

/** The placeholder of the address field follows the chosen network. */
export function addressPlaceholder(network: string): string {
  return network === 'solana' ? 'Endereço Solana da carteira' : 'Endereço 0x da carteira'
}
