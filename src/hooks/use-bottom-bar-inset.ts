import * as React from 'react'

/** The property every fixed bottom bar publishes on `<html>`: how much of the viewport it covers. */
export const BOTTOM_BAR_INSET = '--bottom-bar-inset'

/**
 * Publishes the height of a bar fixed to the viewport bottom as `--bottom-bar-inset` on `<html>`
 * (spec 11, A11Y-17). Two things read it: the page's own bottom padding, so the last content stays
 * reachable above the bar, and `scroll-padding-bottom` (base.css), so a control focused with the
 * keyboard scrolls into view above the bar (WCAG 2.4.11). A bar that is not `position: fixed` at
 * the moment (short viewports make them static) covers nothing, so it publishes 0.
 */
export function useBottomBarInset(ref: React.RefObject<HTMLElement | null>) {
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const measure = () => {
      const covers = getComputedStyle(element).position === 'fixed'
      root.style.setProperty(BOTTOM_BAR_INSET, covers ? `${String(element.offsetHeight)}px` : '0px')
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // A media query can flip `position` without changing the box.
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      root.style.removeProperty(BOTTOM_BAR_INSET)
    }
  }, [ref])
}
