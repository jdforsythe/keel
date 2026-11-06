/** Deep-freeze plain data in place and return it. Already-frozen subtrees are skipped (shared structure). */
export function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) freeze(v);
  }
  return value;
}
