import { z } from 'zod'

import { Eth, NetworkId } from './common'

export const WalletFamily = z.enum(['evm', 'solana'])
export type WalletFamily = z.infer<typeof WalletFamily>

export const PaymentNetwork = z.object({
  id: NetworkId,
  name: z.string(),
  /** Fixed network fee, always in ETH (decision 3). */
  fee: Eth,
  walletFamily: WalletFamily,
  explorerName: z.string(),
  /** Template ending in `/tx/`; append the transaction hash. An in-app path (spec 10 amendment). */
  explorerTxUrl: z.string(),
})
export type PaymentNetwork = z.infer<typeof PaymentNetwork>

export const NetworkList = z.object({ items: z.array(PaymentNetwork) })
export type NetworkList = z.infer<typeof NetworkList>
