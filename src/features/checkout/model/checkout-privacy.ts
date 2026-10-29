import type { IdentityChange } from '@/features/auth/model/session'

import type { AttemptStore } from './attempt-store'
import type { DraftStore } from './draft-store'

/**
 * What leaves the device when the identity changes (spec 09 design §6, R8). A draft and an attempt
 * hold personal data, so:
 *
 * - an explicit sign-out (here or in another tab) removes the previous user's;
 * - an expiry keeps them, so the same user resumes checkout after signing in again (CHK-28);
 * - whenever somebody signs in, every other user's are removed: an expiry followed by a login as a
 *   different person must not leave the first person's data behind.
 */
export function purgeCheckoutData(
  change: Pick<IdentityChange, 'prev' | 'next' | 'cause'>,
  stores: { draft: DraftStore; attempt: AttemptStore },
): void {
  if (change.prev.kind === 'user' && (change.cause === 'logout' || change.cause === 'other-tab')) {
    stores.draft.clear(change.prev.userId)
    stores.attempt.clear(change.prev.userId)
  }
  if (change.next.kind === 'user') {
    stores.draft.clearOthers(change.next.userId)
    stores.attempt.clearOthers(change.next.userId)
  }
}
