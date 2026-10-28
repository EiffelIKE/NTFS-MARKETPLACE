import { useRouter } from '@tanstack/react-router'
import * as React from 'react'

// How long a page may take to show its `h1` after the route rendered (a loader-less page that
// reads its data in components), counted in frames.
const MAX_FRAMES = 90

/**
 * After an in-app navigation to another path, moves focus to the new page's `h1` (spec 11,
 * A11Y-07): the clicked link is gone or no longer where the user is, and a screen reader would
 * otherwise stay silent about the new page. Left alone on purpose:
 * - the first load (the skip link is the first stop) and search-param or hash changes on the same
 *   path (filters, sort, pagination, `#mercado`), which are not a new page;
 * - a page that already took focus itself (cart heading, receipt, a dialog) or the user's own
 *   move in the meantime;
 * - scrolling: `preventScroll` leaves the router's scroll restoration in charge.
 */
export function useRouteFocus() {
  const router = useRouter()
  React.useEffect(() => {
    let frame = 0
    const cancel = () => {
      cancelAnimationFrame(frame)
    }
    const unsubscribe = router.subscribe('onRendered', (event) => {
      cancel()
      if (!event.fromLocation || !event.pathChanged) return
      let waited = 0
      const tryFocus = () => {
        const active = document.activeElement
        // Something inside the page (or an overlay) already has focus: not ours to take.
        if (active && active !== document.body && !active.closest('header, nav')) return
        const heading = document.querySelector<HTMLElement>('main h1')
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
          heading.focus({ preventScroll: true })
          return
        }
        if (++waited < MAX_FRAMES) frame = requestAnimationFrame(tryFocus)
      }
      frame = requestAnimationFrame(tryFocus)
    })
    return () => {
      cancel()
      unsubscribe()
    }
  }, [router])
}
