import type { KeyValueStorage } from "../KeyValueStorage.ts";
import { applyCommit } from "./applyCommit.ts";
import { noRepeat } from "./noRepeat.ts";

/**
 * In-memory storage, isolated per ctx (k.persist, k.sim). The n-th `get`, `set`, `read` or `commit` takes `steps[n]`:
 * `fail` rejects and stores nothing. A `read` or `commit` runs whole after its step, so it is one cut. A repeated key
 * rejects a `commit` with E1606 before it takes a step.
 */
export function simStorage(steps: readonly ("ok" | "fail")[] = []): KeyValueStorage {
  const data = new Map<string, string>();
  let n = 0;
  const step = async (): Promise<void> => {
    if (steps[n++] === "fail") throw new Error("sim storage: scheduled failure");
  };
  const get = (key: string): string | null => data.get(key) ?? null;
  return {
    get: async (key) => {
      await step();
      return get(key);
    },
    set: async (key, value) => {
      await step();
      data.set(key, value);
    },
    read: async (keys) => {
      await step();
      return keys.map(get);
    },
    commit: async (writes) => {
      noRepeat(writes);
      await step();
      return applyCommit(get, (k, v) => (v === null ? data.delete(k) : data.set(k, v)), writes);
    },
  };
}
