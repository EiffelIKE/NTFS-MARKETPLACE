const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * `0x1a2b3c…9f0e`: the first 8 and last 4 characters of a transaction hash (RCPT-09). A value too
 * short to gain anything from it comes back as it is.
 */
export function shortHash(hash: string): string {
  return hash.length <= 14 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

/** "29 de jul. de 2026", in the browser's time zone (RCPT-09). */
export function formatOrderDate(iso: string): string {
  return DATE.format(new Date(iso))
}
