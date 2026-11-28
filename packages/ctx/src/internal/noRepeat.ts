import type { StorageWrite } from "../StorageWrite.ts";

/** Throw E1606 (k.persist) when `writes` names one key twice; the key is not named, since a storage key stays out of every diag. */
export function noRepeat(writes: readonly StorageWrite[]): void {
  if (new Set(writes.map((w) => w.key)).size !== writes.length)
    throw Object.assign(new Error("commit names one key twice"), { code: "E1606" });
}
