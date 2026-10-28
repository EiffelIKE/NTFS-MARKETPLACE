import type { OperationId } from '@/contracts'

import { NETWORK_ORDER, PAYMENT_NETWORKS } from '../fixtures/networks'
import { ok, op, type AnyOp } from './pipeline'

export const networkOps = {
  'networks.list': op({
    handle: () => ok({ items: NETWORK_ORDER.map((id) => PAYMENT_NETWORKS[id]) }),
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
