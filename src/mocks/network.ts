import type { OperationId } from '@/contracts'

import type { FailureRule, MockConfig } from './config'
import { createPrng, type Prng } from './lib/prng'

// Network simulation (spec 02 §10): latency, out-of-order responses, failure rules and the
// request log. Every wait is a page timer, so Playwright's clock and Vitest fake timers drive it.

export type LogStatus = number | 'pending' | 'aborted' | 'network-error' | 'timeout'

export interface RequestLogEntry {
  seq: number
  at: string
  op: OperationId | 'unmatched'
  method: string
  url: string
  status: LogStatus
}

const LOG_SIZE = 500

export interface Network {
  /** First rule that matches `op` and still has calls left; consumes one. */
  match(op: OperationId): FailureRule | null
  /** Milliseconds to wait for this call; draws from the PRNG or the out-of-order counter. */
  latencyFor(op: OperationId): number
  /** Resolves after `ms`; rejects with an `AbortError` as soon as `signal` aborts. */
  wait(ms: number, signal: AbortSignal): Promise<void>
  /** Never resolves; rejects when `signal` aborts. */
  hang(signal: AbortSignal): Promise<never>
  /** Forgets rule counters, out-of-order counters and the PRNG position (not the log). */
  reset(): void
  log: {
    start(op: OperationId | 'unmatched', method: string, url: string): number
    finish(seq: number, status: LogStatus): void
    list(filter?: { op?: OperationId }): RequestLogEntry[]
    clear(): void
  }
}

export function createNetwork(getConfig: () => MockConfig): Network {
  // Counters live in memory: a scenario starts from zero on every fresh page load.
  const remaining = new Map<string, number>()
  const calls = new Map<OperationId, number>()
  let prng: Prng | null = null
  let prngSeed = -1
  const entries: RequestLogEntry[] = []
  let seq = 0

  const abortError = () => new DOMException('The request was aborted', 'AbortError')

  return {
    match(op) {
      for (const rule of getConfig().rules) {
        if (rule.op !== '*' && rule.op !== op) continue
        if (rule.times === 'always') return rule
        const left = remaining.get(rule.id) ?? rule.times
        if (left <= 0) continue
        remaining.set(rule.id, left - 1)
        return rule
      }
      return null
    },
    latencyFor(op) {
      const config = getConfig()
      if (config.outOfOrder?.ops.includes(op)) {
        const count = (calls.get(op) ?? 0) + 1
        calls.set(op, count)
        return count % 2 === 1 ? config.outOfOrder.slowMs : config.outOfOrder.fastMs
      }
      const { latency } = config
      switch (latency.kind) {
        case 'none':
          return 0
        case 'fixed':
          return latency.ms
        case 'range':
          if (prng === null || prngSeed !== config.prngSeed) {
            prng = createPrng(config.prngSeed)
            prngSeed = config.prngSeed
          }
          return prng.int(latency.minMs, latency.maxMs)
      }
    },
    wait(ms, signal) {
      return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(abortError())
          return
        }
        if (ms <= 0) {
          resolve()
          return
        }
        const onAbort = () => {
          clearTimeout(timer)
          reject(abortError())
        }
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }, ms)
        signal.addEventListener('abort', onAbort, { once: true })
      })
    },
    reset() {
      remaining.clear()
      calls.clear()
      prng = null
      prngSeed = -1
    },
    hang(signal) {
      return new Promise<never>((_resolve, reject) => {
        if (signal.aborted) {
          reject(abortError())
          return
        }
        signal.addEventListener(
          'abort',
          () => {
            reject(abortError())
          },
          { once: true },
        )
      })
    },
    log: {
      start(op, method, url) {
        seq += 1
        entries.push({ seq, at: new Date().toISOString(), op, method, url, status: 'pending' })
        if (entries.length > LOG_SIZE) entries.shift()
        return seq
      },
      finish(entrySeq, status) {
        const entry = entries.find((e) => e.seq === entrySeq)
        if (entry) entry.status = status
      },
      list: (filter) =>
        entries.filter((e) => !filter?.op || e.op === filter.op).map((e) => ({ ...e })),
      clear() {
        entries.length = 0
      },
    },
  }
}
