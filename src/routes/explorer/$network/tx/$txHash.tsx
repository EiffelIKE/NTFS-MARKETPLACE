import { createFileRoute, notFound } from '@tanstack/react-router'

import { NetworkId } from '@/contracts'
import { explorerTxQuery } from '@/features/explorer/api/explorer-queries'
import { ExplorerPage } from '@/features/explorer/components/explorer-page'
import {
  ExplorerError,
  ExplorerSkeleton,
  TransactionNotFound,
} from '@/features/explorer/components/explorer-states'
import { isApiError } from '@/lib/http/errors'

// The simulated block explorer (spec 10 amendment). Public, like a real chain: no session needed.
export const Route = createFileRoute('/explorer/$network/tx/$txHash')({
  loader: async ({ context: { queryClient }, params: { network, txHash } }) => {
    // A network that does not exist is a 404 without asking the API.
    const parsed = NetworkId.safeParse(network)
    if (!parsed.success) throw notFound()
    try {
      // `static` uses what is cached and asks (with the query's own retries) only when nothing is.
      await queryClient.query({ ...explorerTxQuery(parsed.data, txHash), staleTime: 'static' })
    } catch (error) {
      if (isApiError(error, 'NOT_FOUND')) throw notFound()
      throw error
    }
  },
  pendingComponent: ExplorerSkeleton,
  pendingMs: 150,
  pendingMinMs: 300,
  errorComponent: ExplorerError,
  notFoundComponent: TransactionNotFound,
  staticData: {
    shell: { nav: 'market', headerDivider: false, mobile: { kind: 'inner', title: 'Transação' } },
  },
  component: ExplorerPage,
})
