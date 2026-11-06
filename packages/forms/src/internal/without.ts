/** Copy of `record` without `key`. */
export function without<V>(record: Readonly<Record<string, V>>, key: string): Readonly<Record<string, V>> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}
