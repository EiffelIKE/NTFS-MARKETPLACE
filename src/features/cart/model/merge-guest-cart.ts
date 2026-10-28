import type { QueryClient } from '@tanstack/react-query'

import { cartApi } from '@/api'
import { notify } from '@/components/feedback'
import type { Cart, CartMergeResult } from '@/contracts'
import type { SessionController, SignedInTask } from '@/features/auth/model/session'
import { nftDetailQuery } from '@/features/catalog/api/queries'

import { applyCart } from '../api/apply-cart'
import { cartKeys, type CartOwner } from '../api/cart-keys'
import { clearGuestCartId, getGuestCartId } from './guest-cart-id'

type Adjustment = CartMergeResult['adjustments'][number]

export const MERGE_TITLE = 'Carrinho ajustado ao entrar'

export interface MergeDeps {
  queryClient: QueryClient
  session: Pick<SessionController, 'epoch' | 'isCurrent'>
  merge?: (guestCartId: string) => Promise<CartMergeResult>
  /** Shows the single toast; replaced in tests. */
  report?: (title: string, lines: string[]) => void
}

/** The line a merge adjustment is about, named the way the cart names it. */
async function describeAdjustment(
  adjustment: Adjustment,
  cart: Cart,
  queryClient: QueryClient,
): Promise<string> {
  const line = cart.items.find(
    (item) => item.nftId === adjustment.nftId && item.editionId === adjustment.editionId,
  )
  let label = line ? `${line.name} (${line.editionLabel})` : null
  if (!label) {
    // A line that did not make it into the cart: ask the catalog for its name.
    try {
      const nft = await queryClient.query(nftDetailQuery(adjustment.nftId))
      const edition = nft.editions.find((candidate) => candidate.id === adjustment.editionId)
      label = edition ? `${nft.name} (${edition.label})` : nft.name
    } catch {
      label = adjustment.nftId
    }
  }
  if (adjustment.reason === 'unavailable') return `${label}: indisponível, não foi adicionado`
  return line
    ? `${label}: quantidade ajustada para ${String(line.quantity)}`
    : `${label}: acima do limite, não foi adicionado`
}

/**
 * The post-sign-in task that moves the guest's cart into the user's (CART-04, spec 07 design §4):
 *
 * 1. No stored guest cart id: nothing to do.
 * 2. `cart.merge` once; on success the id is cleared (the guest cart no longer exists), the merged
 *    cart is written under the user's key and every adjusted line is reported in one toast.
 * 3. On failure the id stays and the next session start (restore, or the next sign-in) retries.
 *    A 401 is spec 04's to handle.
 *
 * Runs before the form navigates, so landing on `/checkout` after `?redirect=` sees the merged
 * cart. Calls that overlap share one request.
 */
export function createMergeGuestCartTask(deps: MergeDeps): SignedInTask {
  const { queryClient, session } = deps
  const merge = deps.merge ?? ((id: string) => cartApi.merge(id))
  const report =
    deps.report ?? ((title, lines) => notify.info(title, { description: lines.join('\n') }))
  let running: Promise<void> | null = null

  const run = async (userId: string): Promise<void> => {
    const guestCartId = getGuestCartId()
    if (guestCartId === null) return
    const epoch = session.epoch()
    let result: CartMergeResult
    try {
      result = await merge(guestCartId)
    } catch {
      return
    }
    // The guest cart is gone server side whatever happened to the session meanwhile.
    clearGuestCartId()
    if (!session.isCurrent(epoch)) return

    const owner: CartOwner = { kind: 'user', userId }
    applyCart(queryClient, owner, result.cart)
    queryClient.removeQueries({ queryKey: cartKeys.detail({ kind: 'guest' }) })
    if (result.adjustments.length === 0) return
    const lines = await Promise.all(
      result.adjustments.map((adjustment) =>
        describeAdjustment(adjustment, result.cart, queryClient),
      ),
    )
    report(MERGE_TITLE, lines)
  }

  return ({ userId }) => {
    running ??= run(userId).finally(() => {
      running = null
    })
    return running
  }
}
