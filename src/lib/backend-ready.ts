// The mock API (a Service Worker, spec 02) starts while the app renders: the shell paints from the
// first chunk and does not wait for the mock chunk to download. Anything that talks to the backend
// awaits this gate first, so no request can leave before the worker controls the page.

let pending: Promise<void> | null = null

/** Called once by the bootstrap with the promise of the mock worker's start. */
export function holdBackendUntil(ready: Promise<void>): void {
  pending = ready
}

/** Resolves when the backend can be called; `undefined` when nothing holds it (real backend, tests). */
export function backendReady(): Promise<void> | undefined {
  return pending ?? undefined
}
