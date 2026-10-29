// Validate the environment before anything else renders (fail fast).
import '@/lib/env'
import '@/styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { bootApp } from '@/app/boot'
import { BootError } from '@/app/boot-error'
import { holdBackendUntil } from '@/lib/backend-ready'
import { takeMockUrlParams } from '@/mocks/url-params'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// Starts the mock API without blocking the first render (spec 13 §5): the shell paints while the
// mock chunk downloads, and every request waits on `holdBackendUntil`. `vite.config.ts` writes the
// parsed flag back as a literal, so with `VITE_ENABLE_MOCKS=false` this branch folds away and no
// mocks/ chunk is emitted (spec 02 §3).
function startBackend(onLost: (error: unknown) => void): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return Promise.resolve()
  // The URL is cleaned before the router first renders.
  const params = takeMockUrlParams()
  // User Timing marks put the mock layer's boot cost in every Lighthouse report (spec 13, PERF-13).
  performance.mark('kurio:mocks-start')
  const ready = import('@/mocks/browser')
    .then(({ startMocks }) => {
      performance.mark('kurio:mocks-loaded')
      return startMocks(params, { onLost })
    })
    .then(() => {
      performance.mark('kurio:mocks-ready')
      performance.measure('kurio:mocks-chunk', 'kurio:mocks-start', 'kurio:mocks-loaded')
      performance.measure('kurio:mocks-worker', 'kurio:mocks-loaded', 'kurio:mocks-ready')
      performance.measure('kurio:mocks', 'kurio:mocks-start', 'kurio:mocks-ready')
    })
  holdBackendUntil(ready)
  return ready
}

const root = createRoot(container)
const showBootError = (error: unknown) => {
  root.render(<BootError error={error} />)
}
const backend = startBackend(showBootError)
bootApp()
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// With no API behind it the app must not pretend to work: replace it with the error screen. The
// start always settles (`mocks/browser.ts`), so neither a hung worker nor a gone one leaves the
// shell waiting forever.
backend.catch(showBootError)
