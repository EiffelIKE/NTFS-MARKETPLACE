import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { announce, notify } from '@/components/feedback'
import type { Cart, CartItem } from '@/contracts'
import { isSessionError } from '@/lib/http/auth'
import { isApiError } from '@/lib/http/errors'

import { cartKeys } from '../api/cart-keys'
import { useRemoveCartItem, useUpdateCartItem } from '../api/cart-mutations'
import { createQuantityQueue, type QuantityQueue, type QuantityQueueDeps } from './quantity-queue'
import { useCartOwner } from './use-cart'

export interface CartActions {
  /** The quantity a line shows: the draft while the user is editing, otherwise the server's. */
  quantityOf: (item: CartItem) => number
  setQuantity: (item: CartItem, quantity: number) => void
  /** "Ajustar quantidade": the line's limit, sent at once. */
  adjustToLimit: (item: CartItem) => void
  /** "Entendi": confirms the new unit price. */
  acknowledgePrice: (item: CartItem) => void
  remove: (item: CartItem) => void
  /** Lines with a request in flight that is not a quantity edit (their button shows `loading`). */
  isBusy: (itemId: string) => boolean
}

/** Where focus goes after a removal (CART-10): the next line's remove button, else the heading. */
export const removeButtonId = (itemId: string) => `cart-remove-${itemId}`
const IDLE: QuantityQueueDeps = {
  send: () => Promise.resolve(),
  serverQuantity: () => undefined,
  onError: () => undefined,
}

export const CART_HEADING_ID = 'cart-heading'

/**
 * Line actions of the cart screen (spec 07 design §5). Quantity edits go through the latest-value
 * queue (CART-08); removal and the two notice actions are single requests, guarded per line so a
 * second press never sends a second request. A failure restores the server's quantity, keeps the
 * line and offers a retry (CART-09); a 409 also refetches, so the new limit shows.
 */
export function useCartActions(
  cart: Cart,
  onRemoved: (removedId: string, nextId: string | null) => void,
): CartActions {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const update = useUpdateCartItem()
  const removal = useRemoveCartItem()

  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const guard = useRef(new Set<string>())
  const track = useCallback(async (itemId: string, run: () => Promise<void>) => {
    if (guard.current.has(itemId)) return
    guard.current.add(itemId)
    setBusy(new Set(guard.current))
    try {
      await run()
    } finally {
      guard.current.delete(itemId)
      setBusy(new Set(guard.current))
    }
  }, [])

  const [queue] = useState<QuantityQueue>(() => createQuantityQueue(IDLE))
  useSyncExternalStore(queue.subscribe, queue.snapshot)
  // The queue calls these long after the render that made them, so it gets the newest set each time.
  useEffect(() => {
    queue.bind({
      send: async (itemId, quantity) => {
        await update.mutateAsync({ itemId, body: { quantity } })
      },
      serverQuantity: (itemId) => cart.items.find((item) => item.id === itemId)?.quantity,
      onError: (itemId, quantity, error) => {
        // An expired session has its own flow (spec 04).
        if (isSessionError(error)) return
        if (
          isApiError(error, 'INSUFFICIENT_AVAILABILITY') ||
          isApiError(error, 'EDITION_UNAVAILABLE')
        ) {
          void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
        }
        const message = isApiError(error)
          ? error.message
          : 'Não foi possível atualizar a quantidade.'
        notify.error(message, {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              queue.set(itemId, quantity, { immediate: true })
            },
          },
        })
      },
    })
  })
  useEffect(
    () => () => {
      queue.reset()
    },
    [queue],
  )

  const remove = (item: CartItem) => {
    void track(item.id, async () => {
      const index = cart.items.findIndex((candidate) => candidate.id === item.id)
      const next = cart.items[index + 1] ?? cart.items[index - 1]
      try {
        await removal.mutateAsync(item.id)
      } catch (error) {
        if (isSessionError(error)) return
        if (isApiError(error, 'NOT_FOUND')) {
          void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
          return
        }
        notify.error(isApiError(error) ? error.message : 'Não foi possível remover o item.', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              remove(item)
            },
          },
        })
        return
      }
      queue.discard(item.id)
      announce(`${item.name} removido do carrinho`)
      onRemoved(item.id, next?.id ?? null)
    })
  }

  const acknowledgePrice = (item: CartItem) => {
    void track(item.id, async () => {
      try {
        await update.mutateAsync({ itemId: item.id, body: { acknowledgePrice: true } })
      } catch (error) {
        if (isSessionError(error)) return
        notify.error(isApiError(error) ? error.message : 'Não foi possível confirmar o preço.', {
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              acknowledgePrice(item)
            },
          },
        })
      }
    })
  }

  return {
    quantityOf: (item) => queue.draft(item.id) ?? item.quantity,
    setQuantity: (item, quantity) => {
      queue.set(item.id, quantity)
    },
    adjustToLimit: (item) => {
      queue.set(item.id, item.maxQuantity, { immediate: true })
    },
    acknowledgePrice,
    remove,
    isBusy: (itemId) => busy.has(itemId) || queue.sending(itemId),
  }
}
