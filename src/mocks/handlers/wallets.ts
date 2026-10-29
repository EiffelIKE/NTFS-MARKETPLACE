import { ConnectWalletBody, CreateWalletBody, WalletFields, type OperationId } from '@/contracts'

import { toConnection, toWallet } from '../domain/mappers'
import {
  assertConnectable,
  connectWallet,
  createWallet,
  disconnectWallet,
  updateWallet,
  userWallets,
} from '../domain/wallets'
import { HttpError } from '../lib/http-error'
import { created, noContent, ok, op, type AnyOp } from './pipeline'

export const walletOps = {
  'wallets.list': op({
    handle: ({ runtime, user }) => {
      const { id } = user()
      const items = runtime.store.read((state) =>
        userWallets(state, id)
          .sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1))
          .map(toWallet),
      )
      return ok({ items })
    },
  }),

  'wallets.create': op({
    body: CreateWalletBody,
    handle({ runtime, body, user }) {
      const { id } = user()
      return created(toWallet(runtime.store.write((tx) => createWallet(tx, id, body))))
    },
  }),

  'wallets.update': op({
    body: WalletFields,
    handle({ runtime, params, body, user }) {
      const { id } = user()
      return ok(
        toWallet(runtime.store.write((tx) => updateWallet(tx, id, params.walletId ?? '', body))),
      )
    },
  }),

  'walletConnections.list': op({
    handle: ({ runtime, user }) => {
      const { id } = user()
      return ok({
        items: runtime.store.read((state) =>
          Object.values(state.connections)
            .filter((connection) => connection.userId === id)
            .map(toConnection),
        ),
      })
    },
  }),

  /** Waits the scenario's delay (a page timer), then approves or rejects the connection. */
  'walletConnections.connect': op({
    body: ConnectWalletBody,
    async handle({ runtime, config, request, body, user }) {
      const { id } = user()
      runtime.store.read((state) => assertConnectable(state, id, body.walletId, body.network))
      await runtime.network.wait(config.walletConnect.delayMs, request.signal)
      if (config.walletConnect.outcome === 'reject') {
        throw new HttpError('WALLET_REJECTED', {
          details: { walletId: body.walletId, network: body.network },
        })
      }
      return created(
        toConnection(
          runtime.store.write((tx) =>
            connectWallet(tx, id, body.walletId, body.provider, body.network),
          ),
        ),
      )
    },
  }),

  'walletConnections.disconnect': op({
    handle({ runtime, params, user }) {
      const { id } = user()
      runtime.store.write((tx) => {
        disconnectWallet(tx, params.connectionId ?? '', id)
      })
      return noContent()
    },
  }),
} satisfies Partial<Record<OperationId, AnyOp>>
