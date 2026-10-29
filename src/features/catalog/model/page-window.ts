/** `1 … p-1 p p+1 … last`, with `null` for a gap. */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  const wanted = new Set([1, page - 1, page, page + 1, totalPages])
  const pages = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const result: (number | null)[] = []
  for (const n of pages) {
    const before = result.at(-1)
    if (before !== undefined && before !== null && n - before === 2) result.push(n - 1)
    else if (before !== undefined && before !== null && n - before > 2) result.push(null)
    result.push(n)
  }
  return result
}
