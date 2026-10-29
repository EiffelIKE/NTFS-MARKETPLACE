import { useSyncExternalStore } from 'react'

/** Live `matchMedia` result. Prefer CSS breakpoints; use this only when a prop must change. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => {
        media.removeEventListener('change', onChange)
      }
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
