import type { StorageWrite } from "../StorageWrite.ts";
import { noRepeat } from "./noRepeat.ts";

/**
 * `commit` (k.persist) over synchronous `get` and `set`: E1606 for a repeated key; when every key holds its `expect`,
 * each `value` is `set` and the result is true, else nothing is set and it is false.
 */
export function applyCommit(
  get: (key: string) => string | null,
  set: (key: string, value: string) => void,
  writes: readonly StorageWrite[],
): boolean {
  noRepeat(writes);
  if (writes.some((w) => get(w.key) !== w.expect)) return false;
  for (const w of writes) if (w.value !== undefined) set(w.key, w.value);
  return true;
}
