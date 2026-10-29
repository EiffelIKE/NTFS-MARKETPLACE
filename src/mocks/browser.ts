import { setupWorker } from 'msw/browser'

import { env } from '@/lib/env'

import { isScenarioId } from './config'
import { createControl } from './control'
import type { MockControl } from './control-types'
import { createBrowserStorage, DB_KEY, PANEL_KEY } from './db/store'
import { createHandlers } from './handlers'
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

/**
 * Starts the mock API (spec 02 §3): runtime, service worker, `window.__mock`, settlement timer and
 * (when asked for) the panel. `params` come from `takeMockUrlParams()`, read before the first
 * render. The app renders while this runs and holds its requests until it resolves
 * (`lib/backend-ready.ts`). Rejects when the worker cannot start, so the bootstrap shows an error
 * instead of calling a backend that does not exist.
 */
export async function startMocks(params: MockUrlParams): Promise<void> {
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

  const worker = setupWorker(...createHandlers(runtime))
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: import.meta.env.PROD,
    // Anything outside the API base (assets, fonts) goes straight to the network.
    onUnhandledRequest: 'bypass',
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
