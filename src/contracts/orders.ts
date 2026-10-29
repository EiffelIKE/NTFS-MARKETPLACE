import { z } from 'zod'

import { Coupon } from './cart'
import { EditionId } from './catalog'
import {
  ENS_NAME,
  Email,
  EnsLabel,
  Eth,
  Image,
  IsoDateTime,
  NetworkId,
  NftId,
  ReferralCode,
  Username,
  text,
} from './common'
import { WalletAddress, WalletProvider, WalletRole } from './wallets'

/** The checkout "Perfil do colecionador" form; spec 09 prefills it from the profile and wallet. */
export const CollectorDetails = z.object({
  displayName: text(2, 40),
  username: Username,
  profileName: text(2, 40),
  email: Email,
  ensName: EnsLabel,
  referralCode: ReferralCode,
  walletAddress: WalletAddress,
  alternateWallet: z
    .string()
    .trim()
    .refine((value) => WalletAddress.safeParse(value).success || ENS_NAME.test(value), {
      error: 'Informe um endereço de carteira ou um nome ENS (.eth).',
    })
    .optional(),
})
export type CollectorDetails = z.infer<typeof CollectorDetails>

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/

export const CreateOrderBody = z.object({
  quoteId: z.string().min(1),
  walletId: z.string().min(1),
  provider: WalletProvider,
  /** Must be a network the wallet's address family supports. */
  network: NetworkId,
  collector: CollectorDetails,
  note: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional(),
})
export type CreateOrderBody = z.infer<typeof CreateOrderBody>

export const OrderStatus = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof OrderStatus>

export const OrderLine = z.object({
  nftId: NftId,
  editionId: EditionId,
  name: z.string(),
  tokenId: z.string(),
  editionLabel: z.string(),
  image: Image,
  quantity: z.int(),
  unitPrice: Eth,
  lineTotal: Eth,
})
export type OrderLine = z.infer<typeof OrderLine>

export const Order = z.object({
  id: z.string(),
  status: OrderStatus,
  /** The snapshot taken at creation; later catalog changes never alter it (API-25). */
  lines: z.array(OrderLine),
  subtotal: Eth,
  discount: Eth,
  networkFee: Eth,
  total: Eth,
  coupon: Coupon.nullable(),
  network: NetworkId,
  wallet: z.object({
    id: z.string(),
    role: WalletRole,
    nickname: z.string(),
    address: z.string(),
    ensName: z.string(),
    provider: WalletProvider,
  }),
  collector: CollectorDetails,
  note: z.string().nullable(),
  transaction: z
    .object({ hash: z.string(), explorerUrl: z.string(), explorerName: z.string() })
    .nullable(),
  declineReason: z.object({ code: z.literal('PAYMENT_DECLINED'), message: z.string() }).nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  settledAt: IsoDateTime.nullable(),
  version: z.int(),
})
export type Order = z.infer<typeof Order>

export const OrderSummary = Order.pick({
  id: true,
  status: true,
  total: true,
  network: true,
  createdAt: true,
  version: true,
}).extend({ itemCount: z.int() })
export type OrderSummary = z.infer<typeof OrderSummary>

export const OrderListQuery = z.object({ status: OrderStatus.optional() })
export type OrderListQuery = z.infer<typeof OrderListQuery>

export const OrderList = z.object({ items: z.array(OrderSummary) })
export type OrderList = z.infer<typeof OrderList>
