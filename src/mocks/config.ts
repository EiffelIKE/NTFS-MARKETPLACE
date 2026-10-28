import type { ApiErrorCode, OperationId } from '@/contracts'

import { CONFIG_KEY, type StorageAdapter } from './db/store'
import { omit } from './lib/omit'
import { SCENARIOS, type ScenarioId } from './scenarios'

// Network conditions and simulated behavior (spec 02 §10). The effective config is the scenario's
// config merged with persisted overrides set through `__mock.configure()` and the panel.

export type LatencyConfig =
  { kind: 'none' } | { kind: 'fixed'; ms: number } | { kind: 'range'; minMs: number; maxMs: number }

export type FailureEffect =
  | { kind: 'http'; status: number; code: Exclude<ApiErrorCode, 'UNKNOWN'> }
  | { kind: 'network-error' }
  /** `before` hangs without applying the operation; `after` applies it and loses the response. */
  | { kind: 'timeout'; phase: 'before' | 'after' }

export interface FailureRule {
  id: string
  op: OperationId | '*'
  effect: FailureEffect
  /** Decremented per matching call. */
  times: number | 'always'
}

export interface MockConfig {
  latency: LatencyConfig
  /** Odd calls of each listed operation are slow, even calls fast: a later request answers first. */
  outOfOrder: { ops: OperationId[]; slowMs: number; fastMs: number } | null
  rules: FailureRule[]
  payment: { outcome: 'confirm' | 'decline' | 'manual'; settleDelayMs: number }
  walletConnect: { outcome: 'approve' | 'reject'; delayMs: number }
  sessionTtlMs: number
  /**
   * Socket.IO mock server (spec 03). `available: false` refuses new connections and closes open
   * ones; `deliveryDelayMs` is the wait between a committed change and its event.
   */
  realtime: { available: boolean; deliveryDelayMs: number }
  /** Once per seed, on the first `orders.create` (revalidation then fails). */
  checkoutTrigger: 'raise-price' | 'sell-out' | null
  /** Drives `range` latency. */
  prngSeed: number
}

/** A partial config. In a scenario, `rules` are the scenario's rules. */
export interface ConfigPatch {
  latency?: LatencyConfig
  outOfOrder?: MockConfig['outOfOrder']
  rules?: (Omit<FailureRule, 'id'> & { id?: string })[]
  payment?: Partial<MockConfig['payment']>
  walletConnect?: Partial<MockConfig['walletConnect']>
  realtime?: Partial<MockConfig['realtime']>
  sessionTtlMs?: number
  checkoutTrigger?: MockConfig['checkoutTrigger']
  prngSeed?: number
}

export const BASE_CONFIG: MockConfig = {
  latency: { kind: 'fixed', ms: 120 },
  outOfOrder: null,
  rules: [],
  payment: { outcome: 'confirm', settleDelayMs: 3000 },
  walletConnect: { outcome: 'approve', delayMs: 600 },
  realtime: { available: true, deliveryDelayMs: 50 },
  sessionTtlMs: 2 * 60 * 60 * 1000,
  checkoutTrigger: null,
  prngSeed: 20261027,
}

/** What persists across reloads: the active scenario and the changes made on top of it. */
export interface ConfigOverrides extends Omit<ConfigPatch, 'rules'> {
  /** Rules added at runtime. */
  rules?: FailureRule[]
  /** True once `clearRules()` ran, so the scenario's own rules no longer apply. */
  scenarioRulesCleared?: true
  /** Scenario rules switched off one by one (`removeRule`). */
  disabledRuleIds?: string[]
  ruleSeq?: number
}

interface StoredConfig {
  scenarioId: ScenarioId
  overrides: ConfigOverrides
}

function withIds(scope: string, rules: ConfigPatch['rules']): FailureRule[] {
  return (rules ?? []).map((rule, index) => ({
    ...rule,
    id: rule.id ?? `${scope}:${String(index + 1)}`,
  }))
}

/** Scenario config over the base, then the overrides over that. */
export function mergeConfig(
  scenarioId: ScenarioId,
  scenarioConfig: ConfigPatch,
  overrides: ConfigOverrides,
): MockConfig {
  const disabled = new Set(overrides.disabledRuleIds)
  const scenarioRules = overrides.scenarioRulesCleared
    ? []
    : withIds(scenarioId, scenarioConfig.rules).filter((rule) => !disabled.has(rule.id))
  const apply = (patch: ConfigPatch | ConfigOverrides, base: MockConfig): MockConfig => ({
    latency: patch.latency ?? base.latency,
    outOfOrder: patch.outOfOrder === undefined ? base.outOfOrder : patch.outOfOrder,
    rules: base.rules,
    payment: { ...base.payment, ...patch.payment },
    walletConnect: { ...base.walletConnect, ...patch.walletConnect },
    realtime: { ...base.realtime, ...patch.realtime },
    sessionTtlMs: patch.sessionTtlMs ?? base.sessionTtlMs,
    checkoutTrigger:
      patch.checkoutTrigger === undefined ? base.checkoutTrigger : patch.checkoutTrigger,
    prngSeed: patch.prngSeed ?? base.prngSeed,
  })
  const merged = apply(overrides, apply(scenarioConfig, BASE_CONFIG))
  return { ...merged, rules: [...scenarioRules, ...(overrides.rules ?? [])] }
}

export interface ConfigStore {
  scenarioId(): ScenarioId
  effective(): MockConfig
  overrides(): ConfigOverrides
  /** Switching scenarios clears the overrides. */
  setScenario(id: ScenarioId): void
  configure(patch: ConfigPatch): void
  addRule(rule: Omit<FailureRule, 'id'>): string
  clearRules(): void
  /** Removes one rule, whether it was added at runtime or belongs to the scenario. */
  removeRule(id: string): void
  /** Drops a latency override, so the scenario's own latency applies again. */
  clearLatencyOverride(): void
  /** Back to the scenario's own defaults. */
  clearOverrides(): void
}

export function isScenarioId(value: string): value is ScenarioId {
  return value in SCENARIOS
}

export function createConfigStore(storage: StorageAdapter): ConfigStore {
  let scenarioId: ScenarioId = 'default'
  let overrides: ConfigOverrides = {}

  try {
    const raw = storage.get(CONFIG_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredConfig>
      if (stored.scenarioId && isScenarioId(stored.scenarioId)) {
        scenarioId = stored.scenarioId
        overrides = stored.overrides ?? {}
      }
    }
  } catch {
    // corrupt config: fall back to the default scenario
  }

  let cached: MockConfig | null = null
  const commit = () => {
    cached = null
    try {
      storage.set(CONFIG_KEY, JSON.stringify({ scenarioId, overrides } satisfies StoredConfig))
    } catch (error) {
      console.warn('[mock] could not persist the config', error)
    }
  }

  return {
    scenarioId: () => scenarioId,
    overrides: () => overrides,
    effective() {
      cached ??= mergeConfig(scenarioId, SCENARIOS[scenarioId].config, overrides)
      return cached
    },
    setScenario(id) {
      scenarioId = id
      overrides = {}
      commit()
    },
    configure(patch) {
      const { rules, ...rest } = patch
      overrides = {
        ...overrides,
        ...rest,
        payment: { ...overrides.payment, ...rest.payment },
        walletConnect: { ...overrides.walletConnect, ...rest.walletConnect },
        realtime: { ...overrides.realtime, ...rest.realtime },
      }
      if (rules) {
        const seq = overrides.ruleSeq ?? 0
        overrides = {
          ...overrides,
          scenarioRulesCleared: true,
          ruleSeq: seq + rules.length,
          rules: rules.map((rule, index) => ({
            ...rule,
            id: rule.id ?? `rule:${String(seq + index + 1)}`,
          })),
        }
      }
      commit()
    },
    addRule(rule) {
      const seq = (overrides.ruleSeq ?? 0) + 1
      const id = `rule:${String(seq)}`
      overrides = {
        ...overrides,
        ruleSeq: seq,
        rules: [...(overrides.rules ?? []), { ...rule, id }],
      }
      commit()
      return id
    },
    clearRules() {
      overrides = { ...omit(overrides, 'rules'), scenarioRulesCleared: true }
      commit()
    },
    removeRule(id) {
      const added = overrides.rules ?? []
      overrides = added.some((rule) => rule.id === id)
        ? { ...overrides, rules: added.filter((rule) => rule.id !== id) }
        : { ...overrides, disabledRuleIds: [...(overrides.disabledRuleIds ?? []), id] }
      commit()
    },
    clearLatencyOverride() {
      overrides = omit(overrides, 'latency')
      commit()
    },
    clearOverrides() {
      overrides = {}
      commit()
    },
  }
}
