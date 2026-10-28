// Validate the environment before anything else renders (fail fast).
import '@/lib/env'
import '@/styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
