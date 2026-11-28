/** Every result of a loader call: a live loader's generator as is, a promise as one yield. */
export function yields<R>(r: Promise<R> | AsyncGenerator<R>): AsyncIterable<R> {
  if (Symbol.asyncIterator in r) return r;
  return (async function* () {
    yield await r;
  })();
}
