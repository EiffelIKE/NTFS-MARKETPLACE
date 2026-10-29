import { setupServer } from 'msw/node'

import { env } from '@/lib/env'

import { createControl } from './control'
import type { MockControl } from './control-types'
import { createHandlers } from './handlers'
import type { AvatarProcessor } from './lib/images'
import { createRuntime, type MockRuntime } from './runtime'
import { createMemoryStorage, type StorageAdapter } from './db/store'

interface MockServerOptions {
  /** Defaults to an in-memory `Map`, so every server starts from the seed. */
  storage?: StorageAdapter
  /** Defaults to `VITE_API_BASE_URL`, which must be absolute in Node. */
  baseUrl?: string
  processAvatar?: AvatarProcessor
}

export interface MockServer {
  server: ReturnType<typeof setupServer>
  runtime: MockRuntime
  control: MockControl
}

/** The same handlers as the browser worker, on `msw/node`, for Vitest (contract tests). */
export function createMockServer(options: MockServerOptions = {}): MockServer {
  const runtime = createRuntime({
    storage: options.storage ?? createMemoryStorage(),
    baseUrl: options.baseUrl ?? env.VITE_API_BASE_URL,
    ...(options.processAvatar && { processAvatar: options.processAvatar }),
  })
  const server = setupServer(...createHandlers(runtime))
  return { server, runtime, control: createControl(runtime) }
}
