import type { KeyValueStorage } from "@keel/ctx";
import type { Cell } from "./Cell.ts";
import { E1606 } from "./E1606.ts";

/**
 * k.persist's storage over a native store. Every call runs after the one before it settles, so a `read` is one cut and
 * a `commit` checks and writes with nothing between (std.shells: one page owns the store). A key twice in a `commit`
 * rejects with E1606 and stores nothing.
 */
export function cellStorage(cell: Cell): KeyValueStorage {
  let tail: Promise<unknown> = Promise.resolve();
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = tail.then(fn);
    tail = next.catch(() => undefined);
    return next;
  };
  const read = async (keys: readonly string[]): Promise<(string | null)[]> => {
    const out: (string | null)[] = [];
    for (const k of keys) out.push(await cell.get(k));
    return out;
  };
  return {
    get: (key) => run(() => cell.get(key)),
    set: (key, value) => run(() => cell.put([[key, value]])),
    read: (keys) => run(() => read(keys)),
    commit: (writes) => {
      const keys = writes.map((w) => w.key);
      if (new Set(keys).size < keys.length) return Promise.reject(E1606());
      return run(async () => {
        const held = await read(keys);
        if (writes.some((w, i) => held[i] !== w.expect)) return false;
        const entries: [string, string][] = [];
        for (const w of writes) if (w.value !== undefined) entries.push([w.key, w.value]);
        await cell.put(entries);
        return true;
      });
    },
  };
}
