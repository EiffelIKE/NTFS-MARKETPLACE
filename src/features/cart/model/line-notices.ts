import type { Cart, CartItem } from '@/contracts'
import { formatEth } from '@/lib/money'

// What a line says when the server flags it (spec 07 design §7, CART-20 – CART-22). The line's
// `status` is the only source of truth: the client never compares prices or stock itself.

export type NoticeAction = 'acknowledge' | 'adjust' | 'remove'

export interface LineNotice {
  status: Exclude<CartItem['status'], 'ok'>
  text: string
  action: { kind: NoticeAction; label: string }
}

export function lineNotice(item: CartItem): LineNotice | null {
  switch (item.status) {
    case 'ok':
      return null
    case 'price_changed':
      return {
        status: 'price_changed',
        text: `Preço atualizado: de ${formatEth(item.addedUnitPrice)} para ${formatEth(item.unitPrice)}.`,
        action: { kind: 'acknowledge', label: 'Entendi' },
      }
    case 'limited':
      return {
        status: 'limited',
        text:
          item.maxQuantity === 1
            ? 'Resta apenas 1 disponível.'
            : `Restam apenas ${String(item.maxQuantity)} disponíveis.`,
        action: { kind: 'adjust', label: 'Ajustar quantidade' },
      }
    case 'unavailable':
      return {
        status: 'unavailable',
        text: 'Esgotado.',
        action: { kind: 'remove', label: 'Remover' },
      }
  }
}

/** Remembers what each line said, to announce only what changed (CART-22). */
export interface NoticeMemory {
  /** The notice text per line id from the previous cart; `null` before the first cart. */
  texts: ReadonlyMap<string, string | null> | null
  /** `nftId@version` keys already announced. */
  announced: Set<string>
}

export const emptyNoticeMemory = (): NoticeMemory => ({ texts: null, announced: new Set() })

export interface AnnouncementResult {
  messages: string[]
  memory: NoticeMemory
}

/**
 * The announcements a new cart calls for: one per line whose notice changed to a non-empty text,
 * once per `nftId@version` (`versions` has the NFT version of the last live event, when there was
 * one; otherwise the cart version stands in). The first cart only sets the baseline: what is on
 * screen at arrival is read from the screen, not announced.
 */
export function announcementsFor(
  cart: Pick<Cart, 'items' | 'version'>,
  memory: NoticeMemory,
  versions: ReadonlyMap<string, number>,
): AnnouncementResult {
  const texts = new Map<string, string | null>()
  const messages: string[] = []
  const announced = new Set(memory.announced)
  for (const item of cart.items) {
    const text = lineNotice(item)?.text ?? null
    texts.set(item.id, text)
    if (memory.texts === null || text === null) continue
    if (memory.texts.get(item.id) === text) continue
    const key = `${item.nftId}@${String(versions.get(item.nftId) ?? `cart-${String(cart.version)}`)}`
    if (announced.has(`${key}:${text}`)) continue
    announced.add(`${key}:${text}`)
    messages.push(`${item.name}: ${text}`)
  }
  return { messages, memory: { texts, announced } }
}

/**
 * Why a line cannot go higher (CART-07): "Disponíveis: N" when stock is the binding limit,
 * otherwise "Máximo por pedido: N". Only meaningful for a line that can be bought.
 */
export function limitText(item: Pick<CartItem, 'available' | 'maxQuantity'>): string {
  return item.available !== null && item.maxQuantity === item.available
    ? `Disponíveis: ${String(item.maxQuantity)}`
    : `Máximo por pedido: ${String(item.maxQuantity)}`
}

/** The accessible name of the line a control acts on: "Emerald Ape #042, edição 1/50". */
export const lineName = (item: Pick<CartItem, 'name' | 'editionLabel'>): string =>
  `${item.name}, edição ${item.editionLabel}`
