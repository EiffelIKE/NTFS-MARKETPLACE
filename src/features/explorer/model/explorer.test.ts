import { describe, expect, it } from 'vitest'

import type { ExplorerTransaction } from '@/contracts'

import { explorerView } from './explorer'

const tx: ExplorerTransaction = {
  hash: `0x${'ab'.repeat(32)}`,
  network: 'polygon',
  explorerName: 'Polygonscan',
  status: 'confirmed',
  blockNumber: 58_123_456,
  timestamp: '2026-09-20T15:30:03.000Z',
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '2.223',
  networkFee: '0.016',
  items: [
    { name: 'Sage Nomad #009', tokenId: '#0009', editionLabel: '1/10', quantity: 1 },
    { name: 'Golden Signal #160', tokenId: '#0160', editionLabel: 'ABERTA', quantity: 2 },
  ],
}

describe('explorerView', () => {
  it('formats the public transaction for the page', () => {
    const view = explorerView(tx)
    expect(view).toMatchObject({
      hash: tx.hash,
      network: 'Polygon',
      explorerName: 'Polygonscan',
      status: { value: 'confirmed', label: 'Confirmada' },
      block: '58.123.456',
      from: tx.from,
      to: tx.to,
      value: '2.223 ETH',
      fee: '0.016 ETH',
    })
    expect(view.time).toContain('20 de set. de 2026')
    expect(view.items.map((item) => item.quantity)).toEqual(['x 1', 'x 2'])
  })

  it('keeps a row per item even when two share a token and edition', () => {
    const same = { name: 'A', tokenId: '#1', editionLabel: '1/1', quantity: 1 }
    const keys = explorerView({ ...tx, items: [same, same] }).items.map((item) => item.key)
    expect(new Set(keys).size).toBe(2)
  })

  it('labels every status', () => {
    expect(explorerView({ ...tx, status: 'pending' }).status.label).toBe('Pendente')
    expect(explorerView({ ...tx, status: 'declined' }).status.label).toBe('Recusada')
  })
})
