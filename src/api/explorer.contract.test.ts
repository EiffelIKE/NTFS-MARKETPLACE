import { afterEach, describe, expect, it, vi } from 'vitest'

import { explorerApi, ordersApi } from '@/api'
import { ExplorerTransaction } from '@/contracts'
import { must } from '@/lib/test-utils'
import { CREDENTIALS } from '@/mocks/fixtures/credentials'
import { sha256Hex } from '@/mocks/lib/crypto'

import { actAs, as, lastRequest, rejection, serveMockApi, useFakeClock } from './contract-kit'
import { connectPrimary, orderBody } from './order-kit'

const mock = serveMockApi()

afterEach(() => {
  vi.useRealTimers()
})

// Ana's seeded `ord_000001`: Sage Nomad #009 (1 x 1.69) and Golden Signal #160 (2 x 0.39), KURIO10,
// Ethereum fee 0.016: total 2.239 ETH, so the contract received 2.223.
const hashOf = (orderId: string) =>
  must(must(mock.control.snapshot().orders[orderId]).transaction).hash

describe('explorer.getTransaction', () => {
  it('is public and returns the on-chain view of a confirmed order', async () => {
    const hash = hashOf('ord_000001')
    const tx = await explorerApi.getTransaction('ethereum', hash)

    expect(ExplorerTransaction.safeParse(tx).success).toBe(true)
    expect(tx).toMatchObject({
      hash,
      network: 'ethereum',
      explorerName: 'Etherscan',
      status: 'confirmed',
      timestamp: '2026-09-20T15:30:03.000Z',
      to: '0x4B1D5e0C7a93F2d86aE1b3C09D7f45a2E8c6B310',
      value: '2.223',
      networkFee: '0.016',
    })
    expect(tx.from).toBe(must(mock.control.snapshot().orders.ord_000001).wallet.address)
    expect(tx.items).toEqual([
      { name: 'Sage Nomad #009', tokenId: '#0009', editionLabel: '1/10', quantity: 1 },
      { name: 'Golden Signal #160', tokenId: '#0160', editionLabel: 'ABERTA', quantity: 2 },
    ])

    const request = must(lastRequest(mock, 'explorer.getTransaction'))
    expect(request).toMatchObject({ method: 'GET', status: 200 })
    expect(request.url).toBe(`/api/explorer/ethereum/tx/${hash}`)
  })

  it('exposes no private data: nothing of the collector, the profile or the order', async () => {
    const tx = await explorerApi.getTransaction('ethereum', hashOf('ord_000001'))
    const body = JSON.stringify(tx)
    const order = must(mock.control.snapshot().orders.ord_000001)
    for (const secret of [
      CREDENTIALS.ana.email,
      order.collector.displayName,
      order.collector.profileName,
      order.collector.email,
      order.collector.referralCode,
      order.wallet.nickname,
      order.wallet.ensName,
      order.id,
      'usr_ana',
      'KURIO10',
    ]) {
      expect(body).not.toContain(secret)
    }
    expect(Object.keys(tx).sort()).toEqual(Object.keys(ExplorerTransaction.shape).sort())
  })

  it('answers the same to any caller, a guest or another user', async () => {
    const hash = hashOf('ord_000001')
    const guest = await explorerApi.getTransaction('ethereum', hash)
    await actAs('bruno')
    expect(await explorerApi.getTransaction('ethereum', hash)).toEqual(guest)
    // A stale or malformed bearer is not even looked at: the operation has no session.
    as('not-a-session')
    expect(await explorerApi.getTransaction('ethereum', hash)).toEqual(guest)
  })

  it('derives a stable block number, and finds the hash in any letter case', async () => {
    const hash = hashOf('ord_000001')
    const first = await explorerApi.getTransaction('ethereum', hash)
    const again = await explorerApi.getTransaction('ethereum', `0x${hash.slice(2).toUpperCase()}`)
    expect(again.blockNumber).toBe(first.blockNumber)
    expect(first.blockNumber).toBeGreaterThanOrEqual(19_500_000)
    expect(first.blockNumber).toBeLessThan(20_000_000)
  })

  it('404s for an unknown hash, a hash on another network and an unknown network', async () => {
    const hash = hashOf('ord_000001')
    const missing = await rejection(() =>
      explorerApi.getTransaction('ethereum', `0x${'0'.repeat(64)}`),
    )
    expect(missing).toMatchObject({ status: 404, code: 'NOT_FOUND' })
    expect(missing.details).toEqual({ resource: 'transaction' })

    expect(await rejection(() => explorerApi.getTransaction('polygon', hash))).toMatchObject({
      status: 404,
    })
    // `network` is typed, so a bogus one is forced through the client to reach the server.
    const bogus = 'bitcoin' as 'ethereum'
    expect(await rejection(() => explorerApi.getTransaction(bogus, hash))).toMatchObject({
      status: 404,
    })
  })

  it('has nothing for a pending order and finds it the moment it settles, where the order links', async () => {
    useFakeClock()
    await actAs('ana')
    await connectPrimary()
    const { body } = await orderBody()
    const order = await ordersApi.create(body, { idempotencyKey: 'attempt-0001' })

    // Pending: no hash is recorded yet, so even the hash it will get is unknown to the chain.
    expect(order.transaction).toBeNull()
    const future = `0x${sha256Hex(order.id + order.createdAt)}`
    as()
    expect(await rejection(() => explorerApi.getTransaction('ethereum', future))).toMatchObject({
      status: 404,
    })

    await actAs('ana')
    await vi.advanceTimersByTimeAsync(3000)

    const settled = await ordersApi.get(order.id)
    const transaction = must(settled.transaction)
    expect(transaction.explorerUrl).toBe(`/explorer/ethereum/tx/${transaction.hash}`)

    as()
    const tx = await explorerApi.getTransaction('ethereum', transaction.hash)
    expect(tx.status).toBe('confirmed')
    expect(tx.timestamp).toBe(settled.settledAt)
    expect(tx.items.map((item) => item.quantity)).toEqual(
      settled.lines.map((line) => line.quantity),
    )
    // The contract received the total without the network fee.
    expect(tx.value).toBe('3.17')
    expect(tx.networkFee).toBe('0.016')
  })
})
