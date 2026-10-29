import { describe, expect, it } from 'vitest'

import { backendReady, holdBackendUntil } from './backend-ready'
import { http } from './http/client'

describe('backend gate (spec 13, PERF-15)', () => {
  it('holds nothing until the bootstrap holds it', () => {
    expect(backendReady()).toBeUndefined()
  })

  it('keeps a request back until the mock worker is ready', async () => {
    let release!: () => void
    holdBackendUntil(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const sent: string[] = []
    const request = http
      .request({
        url: '/anything',
        adapter: (config) => {
          sent.push('sent')
          return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
        },
      })
      .then(() => sent.push('resolved'))

    // The interceptor is awaiting the gate: the adapter has not been called yet.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(sent).toEqual([])

    release()
    await request
    expect(sent).toEqual(['sent', 'resolved'])
  })
})
