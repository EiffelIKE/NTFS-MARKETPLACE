import { createRoot, type Root } from 'react-dom/client'

import { PANEL_KEY } from '../db/store'
import type { MockRuntime } from '../runtime'
import { MockPanel } from './mock-panel'

const ROOT_ID = 'mock-panel-root'

let root: Root | null = null
let requestOpen: (() => void) | null = null

/**
 * The panel lives in its own React root, outside the router and Query providers: app code cannot
 * reach it and it cannot reach app state (spec 02 §11). A second call only reopens it.
 */
export function mountPanel(runtime: MockRuntime, { open }: { open: boolean }): void {
  if (root) {
    if (open) requestOpen?.()
    return
  }
  const element = document.createElement('div')
  element.id = ROOT_ID
  document.body.append(element)
  root = createRoot(element)
  root.render(
    <MockPanel
      runtime={runtime}
      initialOpen={open}
      registerOpen={(fn) => {
        requestOpen = fn
      }}
      onFirstOpen={() => {
        try {
          sessionStorage.setItem(PANEL_KEY, '1')
        } catch {
          // the launcher just will not persist
        }
      }}
    />,
  )
}
