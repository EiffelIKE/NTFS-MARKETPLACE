import { describe, expect, it } from 'vitest'

import type { IdentityChange } from '@/features/auth/model/session'

import { createAttemptStore, prepareAttempt } from './attempt-store'
import { purgeCheckoutData } from './checkout-privacy'
import { createDraftStore, type CheckoutDraft } from './draft-store'
import { memoryStorage } from './safe-storage'
import type { CreateOrderBody } from '@/contracts'
import { collectorFor } from '@/api/order-kit'
import { ANA_PRIMARY_ADDRESS } from '@/mocks/fixtures/users'

const body: CreateOrderBody = {
  quoteId: 'quo_1',
  walletId: 'wal_000001',
  provider: 'metamask',
  network: 'ethereum',
  collector: collectorFor(ANA_PRIMARY_ADDRESS),
}
const draft: CheckoutDraft = {
  values: {
    walletId: 'wal_000001',
    provider: 'metamask',
    network: 'ethereum',
    displayName: '',
    username: '',
    profileName: '',
    email: '',
    ensName: '',
    referralCode: '',
    walletAddress: '',
    alternateWallet: '',
    note: 'private',
  },
}

const ana = { kind: 'user', userId: 'usr_ana', token: 't1' } as const
const bruno = { kind: 'user', userId: 'usr_bruno', token: 't2' } as const
const guest = { kind: 'guest' } as const

function stores() {
  const attempt = createAttemptStore(memoryStorage())
  const draftStore = createDraftStore(memoryStorage())
  attempt.write(prepareAttempt(null, 'usr_ana', body))
  draftStore.write('usr_ana', draft)
  return { attempt, draft: draftStore }
}

const change = (
  prev: IdentityChange['prev'],
  next: IdentityChange['next'],
  cause: IdentityChange['cause'],
) => ({ prev, next, cause })

describe('purgeCheckoutData (CHK-09, CHK-28, R8)', () => {
  it('removes the previous user on an explicit sign-out, here or in another tab', () => {
    for (const cause of ['logout', 'other-tab'] as const) {
      const s = stores()
      purgeCheckoutData(change(ana, guest, cause), s)
      expect(s.attempt.read('usr_ana')).toBeNull()
      expect(s.draft.read('usr_ana')).toBeNull()
    }
  })

  it('keeps everything on an expiry, and when the same user signs in again', () => {
    const s = stores()
    purgeCheckoutData(change(ana, guest, 'expired'), s)
    expect(s.attempt.read('usr_ana')).not.toBeNull()
    purgeCheckoutData(change(guest, { ...ana, token: 't3' }, 'login'), s)
    expect(s.attempt.read('usr_ana')).not.toBeNull()
    expect(s.draft.read('usr_ana')).not.toBeNull()
  })

  it("removes the first user's data when somebody else signs in after an expiry", () => {
    const s = stores()
    purgeCheckoutData(change(ana, guest, 'expired'), s)
    purgeCheckoutData(change(guest, bruno, 'login'), s)
    expect(s.attempt.read('usr_ana')).toBeNull()
    expect(s.draft.read('usr_ana')).toBeNull()
  })
})
