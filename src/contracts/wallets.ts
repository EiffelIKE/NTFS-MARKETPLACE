import { z } from 'zod'

import {
  ENS_NAME,
  EnsLabel,
  Email,
  EVM_ADDRESS,
  INVALID_ADDRESS,
  IsoDateTime,
  NetworkId,
  ReferralCode,
  SOLANA_ADDRESS,
  text,
} from './common'
import { WalletFamily } from './networks'

export const WalletProvider = z.enum(['metamask', 'walletconnect', 'coinbase'], {
  error: 'Selecione uma carteira.',
})
export type WalletProvider = z.infer<typeof WalletProvider>

export const WALLET_PROVIDER_LABELS: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const WalletRole = z.enum(['primary', 'secondary'])
export type WalletRole = z.infer<typeof WalletRole>

/** The wallet family a network belongs to: EVM for Ethereum and Polygon, Solana for Solana. */
export function networkFamily(network: NetworkId): WalletFamily {
  return network === 'solana' ? 'solana' : 'evm'
}

/** The family an address belongs to, or `null` when it is neither EVM nor Solana. */
export function addressFamily(address: string): WalletFamily | null {
  if (EVM_ADDRESS.test(address)) return 'evm'
  if (SOLANA_ADDRESS.test(address)) return 'solana'
  return null
}

/** Whether `address` is valid for `network`'s address family (API-27). */
export function addressMatchesNetwork(address: string, network: NetworkId): boolean {
  return addressFamily(address) === networkFamily(network)
}

export const WalletAddress = z
  .string({ error: 'Informe o endereço da carteira.' })
  .trim()
  .min(1, 'Informe o endereço da carteira.')
  .refine((value) => addressFamily(value) !== null, { error: INVALID_ADDRESS })

/** Another wallet of any family, or an ENS name. */
export const AlternateWallet = z
  .string()
  .trim()
  .refine((value) => addressFamily(value) !== null || ENS_NAME.test(value), {
    error: 'Informe um endereço de carteira ou um nome ENS (.eth).',
  })

const WalletFieldsShape = z.object({
  displayName: text(2, 40),
  nickname: text(1, 32),
  network: NetworkId,
  profileName: text(2, 40),
  address: WalletAddress,
  alternateWallet: AlternateWallet.optional(),
  provider: WalletProvider,
  referralCode: ReferralCode,
  email: Email,
  ensName: EnsLabel,
})

interface AddressFields {
  address: string
  network: NetworkId
}

/** The address must belong to the family of the chosen network. */
function checkAddressNetwork(fields: AddressFields, ctx: z.RefinementCtx) {
  if (
    addressFamily(fields.address) !== null &&
    !addressMatchesNetwork(fields.address, fields.network)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['address'],
      message: 'Endereço inválido para a rede selecionada.',
    })
  }
}

export const WalletFields = WalletFieldsShape.superRefine(checkAddressNetwork)
export type WalletFields = z.infer<typeof WalletFields>

export const CreateWalletBody = WalletFieldsShape.extend({ role: WalletRole }).superRefine(
  checkAddressNetwork,
)
export type CreateWalletBody = z.infer<typeof CreateWalletBody>

export const Wallet = WalletFieldsShape.extend({
  id: z.string(),
  role: WalletRole,
  /** Derived from the address. */
  family: WalletFamily,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Wallet = z.infer<typeof Wallet>

export const WalletList = z.object({ items: z.array(Wallet) })
export type WalletList = z.infer<typeof WalletList>

export const ConnectWalletBody = z.object({
  walletId: z.string().min(1),
  provider: WalletProvider,
  network: NetworkId,
})
export type ConnectWalletBody = z.infer<typeof ConnectWalletBody>

export const WalletConnection = z.object({
  id: z.string(),
  walletId: z.string(),
  provider: WalletProvider,
  network: NetworkId,
  status: z.enum(['connected', 'disconnected']),
  connectedAt: IsoDateTime,
  disconnectedAt: IsoDateTime.nullable(),
})
export type WalletConnection = z.infer<typeof WalletConnection>

export const WalletConnectionList = z.object({ items: z.array(WalletConnection) })
export type WalletConnectionList = z.infer<typeof WalletConnectionList>
