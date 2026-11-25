// Spec: k.persist, clause "`createCtx({ mode: 'real', drivers: { storage } })` returns `storage` as `ctx.storage`."
// Seed: 1337.
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, it } from "vitest";

const SEED = 1337;

// A storage driver over a Map: it keeps the contract of k.persist Storage.
function memoryDriver(initial: ReadonlyMap<string, string>) {
  const data = new Map(initial);
  return {
    get: (key: string) => Promise.resolve(data.get(key) ?? null),
    set: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
    read: (keys: readonly string[]) => Promise.resolve(keys.map((k) => data.get(k) ?? null)),
    commit: (writes: ReadonlyArray<{ key: string; expect: string | null; value?: string }>) => {
      if (writes.some((w) => (data.get(w.key) ?? null) !== w.expect)) return Promise.resolve(false);
      for (const w of writes) if (w.value !== undefined) data.set(w.key, w.value);
      return Promise.resolve(true);
    },
  };
}

it("`createCtx({ mode: 'real', drivers: { storage } })` returns `storage` as `ctx.storage`", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.tuple(fc.string({ maxLength: 4 }), fc.string({ maxLength: 4 })), { maxLength: 6 }),
      fc.constantFrom("real" as const, "shell" as const),
      fc.string({ maxLength: 4 }),
      async (entries, mode, key) => {
        const storage = memoryDriver(new Map(entries));
        const ctx = createCtx({ mode, drivers: { storage } });
        expect(ctx.storage).toBe(storage);
        // It is the driver itself that answers.
        expect(await ctx.storage.get(key)).toBe(new Map(entries).get(key) ?? null);
        await ctx.storage.set(key, "w");
        expect(await storage.get(key)).toBe("w");
      },
    ),
    { seed: SEED, numRuns: 50 },
  );
});
