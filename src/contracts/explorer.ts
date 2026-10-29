import { z } from 'zod'

import { Eth, IsoDateTime, NetworkId } from './common'

/** What an explorer shows of a transaction. Only an order with a recorded hash ever has one. */
export const ExplorerTxStatus = z.enum(['confirmed', 'pending', 'declined'])
export type ExplorerTxStatus = z.infer<typeof ExplorerTxStatus>

/**
 * The public, "on-chain" view of a simulated transaction (spec 10 amendment). It carries only what
 * a real chain would expose: the payer wallet address and the tokens moved, never the collector's
 * name, e-mail or any other profile data.
 */
export const ExplorerTransaction = z.object({
  hash: z.string(),
  network: NetworkId,
  /** "Etherscan", "Polygonscan" or "Solscan": simulated labels, not the real services. */
  explorerName: z.string(),
  status: ExplorerTxStatus,
  /** Deterministic, derived from the hash. */
  blockNumber: z.int(),
  timestamp: IsoDateTime,
  /** The payer wallet address. */
  from: z.string(),
  /** A fictitious marketplace contract. */
  to: z.string(),
  /** What the contract received: the order total without the network fee. */
  value: Eth,
  networkFee: Eth,
  items: z.array(
    z.object({
      name: z.string(),
      tokenId: z.string(),
      editionLabel: z.string(),
      quantity: z.int(),
    }),
  ),
})
export type ExplorerTransaction = z.infer<typeof ExplorerTransaction>
