// Live-region scheduling, kept free of React so it can be unit-tested in Node (DS-19).

export type Politeness = 'polite' | 'assertive'

type Listener = (politeness: Politeness, message: string) => void

const listeners = new Set<Listener>()

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Clears the region, then sets the message on the next frame, so screen readers announce an
 * identical consecutive message again.
 */
export function announce(
  message: string,
  politeness: Politeness = 'polite',
  schedule: (callback: () => void) => void = (callback) => {
    requestAnimationFrame(() => {
      callback()
    })
  },
) {
  for (const listener of listeners) listener(politeness, '')
  schedule(() => {
    for (const listener of listeners) listener(politeness, message)
  })
}
