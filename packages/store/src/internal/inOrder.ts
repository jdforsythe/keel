/**
 * Run `fn` once every earlier `inOrder` call on any of `keys` in `chains` has settled, and return its result. Calls on
 * a shared key run one at a time in issue order; calls on disjoint keys run concurrently. Each key's entry is the
 * settled tail of its last call (it never rejects) and is removed once nothing later is queued behind it.
 */
export function inOrder<T>(
  chains: Map<string, Promise<void>>,
  keys: readonly string[],
  fn: () => Promise<T>,
): Promise<T> {
  const run = Promise.all(keys.map((k) => chains.get(k))).then(fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  for (const k of keys) chains.set(k, tail);
  void tail.then(() => {
    for (const k of keys) if (chains.get(k) === tail) chains.delete(k);
  });
  return run;
}
