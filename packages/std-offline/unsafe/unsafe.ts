/** Runs `fn`, the code `reason` justifies (k.unsafe); `keel check` judges the reason's form (E1754, E1760). */
export function unsafe<T>(_reason: string, fn: () => T): T {
  return fn();
}
