import type { KeyValueStorage } from "../KeyValueStorage.ts";
import type { SimShared } from "./SimShared.ts";
import { applyCommit } from "./applyCommit.ts";
import { noRepeat } from "./noRepeat.ts";
import { sharedOfSim } from "./sharedOfSim.ts";

const PREFIX = "keel.store.";

/**
 * In-memory storage, isolated per ctx (k.persist, k.sim). The n-th `get`, `set`, `read` or `commit` takes `steps[n]`:
 * `fail` rejects and stores nothing. A `read` or `commit` runs whole after its step, so it is one cut. A repeated key
 * rejects a `commit` with E1606 before it takes a step. With `like` (a sim storage), a new object on the same data,
 * schedule and watches (a replica's); `watch` reports the `keel.store.` keys a `true` commit through another such
 * object stored, as that commit returns, never a value.
 */
export function simStorage(steps: readonly ("ok" | "fail")[] = [], like?: KeyValueStorage): KeyValueStorage {
  const shared: SimShared = (like === undefined ? undefined : sharedOfSim.get(like)) ?? {
    data: new Map<string, string>(),
    written: new Set<string>(),
    steps,
    n: 0,
    watchers: new Set(),
  };
  const { data } = shared;
  const step = async (): Promise<void> => {
    if (shared.steps[shared.n++] === "fail") throw new Error("sim storage: scheduled failure");
  };
  const get = (key: string): string | null => data.get(key) ?? null;
  const self: KeyValueStorage = {
    get: async (key) => {
      await step();
      return get(key);
    },
    set: async (key, value) => {
      await step();
      shared.written.add(key);
      data.set(key, value);
    },
    read: async (keys) => {
      await step();
      return keys.map(get);
    },
    commit: async (writes) => {
      noRepeat(writes);
      await step();
      const ok = applyCommit(
        get,
        (k, v) => {
          shared.written.add(k);
          if (v === null) data.delete(k);
          else data.set(k, v);
        },
        writes,
      );
      const keys = writes
        .filter((w) => w.value !== undefined && w.key.startsWith(PREFIX))
        .map((w) => w.key)
        .sort();
      if (ok && keys.length > 0)
        for (const w of [...shared.watchers])
          if (w.owner !== self)
            try {
              w.on({ kind: "committed", keys });
            } catch {
              // A watcher's throw never changes a commit.
            }
      return ok;
    },
    watch: async (on) => {
      const w = { owner: self, on };
      shared.watchers.add(w);
      return () => void shared.watchers.delete(w);
    },
  };
  sharedOfSim.set(self, shared);
  return self;
}
