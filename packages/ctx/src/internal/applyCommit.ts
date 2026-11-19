import type { StorageWrite } from "../StorageWrite.ts";
import { noRepeat } from "./noRepeat.ts";

/**
 * `commit` (k.persist) over synchronous `get` and `put` (`null` removes): E1606 for a repeated key; when every key
 * holds its `expect`, each `value` is put and the result is true, else nothing is put and it is false. A `put` that
 * throws first puts back each key it wrote, newest first, then rethrows that first error; a put-back that throws is
 * skipped and masks nothing.
 */
export function applyCommit(
  get: (key: string) => string | null,
  put: (key: string, value: string | null) => void,
  writes: readonly StorageWrite[],
): boolean {
  noRepeat(writes);
  if (writes.some((w) => get(w.key) !== w.expect)) return false;
  const done: StorageWrite[] = [];
  try {
    for (const w of writes)
      if (w.value !== undefined) {
        done.unshift(w);
        put(w.key, w.value);
      }
  } catch (e) {
    for (const w of done)
      try {
        put(w.key, w.expect);
      } catch {
        // The first error is the one that rejects.
      }
    throw e;
  }
  return true;
}
