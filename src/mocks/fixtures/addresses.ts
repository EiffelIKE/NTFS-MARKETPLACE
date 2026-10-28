import { sha256Hex } from '../lib/crypto'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** `0xHEAD…TAIL` with a deterministic middle: fictitious but a valid EVM address. */
export function evmAddress(head: string, tail: string): string {
  const middle = sha256Hex(`${head}${tail}`).slice(0, 40 - head.length - tail.length)
  return `0x${head}${middle}${tail}`
}

/** A deterministic 44-character base58 string: fictitious but a valid Solana address. */
export function solanaAddress(seed: string): string {
  const hex = sha256Hex(seed) + sha256Hex(`${seed}!`)
  let out = ''
  for (let i = 0; i < 44; i++) {
    out += BASE58.charAt(Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) % BASE58.length)
  }
  return out
}
