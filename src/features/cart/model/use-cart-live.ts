import { useEffect, useRef } from 'react'

import { announce } from '@/components/feedback'
import type { Cart } from '@/contracts'
import { useRealtimeEvent } from '@/lib/realtime'

import { announcementsFor, emptyNoticeMemory, type NoticeMemory } from './line-notices'
import { useCartOwner } from './use-cart'

/**
 * Live price and availability while the cart is open (spec 07 design §7, CART-19, CART-22).
 *
 * - Refreshing the cart on `nft.updated` is not done here: `bootApp` does it for the whole session
 *   (R1), so a change that lands while the page is not mounted is not missed. This hook only
 *   remembers the NFT version of the last event per line, for the announcement key.
 * - Each cart that arrives is compared with the previous one, and a line whose notice changed is
 *   announced once through the polite region (the notice itself has no toast: one channel).
 */
export function useCartLive(cart: Cart | undefined): void {
  const owner = useCartOwner()
  const versions = useRef(new Map<string, number>())
  const memory = useRef<{ owner: string; value: NoticeMemory }>({
    owner: '',
    value: emptyNoticeMemory(),
  })

  useRealtimeEvent(
    'nft.updated',
    (event) => {
      versions.current.set(event.resource.id, event.version)
    },
    { known: true },
  )

  const ownerId = owner.kind === 'user' ? owner.userId : 'guest'
  useEffect(() => {
    if (!cart) return
    // Another owner's cart starts from a clean baseline.
    if (memory.current.owner !== ownerId)
      memory.current = { owner: ownerId, value: emptyNoticeMemory() }
    const { messages, memory: next } = announcementsFor(
      cart,
      memory.current.value,
      versions.current,
    )
    memory.current.value = next
    // One announcement per cart: the region keeps only the last message of a frame.
    if (messages.length > 0) announce(messages.join(' '), 'polite')
  }, [cart, ownerId])
}
