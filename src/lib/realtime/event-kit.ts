import { eventId, type EventOf } from '@/contracts'

// Event builders for the realtime unit tests.

export function nftEvent(
  version: number,
  price: string,
  overrides: Partial<EventOf<'nft.updated'>['data']> = {},
  id = 'emerald-ape-042',
): EventOf<'nft.updated'> {
  return {
    id: eventId('nft.updated', id, version),
    type: 'nft.updated',
    resource: { type: 'nft', id },
    version,
    occurredAt: '2026-10-28T12:00:00.000Z',
    data: {
      price,
      available: true,
      editions: [
        { id: 'limited-10', available: 2 },
        { id: 'open', available: null },
      ],
      ...overrides,
    },
  }
}

export function orderEvent(
  version: number,
  status: 'pending' | 'confirmed' | 'declined',
  id = 'ord_000002',
): EventOf<'order.updated'> {
  const settled = status === 'pending' ? null : '2026-10-28T12:00:00.000Z'
  return {
    id: eventId('order.updated', id, version),
    type: 'order.updated',
    resource: { type: 'order', id },
    version,
    occurredAt: '2026-10-28T12:00:00.000Z',
    data: {
      status,
      transaction:
        status === 'confirmed'
          ? { hash: '0xabc', explorerUrl: 'https://scan.example/tx/0xabc', explorerName: 'Scan' }
          : null,
      declineReason:
        status === 'declined'
          ? { code: 'PAYMENT_DECLINED', message: 'A carteira recusou o pagamento.' }
          : null,
      settledAt: settled,
      updatedAt: '2026-10-28T12:00:00.000Z',
    },
  }
}
