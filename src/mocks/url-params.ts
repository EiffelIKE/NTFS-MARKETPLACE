// Kept apart from `browser.ts` (and dependency-free) so the bootstrap can read it before the mock
// chunk has downloaded: the URL must be clean before the router renders.

export interface MockUrlParams {
  scenario: string | null
  reset: boolean
  panel: boolean
}

/** Consumes `?scenario=` and `?reset=1` so the router never sees them. */
export function takeMockUrlParams(): MockUrlParams {
  const url = new URL(location.href)
  const scenario = url.searchParams.get('scenario')
  const reset = url.searchParams.get('reset') === '1'
  const panel = url.searchParams.get('mockPanel') === '1'
  if (scenario !== null || url.searchParams.has('reset')) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('reset')
    history.replaceState(history.state as unknown, '', url)
  }
  return { scenario, reset, panel }
}
