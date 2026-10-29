import { setupWorker } from 'msw/browser'

import { env } from '@/lib/env'
import {
  MOCK_WORKER_URL,
  bootWithRecovery,
  browserRecovery,
  hasOrphanedRegistration,
  pingMock,
  unregisterMockWorkers,
  watchMockWorker,
  type MockBootError,
} from '@/lib/mock-recovery'

import { isScenarioId } from './config'
import { createControl } from './control'
import type { MockControl } from './control-types'
import { createBrowserStorage, DB_KEY, PANEL_KEY } from './db/store'
import { createHandlers, healthPath } from './handlers'
import { createRuntime } from './runtime'
import type { MockUrlParams } from './url-params'

declare global {
  interface Window {
    __mock?: MockControl
  }
}

async function showPanel(runtime: ReturnType<typeof createRuntime>, open: boolean) {
  const { mountPanel } = await import('./panel/mount')
  mountPanel(runtime, { open })
}

function hasLauncherFlag(): boolean {
  try {
    return sessionStorage.getItem(PANEL_KEY) === '1'
  } catch {
    return false
  }
}

interface StartHooks {
  /** The worker went away after a successful boot and could not be brought back. */
  onLost?: (error: MockBootError) => void
}

/**
 * Starts the mock API (spec 02 §3): runtime, service worker, `window.__mock`, settlement timer and
 * (when asked for) the panel. `params` come from `takeMockUrlParams()`, read before the first
 * render. The app renders while this runs and holds its requests until it resolves
 * (`lib/backend-ready.ts`). It always settles (spec 13, SW boot recovery): the worker start has a
 * deadline, a started worker must prove it intercepts, and a failure unregisters the stale
 * registrations and reloads once. It rejects when that is not enough, so the bootstrap shows an
 * error instead of calling a backend that does not exist or waiting forever.
 */
export async function startMocks(params: MockUrlParams, hooks: StartHooks = {}): Promise<void> {
  const runtime = createRuntime({ storage: createBrowserStorage(), baseUrl: env.VITE_API_BASE_URL })

  if (params.scenario !== null && !isScenarioId(params.scenario)) {
    console.warn(
      `[mock] unknown scenario "${params.scenario}", keeping "${runtime.config.scenarioId()}"`,
    )
  } else if (params.scenario !== null && params.scenario !== runtime.config.scenarioId()) {
    runtime.useScenario(params.scenario)
  } else if (params.reset) {
    runtime.reset()
  }

  const healthUrl = `${runtime.baseUrl}${healthPath}`
  const ping = () => pingMock(healthUrl)

  await bootWithRecovery({
    start: async () => {
      // A registration that does not control this page (a hard reload, a worker the browser
      // dropped) would make MSW reload and wait for a controller that may never come: replace it
      // with a fresh one in this load.
      if (await hasOrphanedRegistration()) await unregisterMockWorkers()
      const worker = setupWorker(...createHandlers(runtime))
      await worker.start({
        serviceWorker: { url: MOCK_WORKER_URL },
        quiet: import.meta.env.PROD,
        // Anything outside the API base (assets, fonts) goes straight to the network.
        onUnhandledRequest: 'bypass',
      })
    },
    ping,
    recover: browserRecovery,
  })

  watchMockWorker({
    ping,
    onLost: (error) => hooks.onLost?.(error),
  })

  window.__mock = createControl(runtime)
  runtime.settlement.arm()
  // Domain changes now reach connected sockets as events (spec 03).
  runtime.realtime.start()

  // Another tab wrote the database: last write wins (domain changes publish only where they happen).
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY) runtime.store.load()
  })

  window.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.code === 'KeyM') void showPanel(runtime, true)
  })
  if (params.panel) void showPanel(runtime, true)
  else if (hasLauncherFlag()) void showPanel(runtime, false)
}
