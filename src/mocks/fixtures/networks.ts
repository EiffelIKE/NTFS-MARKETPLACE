import type { NetworkId, PaymentNetwork } from '@/contracts'

/** The simulated explorer is a page of this app (spec 10 amendment): links are in-app paths. */
const explorerTxPath = (id: NetworkId) => `/explorer/${id}/tx/`

/** Fixed fee per payment network, in ETH; explorer links point to the in-app simulated explorer. */
export const PAYMENT_NETWORKS: Record<NetworkId, PaymentNetwork> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    fee: '0.016',
    walletFamily: 'evm',
    explorerName: 'Etherscan',
    explorerTxUrl: explorerTxPath('ethereum'),
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    fee: '0.002',
    walletFamily: 'evm',
    explorerName: 'Polygonscan',
    explorerTxUrl: explorerTxPath('polygon'),
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    fee: '0.001',
    walletFamily: 'solana',
    explorerName: 'Solscan',
    explorerTxUrl: explorerTxPath('solana'),
  },
}

export const NETWORK_ORDER: NetworkId[] = ['ethereum', 'polygon', 'solana']

/** The fictitious marketplace contract each network's transactions are "sent to". */
export const MARKETPLACE_CONTRACTS: Record<NetworkId, string> = {
  ethereum: '0x4B1D5e0C7a93F2d86aE1b3C09D7f45a2E8c6B310',
  polygon: '0x9aE27c5D0f18B4e63Cb7A1d2F0856e3b94D7c1a2',
  solana: 'KuRiMkt7Qx3n9VbL2cYhE5sD8fRtWaJ4pZuN6xXgHm',
}
