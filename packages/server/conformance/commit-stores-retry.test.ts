// Spec: k.persist, clause "`commitStores` whose `commit` is refused twice then accepted runs `fn` three times and saves once; refused three times it returns `keel.conflict` and saves nothing."
// Seed: 1337.
// ASSUMED (k.persist Server saves): `commitStores(ctx, factory, fn)` resolves `fn`'s `Result` on a save, so a save is `ok`.
// The ctx is a real ctx over a storage driver whose `commit` is refused (resolves `false`, stores nothing) its first `refusals` times.
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import { commitStores } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { expect, it } from "vitest";

const Items = s.object({ items: s.array(s.int()) });
const Add = s.object({ n: s.int() });
const LISTS = "keel.store.app.lists";

type Write = { key: string; expect: string | null; value?: string };

const factory = () => {
  const lists = store(Items, { items: [] }, { id: "app.lists" });
  const addList = transaction(lists, "app.addList", Add, (state, { n }) => ({ items: [...state.items, n] }));
  return { lists, addList };
};

function driver(refusals: number) {
  const data = new Map<string, string>();
  const calls = { commits: 0, accepted: 0 };
  const storage = {
    get: (key: string) => Promise.resolve(data.get(key) ?? null),
    set: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
    read: (keys: readonly string[]) => Promise.resolve(keys.map((k) => data.get(k) ?? null)),
    commit: (writes: readonly Write[]) => {
      calls.commits++;
      if (calls.commits <= refusals || writes.some((w) => (data.get(w.key) ?? null) !== w.expect)) {
        return Promise.resolve(false);
      }
      for (const w of writes) if (w.value !== undefined) data.set(w.key, w.value);
      calls.accepted++;
      return Promise.resolve(true);
    },
  };
  return { data, calls, storage };
}

function field(v: unknown, k: string): unknown {
  return typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined;
}

it("`commitStores` whose `commit` is refused twice then accepted runs `fn` three times and saves once; refused three times it returns `keel.conflict` and saves nothing", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 1, max: 1000 }), async (refusals, n) => {
      const d = driver(refusals);
      const ctx = createCtx({ mode: "real", drivers: { storage: d.storage } });
      const seenHeads: number[] = [];
      let runs = 0;
      const result = await commitStores(ctx, factory, (S) => {
        runs++;
        // Every run starts from a fresh read: a refused run's change is not kept.
        seenHeads.push(S.lists.head());
        tx(S.addList, { n });
        return ok(null);
      });

      if (refusals < 3) {
        expect(result.ok).toBe(true);
        expect(runs).toBe(refusals + 1);
        expect(d.calls.accepted).toBe(1);
        expect(d.calls.commits).toBe(refusals + 1);
        expect(field(JSON.parse(d.data.get(LISTS) ?? "null"), "state")).toEqual({ items: [n] });
      } else {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(field(result.error, "code")).toBe("keel.conflict");
        expect(runs).toBe(3);
        expect(d.calls.accepted).toBe(0);
        expect(d.data.size).toBe(0);
      }
      expect(seenHeads.every((h) => h === 0)).toBe(true);
    }),
    { seed: 1337, numRuns: 24 },
  );
});
