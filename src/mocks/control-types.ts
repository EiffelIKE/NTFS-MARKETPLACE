import type { EditionId, Eth, NftId, OperationId } from '@/contracts'

import type { ConfigPatch, FailureRule, MockConfig } from './config'
import type { ConnectionId, MockState, OrderId, UserId } from './db/state'
import type { RequestLogEntry } from './network'
import type { RealtimeControl } from './realtime/types'
import type { ScenarioId } from './scenarios'

// The `window.__mock` contract, with no DOM or Vite dependencies so the E2E helpers can import it.

export interface ScenarioInfo {
  id: ScenarioId
  label: string
  description: string
}

export interface MockControl {
  scenarios: readonly ScenarioInfo[]
  state(): { scenarioId: ScenarioId; config: MockConfig }
  /** Reseeds with the scenario's seed and clears overrides. Reload the page afterwards. */
  useScenario(id: ScenarioId): void
  /** Reseeds the active scenario and clears overrides. Reload the page afterwards. */
  reset(): void
  /** A persisted override on top of the scenario's config. */
  configure(patch: ConfigPatch): void
  addRule(rule: Omit<FailureRule, 'id'>): string
  /** Removes every rule, the scenario's own included. */
  clearRules(): void
  /** Sets `expiresAt` to the past; omit `userId` for every session. */
  expireSessions(userId?: UserId): void
  /** A price or availability change "on the server"; bumps the version and publishes. */
  updateNft(
    nftId: NftId,
    patch: { price?: Eth; available?: { editionId: EditionId; value: number | null } },
  ): void
  /** Settles a pending order now (for the `payment-manual` scenarios). */
  settleOrder(orderId: OrderId, outcome: 'confirmed' | 'declined'): void
  /** Ends the connection with `connectionId`, or every active one. */
  disconnectWallet(connectionId?: ConnectionId): void
  /** The Socket.IO mock server: connections, drops, replays and injected events (spec 03). */
  realtime: RealtimeControl
  requests(filter?: { op?: OperationId }): RequestLogEntry[]
  clearRequests(): void
  /** Deep copy of the whole mock database. */
  snapshot(): MockState
}
