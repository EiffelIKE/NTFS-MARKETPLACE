/** A copy of `source` without `keys` (instead of destructuring into unused variables). */
export function omit<T extends object, K extends keyof T>(source: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...source }
  for (const key of keys) Reflect.deleteProperty(copy, key)
  return copy
}
