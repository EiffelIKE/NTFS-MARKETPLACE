import { Eth, type NftId } from '@/contracts'
import { eth } from '@/lib/money'

import type { MockControl } from './control-types'
import { bumpNft, settleOrder } from './domain/orders'
import { disconnectWallet } from './domain/wallets'
import { SCENARIO_LIST } from './scenarios'
import type { MockRuntime } from './runtime'

/**
 * `window.__mock` (spec 02 §11). Every mutating method goes through `store.write`, so it persists
 * and publishes domain changes exactly like a handler does: `updateNft` produces `nft.updated`.
 */
export function createControl(runtime: MockRuntime): MockControl {
  const { store, config, network, settlement } = runtime

  return {
    scenarios: SCENARIO_LIST.map(({ id, label, description }) => ({ id, label, description })),
    state: () => ({ scenarioId: config.scenarioId(), config: config.effective() }),
    useScenario: (id) => {
      runtime.useScenario(id)
    },
    reset: () => {
      runtime.reset()
    },
    configure(patch) {
      config.configure(patch)
      settlement.arm()
      // `realtime: { available: false }` closes the open sockets right away.
      runtime.realtime.enforce()
    },
    addRule: (rule) => config.addRule(rule),
    clearRules: () => {
      config.clearRules()
    },
    expireSessions(userId) {
      store.write((tx) => {
        for (const session of Object.values(tx.state.sessions)) {
          if (userId === undefined || session.userId === userId) session.expiresAt = tx.now - 1
        }
      })
    },
    updateNft(nftId: NftId, patch) {
      store.write((tx) => {
        const nft = tx.state.nfts[nftId]
        if (!nft) throw new Error(`Unknown NFT ${nftId}`)
        let changed = false
        if (patch.price !== undefined) {
          const price = eth.normalize(Eth.parse(patch.price))
          changed ||= price !== nft.price
          nft.price = price
        }
        if (patch.available) {
          const edition = nft.editions.find((e) => e.id === patch.available?.editionId)
          if (!edition) throw new Error(`Unknown edition ${patch.available.editionId}`)
          changed ||= edition.available !== patch.available.value
          edition.available = patch.available.value
        }
        if (changed) bumpNft(tx, nft)
      })
    },
    settleOrder(orderId, outcome) {
      store.write((tx) => {
        const order = tx.state.orders[orderId]
        if (!order) throw new Error(`Unknown order ${orderId}`)
        settleOrder(tx, order, outcome)
      })
    },
    disconnectWallet(connectionId) {
      store.write((tx) => {
        const ids = connectionId
          ? [connectionId]
          : Object.values(tx.state.connections)
              .filter((connection) => connection.status === 'connected')
              .map((connection) => connection.id)
        for (const id of ids) disconnectWallet(tx, id)
      })
    },
    realtime: {
      connections: () => runtime.realtime.connections(),
      drop: (opts) => {
        runtime.realtime.drop(opts)
      },
      restore: () => {
        runtime.realtime.restore()
      },
      redeliver: (count) => {
        runtime.realtime.redeliver(count)
      },
      inject: (event, to) => {
        runtime.realtime.inject(event, to)
      },
      log: () => runtime.realtime.log(),
      clearLog: () => {
        runtime.realtime.clearLog()
      },
    },
    requests: (filter) => network.log.list(filter),
    clearRequests: () => {
      network.log.clear()
    },
    snapshot: () => store.snapshot(),
  }
}
