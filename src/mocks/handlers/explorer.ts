import { NetworkId, type OperationId } from '@/contracts'

import { findTransactionOrder, toExplorerTransaction } from '../domain/explorer'
import { HttpError } from '../lib/http-error'
import { ok, op, type AnyOp } from './pipeline'

export const explorerOps = {
  'explorer.getTransaction': op({
    handle({ runtime, params }) {
      const network = NetworkId.safeParse(params.network)
      const found =
        network.success &&
        runtime.store.read((state) =>
          findTransactionOrder(state.orders, network.data, params.txHash ?? ''),
        )
      const transaction = found ? toExplorerTransaction(found) : null
      if (!transaction) throw new HttpError('NOT_FOUND', { details: { resource: 'transaction' } })
      return ok(transaction)
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
