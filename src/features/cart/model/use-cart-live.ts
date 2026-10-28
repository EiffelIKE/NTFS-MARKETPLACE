import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { announce } from '@/components/feedback'
import type { Cart } from '@/contracts'
import { useRealtimeEvent } from '@/lib/realtime'

import { cartKeys } from '../api/cart-keys'
import { announcementsFor, emptyNoticeMemory, type NoticeMemory } from './line-notices'
import { useCartOwner } from './use-cart'

/**
 * Live price and availability while the cart is open (spec 07 design §7, CART-19, CART-22).
 *
 * - An `nft.updated` for an NFT in the cart refetches the cart and, through the key prefix, its
 *   quote. Spec 03 has dropped duplicate and older events and patched the catalog caches; the cart
 *   is server-owned, so it is refreshed, never patched.
 * - Each cart that arrives is compared with the previous one, and a line whose notice changed is
 *   announced once through the polite region (the notice itself has no toast: one channel).
 */
export function useCartLive(cart: Cart | undefined): void {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const versions = useRef(new Map<string, number>())
  const memory = useRef<{ owner: string; value: NoticeMemory }>({
    owner: '',
    value: emptyNoticeMemory(),
  })

  useRealtimeEvent('nft.updated', (event) => {
    const nftId = event.resource.id
    const cached = queryClient.getQueryData<Cart>(cartKeys.detail(owner))
    if (!cached?.items.some((item) => item.nftId === nftId)) return
    versions.current.set(nftId, event.version)
    void queryClient.invalidateQueries({ queryKey: cartKeys.detail(owner) })
  })

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
