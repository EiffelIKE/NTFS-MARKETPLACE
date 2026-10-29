import type { IsoDateTime } from '@/contracts'

import type { UserRecord, WalletRecord } from '../db/state'
import { evmAddress } from './addresses'

// PBKDF2 hashes made with `scripts/hash-password.mjs`; `fixtures.test.ts` verifies each against
// `credentials.ts`, so a changed password without a new hash fails the suite.

const CREATED: IsoDateTime = '2026-05-10T12:00:00.000Z'

export const USERS: UserRecord[] = [
  {
    id: 'usr_ana',
    username: 'anasouza',
    displayName: 'Ana Souza',
    email: 'ana@kurio.example',
    avatarUrl: null,
    ensName: 'ana',
    walletNickname: 'Carteira principal',
    createdAt: CREATED,
    passwordHash:
      'pbkdf2-sha256$100000$XNQWbvq6YJN3Ivak9BUL2g==$RVvJk4nLnKF7iTCDhuumAO4EJUil5ZGGQUX+VostPtM=',
  },
  {
    id: 'usr_bruno',
    username: 'brunolima',
    displayName: 'Bruno Lima',
    email: 'bruno@kurio.example',
    avatarUrl: null,
    ensName: null,
    walletNickname: null,
    createdAt: CREATED,
    passwordHash:
      'pbkdf2-sha256$100000$BoKuCbfIrlRmepYs0Gq66Q==$bFlH0T6wjdKX9VQ4Zh9PqhpeqzZAnCTxazAlRs3JmmA=',
  },
  {
    id: 'usr_carla',
    username: 'carlamendes',
    displayName: 'Carla Mendes',
    email: 'carla@kurio.example',
    avatarUrl: null,
    ensName: null,
    walletNickname: null,
    createdAt: CREATED,
    passwordHash:
      'pbkdf2-sha256$100000$JIx+KOoOyryckJ0BfO/xOA==$pXGQMHC2S/vvhzl/KAbuWOKkoVjIXr+ysXvV+nSA72g=',
  },
]

export const ANA_PRIMARY_ADDRESS = evmAddress('A91F', 'E82C')

export const WALLETS: WalletRecord[] = [
  {
    id: 'wal_000001',
    userId: 'usr_ana',
    role: 'primary',
    family: 'evm',
    displayName: 'Ana Souza',
    nickname: 'Carteira principal',
    network: 'ethereum',
    profileName: 'Ana S.',
    address: ANA_PRIMARY_ADDRESS,
    provider: 'metamask',
    referralCode: 'ANA-KURIO',
    email: 'ana@kurio.example',
    ensName: 'ana',
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'wal_000002',
    userId: 'usr_ana',
    role: 'secondary',
    family: 'evm',
    displayName: 'Ana Souza',
    nickname: 'Carteira Polygon',
    network: 'polygon',
    profileName: 'Ana S.',
    address: evmAddress('5C3D', '7B10'),
    alternateWallet: 'nova.kurio.eth',
    provider: 'coinbase',
    referralCode: 'ANA-NOVA',
    email: 'ana@kurio.example',
    ensName: 'ana',
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'wal_000003',
    userId: 'usr_bruno',
    role: 'primary',
    family: 'evm',
    displayName: 'Bruno Lima',
    nickname: 'Carteira do Bruno',
    network: 'polygon',
    profileName: 'Bruno L.',
    address: evmAddress('B20B', '4D1A'),
    provider: 'walletconnect',
    referralCode: 'BRUNO-01',
    email: 'bruno@kurio.example',
    ensName: 'bruno',
    createdAt: CREATED,
    updatedAt: CREATED,
  },
]
