// Validate the environment before anything else renders (fail fast).
import '@/lib/env'
import '@/styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { bootApp } from '@/app/boot'
import { BootError } from '@/app/boot-error'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// `vite.config.ts` writes the parsed flag back as a literal, so with `VITE_ENABLE_MOCKS=false`
// this branch folds away and no mocks/ chunk is emitted (spec 02 §3).
async function prepare() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
}

function renderApp(root: HTMLElement) {
  bootApp()
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

prepare().then(
  () => {
    renderApp(container)
  },
  (error: unknown) => {
    createRoot(container).render(<BootError error={error} />)
  },
)
