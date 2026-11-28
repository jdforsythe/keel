import type { StorageReport } from "./StorageReport.ts";
import type { StorageWrite } from "./StorageWrite.ts";

/**
 * Key-value storage capability (k.persist). `get` resolves null for a missing key. `read(keys)` resolves each key's
 * value in the order asked as one cut. `commit(writes)` stores every `value` and resolves true when every key holds
 * its `expect`, else stores nothing and resolves false; one key twice rejects with E1606. `watch(on)`, when present,
 * reports the `keel.store.` keys other storage objects on the same data commit (`StorageReport`); it resolves the stop function once listening.
 */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  read(keys: readonly string[]): Promise<(string | null)[]>;
  commit(writes: readonly StorageWrite[]): Promise<boolean>;
  watch?(on: (report: StorageReport) => void): Promise<() => void>;
}
