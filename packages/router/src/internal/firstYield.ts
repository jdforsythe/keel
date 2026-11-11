/**
 * A loader's ordinary answer (k.server API): `start` called with a fresh signal; a promise is awaited, a live loader's
 * generator gives its first yield, then gets `return()` and its signal aborts. A generator ending before a yield throws.
 */
export async function firstYield<R>(start: (signal: AbortSignal) => Promise<R> | AsyncGenerator<R>): Promise<R> {
  const ac = new AbortController();
  const r = start(ac.signal);
  if (!(Symbol.asyncIterator in r)) return r;
  try {
    const first = await r.next();
    if (first.done === true) throw new Error("no yield");
    return first.value;
  } finally {
    ac.abort();
    void r.return(undefined).catch(() => undefined);
  }
}
