import * as React from 'react'

import { slideAt } from '../model/slides'

/** How long a smooth scroll may keep the slider from reporting the slides it passes. */
const GLIDE_MS = 800

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * State of a slide track. `index` is the slide the owner wants on screen: the track jumps there on
 * mount and whenever it changes to a slide the track is not already on. `onChange` gets the slide
 * the user (or `show`) lands on, so keep it stable. With `smooth`, `show` glides unless the user
 * prefers reduced motion; the slides it passes on the way are not reported.
 */
export function useSlideTrack({
  count,
  index,
  smooth = false,
  onChange,
}: {
  count: number
  index: number
  smooth?: boolean
  onChange?: ((index: number) => void) | undefined
}) {
  const track = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState(index)
  const gliding = React.useRef<{ to: number; timer: number } | null>(null)

  const stopGliding = React.useCallback(() => {
    if (gliding.current) window.clearTimeout(gliding.current.timer)
    gliding.current = null
  }, [])

  // Before paint, so the dialog never flashes its first slide.
  React.useLayoutEffect(() => {
    const root = track.current
    if (!root || slideAt(root.scrollLeft, root.clientWidth, count) === index) return
    root.scrollTo({ left: index * root.clientWidth, behavior: 'instant' })
  }, [count, index])

  React.useEffect(() => {
    const root = track.current
    if (!root || count < 2) return
    const update = () => {
      const next = slideAt(root.scrollLeft, root.clientWidth, count)
      if (gliding.current) {
        if (next !== gliding.current.to) return
        stopGliding()
      }
      setActive(next)
      onChange?.(next)
    }
    root.addEventListener('scroll', update, { passive: true })
    return () => {
      root.removeEventListener('scroll', update)
      stopGliding()
    }
  }, [count, onChange, stopGliding])

  const show = React.useCallback(
    (position: number) => {
      const root = track.current
      if (!root) return
      const next = Math.min(count - 1, Math.max(0, position))
      const glide = smooth && !prefersReducedMotion()
      stopGliding()
      if (glide && slideAt(root.scrollLeft, root.clientWidth, count) !== next) {
        gliding.current = { to: next, timer: window.setTimeout(stopGliding, GLIDE_MS) }
      }
      root.scrollTo({ left: next * root.clientWidth, behavior: glide ? 'smooth' : 'instant' })
      setActive(next)
      onChange?.(next)
    },
    [count, onChange, smooth, stopGliding],
  )

  return { track, active, show }
}
