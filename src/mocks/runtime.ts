import { createConfigStore, type ConfigStore } from './config'
import { createBus, type Bus } from './db/bus'
import { seed } from './db/seed'
import { createStore, type Store, type StorageAdapter } from './db/store'
import { nextSettlement, settleDue } from './domain/orders'
import { createHub, type RealtimeHub } from './realtime/hub'
import { defaultAvatarProcessor, type AvatarProcessor } from './lib/images'
import { createNetwork, type Network } from './network'
import { SCENARIOS, type ScenarioId } from './scenarios'

/** Everything a mock server needs, wired once: store, bus, config, network and settlement. */
export interface MockRuntime {
  baseUrl: string
  bus: Bus
  store: Store
  config: ConfigStore
  network: Network
  /** The Socket.IO mock server's state; call `realtime.start()` to forward bus changes. */
  realtime: RealtimeHub
  processAvatar: AvatarProcessor
  settlement: {
    /** Settles every due order now (also runs at the start of every handled request). */
    tick(): void
    /** Re-arms the single timer for the earliest pending `settleAt`. */
    arm(): void
    stop(): void
  }
  /** Reseeds with the scenario's seed, clears overrides; callers reload the page. */
  useScenario(id: ScenarioId): void
  /** Reseeds the active scenario and clears overrides. */
  reset(): void
}

interface RuntimeOptions {
  storage: StorageAdapter
  /** Absolute or root-relative base the handlers register under (`/api`). */
  baseUrl: string
  processAvatar?: AvatarProcessor
}

export function createRuntime({ storage, baseUrl, processAvatar }: RuntimeOptions): MockRuntime {
  const bus = createBus()
  const config = createConfigStore(storage)
  const network = createNetwork(() => config.effective())
  const store = createStore({
    storage,
    bus,
    seed: () => seed(SCENARIOS[config.scenarioId()].seed),
  })
  store.load()
  const realtime = createHub({ store, bus, config })

  let timer: ReturnType<typeof setTimeout> | undefined
  const settlement: MockRuntime['settlement'] = {
    tick() {
      const due = store.read((state) => nextSettlement(state, config.effective()))
      if (due === null || due > Date.now()) return
      store.write((tx) => settleDue(tx, config.effective()))
    },
    arm() {
      clearTimeout(timer)
      const due = store.read((state) => nextSettlement(state, config.effective()))
      if (due === null) return
      timer = setTimeout(
        () => {
          settlement.tick()
          settlement.arm()
        },
        Math.max(0, due - Date.now()),
      )
      // In Node a pending settlement must never keep the process alive.
      ;(timer as { unref?: () => void }).unref?.()
    },
    stop() {
      clearTimeout(timer)
    },
  }

  return {
    baseUrl,
    bus,
    store,
    config,
    network,
    realtime,
    processAvatar: processAvatar ?? defaultAvatarProcessor(),
    settlement,
    useScenario(id) {
      config.setScenario(id)
      network.reset()
      store.replace(seed(SCENARIOS[id].seed))
      settlement.arm()
    },
    reset() {
      config.clearOverrides()
      network.reset()
      store.replace(seed(SCENARIOS[config.scenarioId()].seed))
      settlement.arm()
    },
  }
}
