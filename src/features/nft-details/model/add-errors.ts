import type { EditionId } from '@/contracts'
import { isApiError } from '@/lib/http/errors'
import { isSessionError } from '@/lib/http/auth'

export const SOLD_OUT_MESSAGE = 'Esta edição esgotou. Escolha outra edição.'
export const CART_FULL_MESSAGE = 'Você já tem o máximo desta edição no carrinho.'
export const ADD_FAILED_MESSAGE = 'Não foi possível adicionar ao carrinho.'

/** How the screen reacts to a failed `cart.addItem` (spec 06 design §7, DET-18). */
export type AddErrorOutcome =
  /** Refetch the NFT and say the edition sold out. */
  | { kind: 'sold-out'; message: string }
  /** Refetch, then clamp the quantity to what remains. */
  | { kind: 'limit'; message: string; remaining: number }
  /** The NFT is gone: refetch, which leads to the 404 view. */
  | { kind: 'not-found' }
  /** Spec 04's expiry flow is already running; nothing to add. */
  | { kind: 'session' }
  /** Anything else: an error toast that retries the same request. */
  | { kind: 'failed'; message: string }

export function remainingMessage(remaining: number): string {
  if (remaining <= 0) return CART_FULL_MESSAGE
  return remaining === 1
    ? 'Resta apenas 1 unidade desta edição.'
    : `Restam apenas ${String(remaining)} unidades desta edição.`
}

/**
 * `inCart` is what the cart already held of this edition: the API reports the line's limit, and
 * what is left to add is that limit minus the units in the cart.
 */
export function describeAddError(
  error: unknown,
  target: { nftId: string; editionId: EditionId; inCart: number },
): AddErrorOutcome {
  if (isApiError(error, 'EDITION_UNAVAILABLE'))
    return { kind: 'sold-out', message: SOLD_OUT_MESSAGE }
  if (isApiError(error, 'INSUFFICIENT_AVAILABILITY')) {
    const { lines } = error.details
    const line =
      lines.find((l) => l.nftId === target.nftId && l.editionId === target.editionId) ?? lines[0]
    const remaining = Math.max(0, (line?.available ?? 0) - target.inCart)
    return { kind: 'limit', message: remainingMessage(remaining), remaining }
  }
  if (isApiError(error, 'NOT_FOUND')) return { kind: 'not-found' }
  if (isSessionError(error)) return { kind: 'session' }
  return { kind: 'failed', message: ADD_FAILED_MESSAGE }
}
