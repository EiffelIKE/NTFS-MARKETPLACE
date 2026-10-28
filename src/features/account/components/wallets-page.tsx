import { LoadingRegion } from '@/components/loading-region'

import { useWallets } from '../model/use-account'
import { AccountLayout } from './account-layout'
import { LoadError, WalletsSkeleton } from './account-states'
import { WalletSlot } from './wallet-slot'

/** "Carteiras" (spec 08 design §6, §8). The `h1` is hidden: the top bar and the sections name it. */
export function WalletsPage() {
  const wallets = useWallets()
  const items = wallets.data?.items
  const primary = items?.find((wallet) => wallet.role === 'primary')
  const secondary = items?.find((wallet) => wallet.role === 'secondary')

  return (
    <AccountLayout current="wallets">
      <LoadingRegion loading={wallets.isPending} label="Carregando carteiras">
        <h1 className="sr-only">Carteiras</h1>
        {items ? (
          <div className="flex flex-col gap-10">
            <WalletSlot kind="primary" wallet={primary} primary={primary} />
            <WalletSlot kind="secondary" wallet={secondary} primary={primary} />
          </div>
        ) : wallets.isError ? (
          <LoadError
            message={wallets.error.message}
            onRetry={() => {
              void wallets.refetch()
            }}
          />
        ) : (
          <WalletsSkeleton />
        )}
      </LoadingRegion>
    </AccountLayout>
  )
}
