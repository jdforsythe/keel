import type { KeyValueStorage } from "../KeyValueStorage.ts";

/** In-memory storage, isolated per ctx. */
export function simStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
  };
}
