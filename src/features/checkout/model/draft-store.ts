import { z } from 'zod'

import { NetworkId, WalletProvider } from '@/contracts'

import type { CheckoutValues } from './form'
import { sessionArea, type SafeStorage } from './safe-storage'

/**
 * The form draft (CHK-09): what the user typed and chose, per user, for the browser session. It is
 * written as they type and read instead of the profile's prefill, so a refresh or a login after an
 * expiry brings the form back. Which fields the user edited is not stored: it is what differs from
 * the chosen wallet's own values. Fictitious data only; removed on logout and when an order is
 * created.
 */
export const DRAFT_PREFIX = 'kurio.checkout.draft.'
export const draftKey = (userId: string) => `${DRAFT_PREFIX}${userId}`

const DraftSchema = z.object({
  values: z.object({
    walletId: z.string(),
    provider: WalletProvider,
    network: NetworkId,
    displayName: z.string(),
    username: z.string(),
    profileName: z.string(),
    email: z.string(),
    ensName: z.string(),
    referralCode: z.string(),
    walletAddress: z.string(),
    alternateWallet: z.string(),
    note: z.string(),
  }),
})

export interface CheckoutDraft {
  values: CheckoutValues
}

export interface DraftStore {
  read(userId: string): CheckoutDraft | null
  write(userId: string, draft: CheckoutDraft): void
  clear(userId: string): void
  /** Removes the drafts of every user but `userId` (a different person signed in). */
  clearOthers(userId: string): void
}

export function createDraftStore(area: SafeStorage = sessionArea): DraftStore {
  return {
    read(userId) {
      const raw = area.get(draftKey(userId))
      if (raw === null) return null
      try {
        const parsed = DraftSchema.safeParse(JSON.parse(raw))
        if (parsed.success) return parsed.data
      } catch {
        // Falls through: a draft that does not parse is dropped.
      }
      area.remove(draftKey(userId))
      return null
    },
    write(userId, draft) {
      area.set(draftKey(userId), JSON.stringify(draft))
    },
    clear(userId) {
      area.remove(draftKey(userId))
    },
    clearOthers(userId) {
      for (const key of area.keys(DRAFT_PREFIX)) {
        if (key !== draftKey(userId)) area.remove(key)
      }
    },
  }
}

export const draftStore = createDraftStore()
