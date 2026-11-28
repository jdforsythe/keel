/**
 * `make()`'s answer, with `forget()` run first when it rejects, so a cache that holds this promise drops a failed one
 * and the next call tries again. `make` runs a microtask later, once the caller has kept the promise; the rejection
 * itself goes on to every awaiter, unchanged.
 */
export async function forgetting<T>(make: () => Promise<T>, forget: () => void): Promise<T> {
  let done = false;
  try {
    const value = await Promise.resolve().then(make);
    done = true;
    return value;
  } finally {
    if (!done) forget();
  }
}
