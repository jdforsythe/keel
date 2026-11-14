import type { StorageWrite } from "./StorageWrite.ts";

/** A storage driver as k.persist states it: `get`, `set`, `read` as one cut, `commit` all or nothing. */
export interface StorageDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  read(keys: readonly string[]): Promise<(string | null)[]>;
  commit(writes: readonly StorageWrite[]): Promise<boolean>;
}
