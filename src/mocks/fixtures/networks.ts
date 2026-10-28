import type { NetworkId, PaymentNetwork } from '@/contracts'

const EXPLORER_BASE = 'https://explorer.kurio.example'

/** Fixed fee per payment network, in ETH; explorer links use a reserved domain (never resolves). */
export const PAYMENT_NETWORKS: Record<NetworkId, PaymentNetwork> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    fee: '0.016',
    walletFamily: 'evm',
    explorerName: 'Etherscan',
    explorerTxUrl: `${EXPLORER_BASE}/ethereum/tx/`,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    fee: '0.002',
    walletFamily: 'evm',
    explorerName: 'Polygonscan',
    explorerTxUrl: `${EXPLORER_BASE}/polygon/tx/`,
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    fee: '0.001',
    walletFamily: 'solana',
    explorerName: 'Solscan',
    explorerTxUrl: `${EXPLORER_BASE}/solana/tx/`,
  },
}

export const NETWORK_ORDER: NetworkId[] = ['ethereum', 'polygon', 'solana']
