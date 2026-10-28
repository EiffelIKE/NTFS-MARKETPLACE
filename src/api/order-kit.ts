import { cartApi, walletsApi } from '@/api'
import type { CreateOrderBody, NetworkId, Quote, WalletProvider } from '@/contracts'

/** Ana's checkout form, as spec 09 prefills it from her profile and primary wallet. */
export function collectorFor(address: string) {
  return {
    displayName: 'Ana Souza',
    username: 'anasouza',
    profileName: 'Ana S.',
    email: 'ana@kurio.example',
    ensName: 'ana',
    referralCode: 'ANA-KURIO',
    walletAddress: address,
  }
}

export async function connectPrimary(
  walletId = 'wal_000001',
  provider: WalletProvider = 'metamask',
  network: NetworkId = 'ethereum',
) {
  return walletsApi.connect({ walletId, provider, network })
}

/** A valid `orders.create` body for the acting user's cart, with a fresh quote. */
export async function orderBody(overrides: Partial<CreateOrderBody> = {}): Promise<{
  body: CreateOrderBody
  quote: Quote
}> {
  const network = overrides.network ?? 'ethereum'
  const quote = await cartApi.quote(network)
  const wallets = await walletsApi.list()
  const wallet = wallets.items.find((w) => w.id === (overrides.walletId ?? 'wal_000001'))
  const body: CreateOrderBody = {
    quoteId: quote.id,
    walletId: 'wal_000001',
    provider: 'metamask',
    network,
    collector: collectorFor(wallet?.address ?? ''),
    ...overrides,
  }
  return { body, quote }
}
