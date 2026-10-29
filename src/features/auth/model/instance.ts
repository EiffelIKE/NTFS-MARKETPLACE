import { authApi } from '@/api'

import { createSessionController } from './session'
import { createSessionStorage } from './session-storage'

/** The tab's one session (AUTH-07). The bridge in `app/` starts the restore. */
export const session = createSessionController({
  storage: createSessionStorage(),
  verify: () => authApi.session(),
})
