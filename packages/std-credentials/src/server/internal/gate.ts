/** The derivation queue of one ctx. */
type Gate = {
  /** The waiting bound: 16, 8, 4 or 2. */
  readonly limit: number;
  /** `fn`'s result once a slot is free; `null` when the waiting bound is full or `fn` fails. */
  run<T>(fn: () => Promise<T>): Promise<T | null>;
};

/**
 * The queue for a ctx at cost `ln` (17 to 20): 2 run at once at 17 and 18, 1 above; `16 >> (ln - 17)` wait, first in,
 * first out. A slot passes to the next waiter when a derivation ends, whether or not it failed.
 */
export function gate(ln: number): Gate {
  const bound = ln <= 18 ? 2 : 1;
  const limit = 16 >> (ln - 17);
  let active = 0;
  const waiting: (() => void)[] = [];
  const release = (): void => {
    const next = waiting.shift();
    if (next === undefined) active--;
    else next();
  };
  return {
    limit,
    run: async <T>(fn: () => Promise<T>): Promise<T | null> => {
      if (active < bound) active++;
      else if (waiting.length >= limit) return null;
      else await new Promise<void>((go) => waiting.push(go));
      try {
        return await fn();
      } catch {
        return null;
      } finally {
        release();
      }
    },
  };
}
