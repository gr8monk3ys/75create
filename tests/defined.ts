/** Narrows an indexed read the test relies on, failing with a clear message if it is absent. */
export function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to exist`)
  return value
}
