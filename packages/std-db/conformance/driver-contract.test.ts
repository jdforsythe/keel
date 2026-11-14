// Spec: std.db, Conformance "Each driver, on a temporary SQLite file and on Postgres (PGlite, and a Postgres 17 service in CI), passes k.persist's storage clauses."
// Seed: 1337.
// Assumption: a rejected promise from `commit` is how "throws E1606" shows (every storage operation returns a promise); the error's message names E1606.
// Postgres runs on PGlite unless KEEL_TEST_POSTGRES_URL is set (see fixtures.ts).
import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { KINDS, type Rig, SEED, makeRig } from "./fixtures.ts";

const rigs: Rig[] = [];
const rig = async (kind: (typeof KINDS)[number]): Promise<Rig> => {
  const r = await makeRig(kind);
  rigs.push(r);
  return r;
};
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.stop();
});

const keyArb = fc.stringMatching(/^[a-z]{1,6}\.[a-z0-9]{1,6}$/);
const valueArb = fc.string({ maxLength: 40 });

for (const kind of KINDS) {
  describe(`${kind} driver passes k.persist's storage clauses`, () => {
    test.skip("`get(key)` is the value, `null` when absent, and `set(key, value)` stores it", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      await fc.assert(
        fc.asyncProperty(keyArb, valueArb, async (key, value) => {
          expect(await storage.get(`absent.${key}`)).toBeNull();
          await storage.set(key, value);
          expect(await storage.get(key)).toBe(value);
        }),
        { seed: SEED, numRuns: 25 },
      );
    });

    test.skip("`read(keys)` returns each key's value in the order asked, `null` for an absent key", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(fc.tuple(keyArb, fc.option(valueArb, { nil: null })), {
            selector: ([k]) => k,
            minLength: 1,
            maxLength: 6,
          }),
          fc.nat(),
          async (entries, shift) => {
            const salt = `${shift}.`;
            for (const [k, v] of entries) if (v !== null) await storage.set(salt + k, v);
            const asked = [...entries.slice(shift % entries.length), ...entries.slice(0, shift % entries.length)];
            expect(await storage.read(asked.map(([k]) => salt + k))).toEqual(asked.map(([, v]) => v));
          },
        ),
        { seed: SEED, numRuns: 25 },
      );
    });

    test.skip("`commit` stores every `value` and resolves `true` when each `expect` matches", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(keyArb, { minLength: 1, maxLength: 5 }),
          fc.array(valueArb, { minLength: 5, maxLength: 5 }),
          fc.nat(),
          async (keys, values, n) => {
            const salt = `${n}.`;
            const writes = keys.map((k, i) => ({ key: salt + k, expect: null, value: values[i] ?? "" }));
            expect(await storage.commit(writes)).toBe(true);
            expect(await storage.read(writes.map((w) => w.key))).toEqual(writes.map((w) => w.value));
            const next = writes.map((w) => ({ key: w.key, expect: w.value, value: `${w.value}!` }));
            expect(await storage.commit(next)).toBe(true);
            expect(await storage.read(next.map((w) => w.key))).toEqual(next.map((w) => w.value));
          },
        ),
        { seed: SEED, numRuns: 25 },
      );
    });

    test.skip("with one `expect` stale `commit` stores nothing and resolves `false`", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      await fc.assert(
        fc.asyncProperty(fc.nat(), fc.integer({ min: 0, max: 2 }), async (n, stale) => {
          const keys = [`s${n}.a`, `s${n}.b`, `s${n}.c`];
          expect(await storage.commit(keys.map((key) => ({ key, expect: null, value: "old" })))).toBe(true);
          const writes = keys.map((key, i) => ({ key, expect: i === stale ? "other" : "old", value: "new" }));
          expect(await storage.commit(writes)).toBe(false);
          expect(await storage.read(keys)).toEqual(["old", "old", "old"]);
        }),
        { seed: SEED, numRuns: 15 },
      );
    });

    test.skip("a write without `value` is checked and not stored", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      await storage.set("cond.a", "1");
      expect(
        await storage.commit([
          { key: "cond.a", expect: "1" },
          { key: "cond.b", expect: null, value: "2" },
        ]),
      ).toBe(true);
      expect(await storage.read(["cond.a", "cond.b"])).toEqual(["1", "2"]);
      expect(
        await storage.commit([
          { key: "cond.a", expect: "other" },
          { key: "cond.c", expect: null, value: "3" },
        ]),
      ).toBe(false);
      expect(await storage.get("cond.c")).toBeNull();
      expect(await storage.commit([{ key: "cond.absent", expect: null }])).toBe(true);
      expect(await storage.get("cond.absent")).toBeNull();
    });

    test.skip("a `commit` naming one key twice throws E1606", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      await storage.set("dup.a", "1");
      await expect(
        storage.commit([
          { key: "dup.a", expect: "1", value: "2" },
          { key: "dup.a", expect: "1", value: "3" },
        ]),
      ).rejects.toThrow(/E1606/);
      expect(await storage.get("dup.a")).toBe("1");
    });

    test.skip("a `read` never returns a value from between two writes of one `commit`", async () => {
      const r = await rig(kind);
      const writer = await r.open();
      const reader = await r.open();
      expect(
        await writer.commit([
          { key: "cut.a", expect: null, value: "0" },
          { key: "cut.b", expect: null, value: "0" },
        ]),
      ).toBe(true);
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (rounds) => {
          const seen: (readonly (string | null)[])[] = [];
          const writes = (async () => {
            for (let i = 0; i < rounds; i++) {
              const [a] = await writer.read(["cut.a"]);
              const next = String(Number(a) + 1);
              await writer.commit([
                { key: "cut.a", expect: a ?? null, value: next },
                { key: "cut.b", expect: a ?? null, value: next },
              ]);
            }
          })();
          const reads = (async () => {
            for (let i = 0; i < rounds * 2; i++) seen.push(await reader.read(["cut.a", "cut.b"]));
          })();
          await Promise.all([writes, reads]);
          for (const [a, b] of seen) expect(a).toBe(b);
        }),
        { seed: SEED, numRuns: 10 },
      );
    });

    test.skip("`createCtx({ mode: 'real', drivers: { storage } })` returns the driver as `ctx.storage`", async () => {
      const r = await rig(kind);
      const storage = await r.open();
      const ctx = createCtx({ mode: "real", drivers: { storage } });
      expect(ctx.storage).toBe(storage);
      await ctx.storage.set("ctx.a", "1");
      expect(await storage.get("ctx.a")).toBe("1");
    });
  });
}
