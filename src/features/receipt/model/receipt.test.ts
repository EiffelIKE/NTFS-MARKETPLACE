import { describe, expect, it } from 'vitest'

import type { Order } from '@/contracts'

import { explorerTarget, isReceiptOrder, receiptView } from './receipt'

const IMAGE = {
  url: '/x.webp',
  width: 10,
  height: 10,
  alt: 'x',
  srcSet: [],
} as unknown as Order['lines'][number]['image']

const order: Order = {
  id: 'ord_000001',
  status: 'confirmed',
  lines: [
    {
      nftId: 'sage-nomad-009',
      editionId: 'limited-10',
      name: 'Sage Nomad #009',
      tokenId: '#0009',
      editionLabel: '1/10',
      image: IMAGE,
      quantity: 1,
      unitPrice: '1.2',
      lineTotal: '1.2',
    },
    {
      nftId: 'golden-signal-160',
      editionId: 'open',
      name: 'Golden Signal #160',
      tokenId: '#0160',
      editionLabel: 'Aberta',
      image: IMAGE,
      quantity: 2,
      unitPrice: '0.99',
      lineTotal: '1.98',
    },
  ],
  subtotal: '3.18',
  discount: '0.318',
  networkFee: '0.016',
  total: '2.878',
  coupon: { code: 'KURIO10', kind: 'percent', value: '10', description: '10%' },
  network: 'polygon',
  wallet: {
    id: 'w1',
    role: 'primary',
    nickname: 'Principal',
    address: '0x0',
    ensName: 'ana',
    provider: 'walletconnect',
  },
  collector: {} as Order['collector'],
  note: null,
  transaction: {
    hash: `0x${'ab12cd34'.repeat(8)}`,
    explorerUrl: '/explorer/polygon/tx/0xabc',
    explorerName: 'Polygonscan',
  },
  declineReason: null,
  createdAt: '2026-07-29T12:00:00.000Z',
  updatedAt: '2026-07-29T12:00:03.000Z',
  settledAt: '2026-07-29T12:00:03.000Z',
  version: 2,
}

function confirmed(patch: Partial<Order> = {}) {
  const next = { ...order, ...patch }
  if (!isReceiptOrder(next)) throw new Error('not a receipt order')
  return next
}

describe('isReceiptOrder (RCPT-05)', () => {
  it('accepts only a confirmed order with its transaction', () => {
    expect(isReceiptOrder(order)).toBe(true)
    expect(isReceiptOrder({ ...order, status: 'pending' })).toBe(false)
    expect(isReceiptOrder({ ...order, status: 'declined' })).toBe(false)
    expect(isReceiptOrder({ ...order, transaction: null })).toBe(false)
    expect(isReceiptOrder({ ...order, settledAt: null })).toBe(false)
  })
})

describe('receiptView (RCPT-08 – RCPT-11)', () => {
  it('formats the summary band from the snapshot', () => {
    const view = receiptView(confirmed())
    expect(view.shortHash).toBe('0xab12cd…cd34')
    expect(view.hash).toBe(order.transaction?.hash)
    expect(view.date).toBe('29 de jul. de 2026')
    expect(view.total).toBe('2.878 ETH')
    expect(view.wallet).toBe('WalletConnect')
  })

  it('lists the lines as stored', () => {
    const { lines } = receiptView(confirmed())
    expect(lines.map((line) => [line.name, line.quantity, line.total])).toEqual([
      ['Sage Nomad #009', '(x 1)', '1.20 ETH'],
      ['Golden Signal #160', '(x 2)', '1.98 ETH'],
    ])
    expect(lines[0]?.tokenId).toBe('#0009')
    expect(lines[1]?.editionLabel).toBe('Aberta')
  })

  it('adds the discount row, with the coupon, only when there is a discount', () => {
    const rows = (patch?: Partial<Order>) =>
      receiptView(confirmed(patch)).totals.map((row) => [row.label, row.value])
    expect(rows()).toEqual([
      ['Subtotal', '3.18 ETH'],
      ['Desconto (KURIO10)', '-0.318 ETH'],
      ['Taxa de rede', '0.016 ETH'],
      ['Total', '2.878 ETH'],
    ])
    expect(rows({ discount: '0', coupon: null }).map(([label]) => label)).toEqual([
      'Subtotal',
      'Taxa de rede',
      'Total',
    ])
  })

  it('names the order network in the note and keeps the simulated explorer link', () => {
    const view = receiptView(confirmed())
    expect(view.note).toBe(
      'Transação confirmada na Polygon. A propriedade foi transferida para sua carteira conectada e registrada na rede.',
    )
    expect(view.explorer).toEqual({
      name: 'Polygonscan',
      target: { kind: 'internal', network: 'polygon', hash: '0xabc' },
    })
  })

  it('routes the in-app explorer path and leaves every other address external', () => {
    expect(explorerTarget('/explorer/solana/tx/0xabc')).toEqual({
      kind: 'internal',
      network: 'solana',
      hash: '0xabc',
    })
    for (const url of [
      'https://explorer.kurio.example/ethereum/tx/0xabc',
      '/explorer/bitcoin/tx/0xabc',
      '/explorer/ethereum/tx/',
      '/explorer/ethereum/tx/0xabc/extra',
    ]) {
      expect(explorerTarget(url)).toEqual({ kind: 'external', url })
    }
  })
})
