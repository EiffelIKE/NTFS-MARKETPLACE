import { sha256Hex } from '../../src/mocks/lib/crypto'

// Ana's seeded `ord_000001` (confirmed 2026-09-20): the mock derives its transaction hash from the
// order id and creation time, so tests can address its simulated explorer page without a login.
export const ANA_TX_HASH = `0x${sha256Hex('ord_000001' + '2026-09-20T15:30:00.000Z')}`
export const ANA_TX_PATH = `/explorer/ethereum/tx/${ANA_TX_HASH}`
