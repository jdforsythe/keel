import type { KeyValueStorage } from "@keel/ctx";

/** A storage driver over `map` that keeps the k.persist contract (test helper). */
export function mapStorage(map: Map<string, string>): KeyValueStorage {
  const now = (k: string): string | null => map.get(k) ?? null;
  return {
    get: async (k) => now(k),
    set: async (k, v) => {
      map.set(k, v);
    },
    read: async (keys) => keys.map(now),
    commit: async (writes) => {
      if (writes.some((w) => now(w.key) !== w.expect)) return false;
      for (const w of writes) if (w.value !== undefined) map.set(w.key, w.value);
      return true;
    },
  };
}
