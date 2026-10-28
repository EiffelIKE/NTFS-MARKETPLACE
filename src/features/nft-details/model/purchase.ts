import type { Cart, Edition, EditionId, Eth, NftDetail } from '@/contracts'
import { eth } from '@/lib/money'

// Pure rules of the details screen (spec 06 design §5). They mirror the API's own limit rule
// (`min(available ?? ∞, maxPerOrder)`, spec 02 §8), so the UI never offers what the API refuses.

/** An edition with no units left. An open edition (`available: null`) never sells out. */
export const isSoldOut = (edition: Edition): boolean => edition.available === 0

/** The most one cart line may hold of this edition. */
export function lineLimit(edition: Pick<Edition, 'available' | 'maxPerOrder'>): number {
  return Math.min(edition.available ?? Number.POSITIVE_INFINITY, edition.maxPerOrder)
}

/** Units of one edition already in the cart (the user's, or the guest's). */
export function inCartQuantity(
  cart: Pick<Cart, 'items'> | undefined,
  nftId: string,
  editionId: EditionId,
): number {
  return (cart?.items ?? [])
    .filter((item) => item.nftId === nftId && item.editionId === editionId)
    .reduce((sum, item) => sum + item.quantity, 0)
}

/** What can still be added: the line limit minus what the cart holds. */
export function addableMax(edition: Pick<Edition, 'available' | 'maxPerOrder'>, inCart: number) {
  return Math.max(0, lineLimit(edition) - inCart)
}

/**
 * The edition selected on arrival (DET-11): the requested one when it has stock, otherwise the
 * first with stock in the response's order, otherwise none.
 */
export function defaultEditionId(
  editions: readonly Edition[],
  requested?: EditionId,
): EditionId | null {
  const asked = editions.find((edition) => edition.id === requested)
  if (asked && !isSoldOut(asked)) return asked.id
  return editions.find((edition) => !isSoldOut(edition))?.id ?? null
}

/** A quantity inside `1..max`; with nothing addable it stays at 1 and the controls are disabled. */
export function clampQuantity(quantity: number, max: number): number {
  return max >= 1 ? Math.min(Math.max(quantity, 1), max) : 1
}

export interface NftDiff {
  priceChanged?: Eth
  selectedSoldOut?: true
}

/** What a newer NFT changed for the user: the price, and whether their edition sold out. */
export function diffNft(prev: NftDetail, next: NftDetail, selected: EditionId | null): NftDiff {
  const diff: NftDiff = {}
  if (eth.cmp(prev.price, next.price) !== 0) diff.priceChanged = next.price
  if (selected !== null) {
    const before = prev.editions.find((edition) => edition.id === selected)
    const after = next.editions.find((edition) => edition.id === selected)
    if (before && after && !isSoldOut(before) && isSoldOut(after)) diff.selectedSoldOut = true
  }
  return diff
}

/** "3 de 10 disponíveis · máx. 3 por pedido", with what the cart already holds appended. */
export function editionCaption(edition: Edition, inCart: number): string {
  const limit = `máx. ${String(edition.maxPerOrder)} por pedido`
  if (isSoldOut(edition)) return 'Esgotada'
  const base =
    edition.available === null
      ? `Edição aberta · ${limit}`
      : edition.supply === 1
        ? `Edição única · ${limit}`
        : `${String(edition.available)} de ${String(edition.supply ?? edition.available)} disponíveis · ${limit}`
  return inCart > 0 ? `${base} · você já tem ${String(inCart)} no carrinho` : base
}
