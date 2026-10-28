import type { CouponRecord } from '../db/state'

export const COUPONS: CouponRecord[] = [
  {
    code: 'KURIO10',
    kind: 'percent',
    value: '10',
    expiresAt: '2027-12-31T23:59:59.000Z',
    description: '10% de desconto no subtotal',
  },
  {
    code: 'COLECAO05',
    kind: 'fixed',
    value: '0.05',
    minSubtotal: '0.50',
    expiresAt: '2027-12-31T23:59:59.000Z',
    description: '0.05 ETH de desconto em compras a partir de 0.50 ETH',
  },
  {
    code: 'VERAO25',
    kind: 'percent',
    value: '25',
    expiresAt: '2026-03-31T23:59:59.000Z',
    description: '25% de desconto de verão',
  },
]
