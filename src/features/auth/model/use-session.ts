import { useSyncExternalStore } from 'react'

import { session } from './instance'
import type { SessionState } from './session'

/** The session as React state; re-renders on sign-in, sign-out and profile updates. */
export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.get, session.get)
}
