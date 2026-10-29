import { describe, expect, it } from 'vitest'

import type { CartItem } from '@/contracts'

import { announcementsFor, emptyNoticeMemory, lineNotice } from './line-notices'

const item = (patch: Partial<CartItem> = {}): CartItem => ({
  id: 'ci_2',
  nftId: 'golden-beat-207',
  editionId: 'limited-50',
  name: 'Golden Beat #207',
  tokenId: '#0207',
  editionLabel: '1/50',
  image: { url: '/a.webp', alt: '', width: 250, height: 250, srcSet: [] },
  quantity: 2,
  unitPrice: '0.99',
  addedUnitPrice: '0.99',
  lineTotal: '1.98',
  available: 24,
  maxQuantity: 5,
  status: 'ok',
  ...patch,
})

describe('lineNotice (CART-20, CART-21)', () => {
  it('has no notice for an ok line', () => {
    expect(lineNotice(item())).toBeNull()
  })

  it('shows the old and the new price, and offers to acknowledge it', () => {
    expect(lineNotice(item({ status: 'price_changed', unitPrice: '1.09' }))).toEqual({
      status: 'price_changed',
      text: 'Preço atualizado: de 0.99 ETH para 1.09 ETH.',
      action: { kind: 'acknowledge', label: 'Entendi' },
    })
  })

  it('says how many remain, in the singular for one', () => {
    expect(lineNotice(item({ status: 'limited', maxQuantity: 3 }))?.text).toBe(
      'Restam apenas 3 disponíveis.',
    )
    expect(lineNotice(item({ status: 'limited', maxQuantity: 1 }))).toMatchObject({
      text: 'Resta apenas 1 disponível.',
      action: { kind: 'adjust', label: 'Ajustar quantidade' },
    })
  })

  it('marks an unavailable line as sold out and offers to remove it', () => {
    expect(lineNotice(item({ status: 'unavailable', maxQuantity: 0 }))).toMatchObject({
      text: 'Esgotado.',
      action: { kind: 'remove', label: 'Remover' },
    })
  })
})

describe('announcementsFor (CART-22)', () => {
  const cart = (items: CartItem[], version = 1) => ({ items, version })
  const none = new Map<string, number>()

  it('only sets the baseline for the first cart, even with notices on it', () => {
    const first = announcementsFor(
      cart([item({ status: 'limited', maxQuantity: 1 })]),
      emptyNoticeMemory(),
      none,
    )
    expect(first.messages).toEqual([])
    expect(first.memory.texts?.get('ci_2')).toBe('Resta apenas 1 disponível.')
  })

  it('announces a line whose notice changed, with its name, and nothing for an unchanged refetch', () => {
    const baseline = announcementsFor(cart([item()]), emptyNoticeMemory(), none).memory
    const versions = new Map([['golden-beat-207', 4]])
    const changed = announcementsFor(
      cart([item({ status: 'price_changed', unitPrice: '1.09' })], 2),
      baseline,
      versions,
    )
    expect(changed.messages).toEqual([
      'Golden Beat #207: Preço atualizado: de 0.99 ETH para 1.09 ETH.',
    ])

    const again = announcementsFor(
      cart([item({ status: 'price_changed', unitPrice: '1.09' })], 3),
      changed.memory,
      versions,
    )
    expect(again.messages).toEqual([])
  })

  it('announces a second change of the same kind (a new price) and not the same one twice', () => {
    const baseline = announcementsFor(cart([item()]), emptyNoticeMemory(), none).memory
    const first = announcementsFor(
      cart([item({ status: 'price_changed', unitPrice: '1.09' })]),
      baseline,
      new Map([['golden-beat-207', 2]]),
    )
    const second = announcementsFor(
      cart([item({ status: 'price_changed', unitPrice: '1.20' })]),
      first.memory,
      new Map([['golden-beat-207', 3]]),
    )
    expect(second.messages).toHaveLength(1)
    expect(second.messages[0]).toContain('para 1.20')
  })

  it('stays silent when a notice goes away (the user acted on it)', () => {
    const baseline = announcementsFor(
      cart([item({ status: 'limited', maxQuantity: 1 })]),
      emptyNoticeMemory(),
      none,
    ).memory
    // The baseline above is the first cart; the next one clears the notice.
    const cleared = announcementsFor(cart([item()], 2), baseline, none)
    expect(cleared.messages).toEqual([])
  })
})
