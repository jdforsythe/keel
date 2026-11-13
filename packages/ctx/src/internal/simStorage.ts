import type { KeyValueStorage } from "../KeyValueStorage.ts";

/** In-memory storage, isolated per ctx. The n-th `get` or `set` takes `steps[n]`: `fail` rejects and stores nothing. */
export function simStorage(steps: readonly ("ok" | "fail")[] = []): KeyValueStorage {
  const data = new Map<string, string>();
  let n = 0;
  const step = async (): Promise<void> => {
    if (steps[n++] === "fail") throw new Error("sim storage: scheduled failure");
  };
  return {
    get: async (key) => {
      await step();
      return data.get(key) ?? null;
    },
    set: async (key, value) => {
      await step();
      data.set(key, value);
    },
  };
}
