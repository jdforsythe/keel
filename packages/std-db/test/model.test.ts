// Property: generated sequences of `set`, `commit` and `read` on each driver agree with a model map (k.persist Storage).
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { KINDS, type Rig, makeRig } from "../conformance/fixtures.ts";

const KEYS = ["a", "b", "c", "d"] as const;
const VALUES = ["", "x", "y", "é\u{1F600}z", "'; drop table keel_kv; --"] as const;
const key = fc.constantFrom(...KEYS);
const value = fc.constantFrom(...VALUES);

type Write = { readonly key: string; readonly expect: string | null; readonly value?: string };
type Op =
  | { readonly op: "set"; readonly key: string; readonly value: string }
  | { readonly op: "commit"; readonly writes: readonly Write[] }
  | { readonly op: "read"; readonly keys: readonly string[] };

const write = (k: string): fc.Arbitrary<Write> =>
  fc.oneof(
    fc.record({ key: fc.constant(k), expect: fc.option(value, { nil: null }), value }),
    fc.record({ key: fc.constant(k), expect: fc.option(value, { nil: null }) }),
  );
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ op: fc.constant("set" as const), key, value }),
  fc.record({
    op: fc.constant("commit" as const),
    writes: fc.shuffledSubarray([...KEYS], { minLength: 1 }).chain((ks) => fc.tuple(...ks.map(write))),
  }),
  fc.record({ op: fc.constant("read" as const), keys: fc.array(key, { minLength: 1, maxLength: 5 }) }),
);

const rigs: Rig[] = [];
afterEach(async () => {
  for (const r of rigs.splice(0)) await r.stop();
});

for (const kind of KINDS) {
  describe(`${kind} driver`, () => {
    test("generated set, commit and read sequences agree with a model map", async () => {
      const rig = await makeRig(kind);
      rigs.push(rig);
      const storage = await rig.open();
      let round = 0;
      await fc.assert(
        fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 12 }), async (ops) => {
          const p = `r${round++}.`;
          const model = new Map<string, string>();
          for (const o of ops) {
            if (o.op === "set") {
              await storage.set(p + o.key, o.value);
              model.set(o.key, o.value);
            } else if (o.op === "read") {
              expect(await storage.read(o.keys.map((k) => p + k))).toEqual(o.keys.map((k) => model.get(k) ?? null));
            } else {
              const ok = o.writes.every((w) => (model.get(w.key) ?? null) === w.expect);
              expect(await storage.commit(o.writes.map((w) => ({ ...w, key: p + w.key })))).toBe(ok);
              if (ok) for (const w of o.writes) if (w.value !== undefined) model.set(w.key, w.value);
            }
          }
          for (const k of KEYS) expect(await storage.get(p + k)).toBe(model.get(k) ?? null);
        }),
        { seed: 1337, numRuns: 60 },
      );
    });

    test("a key or value holding U+0000 or a lone surrogate rejects and stores nothing", async () => {
      const rig = await makeRig(kind);
      rigs.push(rig);
      const storage = await rig.open();
      for (const bad of ["a\u0000b", "x\ud800", "\udc00y"]) {
        await expect(storage.set("t.k", bad)).rejects.toThrow(/U\+0000/);
        await expect(storage.set(bad, "v")).rejects.toThrow(/U\+0000/);
        await expect(storage.commit([{ key: "t.k", expect: null, value: bad }])).rejects.toThrow(/U\+0000/);
        await expect(storage.read(["t.k", bad])).rejects.toThrow(/U\+0000/);
      }
      expect(await storage.get("t.k")).toBeNull();
    });
  });
}
