import { describe, expect, it } from 'vitest'

import { announce, subscribe, type Politeness } from './announcer-store'

describe('announce', () => {
  it('clears the region before each message, so identical messages are re-announced', () => {
    const events: [Politeness, string][] = []
    const queue: (() => void)[] = []
    const unsubscribe = subscribe((politeness, message) => events.push([politeness, message]))

    announce('Preço atualizado', 'polite', (callback) => queue.push(callback))
    queue.shift()?.()
    announce('Preço atualizado', 'polite', (callback) => queue.push(callback))
    queue.shift()?.()
    unsubscribe()

    expect(events).toEqual([
      ['polite', ''],
      ['polite', 'Preço atualizado'],
      ['polite', ''],
      ['polite', 'Preço atualizado'],
    ])
  })

  it('routes assertive messages to the assertive region', () => {
    const events: [Politeness, string][] = []
    const unsubscribe = subscribe((politeness, message) => events.push([politeness, message]))
    announce('Pedido recusado', 'assertive', (callback) => {
      callback()
    })
    unsubscribe()
    expect(events.at(-1)).toEqual(['assertive', 'Pedido recusado'])
  })
})
