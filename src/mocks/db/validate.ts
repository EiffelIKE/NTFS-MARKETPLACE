import { SCHEMA_VERSION } from './state'

// A structural check of a persisted database (spec 13, SW boot recovery). `JSON.parse` succeeding
// and the schema version matching is not enough: a write cut short by a tab or storage reset can
// leave a valid JSON object with tables missing, and every handler that reads one would then throw
// until the user cleared the site data. This checks the shape the handlers rely on, not every
// field: a reseed costs the mock data, so it only fires on damage.

type Dict = Record<string, unknown>

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** Every value of the table passes `check`. */
function table(value: unknown, check: (row: Dict) => string | null): string | null {
  if (!isDict(value)) return 'not a table'
  for (const [key, row] of Object.entries(value)) {
    if (!isDict(row)) return `row "${key}" is not an object`
    const problem = check(row)
    if (problem !== null) return `row "${key}": ${problem}`
  }
  return null
}

function needs(row: Dict, keys: Record<string, (value: unknown) => boolean>): string | null {
  for (const [key, valid] of Object.entries(keys)) {
    if (!valid(row[key])) return `bad "${key}"`
  }
  return null
}

const isString = (value: unknown) => typeof value === 'string'
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)

const SEQUENCES = ['user', 'order', 'cartItem', 'wallet', 'connection', 'guestCart']

/** `null` when `value` is a usable database; otherwise the first problem found. */
export function validateState(value: unknown): string | null {
  if (!isDict(value)) return 'not an object'
  if (value.schemaVersion !== SCHEMA_VERSION) return 'unknown schema version'

  const seq = value.seq
  if (!isDict(seq)) return 'missing "seq"'
  for (const key of SEQUENCES) if (!isNumber(seq[key])) return `bad "seq.${key}"`

  const tables: [string, (row: Dict) => string | null][] = [
    [
      'nfts',
      (row) =>
        needs(row, {
          id: isString,
          price: isString,
          editions: isArray,
          gallery: isArray,
          reviews: isArray,
          attributes: isArray,
          collection: isDict,
          specs: isDict,
        }),
    ],
    ['users', (row) => needs(row, { id: isString, email: isString })],
    ['sessions', (row) => needs(row, { userId: isString, expiresAt: isNumber })],
    ['favorites', () => null],
    ['carts', (row) => needs(row, { items: isArray })],
    ['coupons', (row) => needs(row, { code: isString })],
    ['orders', (row) => needs(row, { lines: isArray, reservations: isArray, settleAt: isNumber })],
    ['idempotency', (row) => needs(row, { orderId: isString })],
    ['wallets', (row) => needs(row, { userId: isString })],
    ['connections', (row) => needs(row, { userId: isString })],
  ]
  for (const [name, check] of tables) {
    // `favorites` maps a user to a list of ids, so its values are arrays, not objects.
    const problem =
      name === 'favorites'
        ? isDict(value[name]) && Object.values(value[name]).every(isArray)
          ? null
          : 'not a table of lists'
        : table(value[name], check)
    if (problem !== null) return `"${name}": ${problem}`
  }

  const highlights = value.highlights
  if (!isDict(highlights) || !isArray(highlights.hero)) return 'bad "highlights"'
  if (highlights.featured !== null && !isDict(highlights.featured)) return 'bad "highlights"'
  if (!isDict(value.triggers)) return 'missing "triggers"'
  return null
}
