/** `0xA91F…E82C`, as Figma writes a wallet's second line. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}
