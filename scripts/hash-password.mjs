// Prints a PBKDF2 hash for a fixture password (spec 02 §9):
//   node scripts/hash-password.mjs 'Kurio#Ana2026'
// Same format and parameters as src/mocks/lib/crypto.ts, which verifies it.
import { webcrypto } from 'node:crypto'

const ITERATIONS = 100_000
const password = process.argv[2]
if (!password) {
  console.error('usage: node scripts/hash-password.mjs <password>')
  process.exit(1)
}

const salt = webcrypto.getRandomValues(new Uint8Array(16))
const key = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveBits'],
)
const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  key,
  256,
)
const b64 = (bytes) => Buffer.from(bytes).toString('base64')
console.log(`pbkdf2-sha256$${String(ITERATIONS)}$${b64(salt)}$${b64(new Uint8Array(bits))}`)
