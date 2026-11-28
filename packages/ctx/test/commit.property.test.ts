import { rmSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { type KeyValueStorage, type StorageWrite, createCtx } from "../src/index.ts";
import { fileStorage } from "../src/node/index.ts";

const dir = tempDir("keel-ctx-commit-");
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const KEYS = ["a", "b", "c"] as const;
const key = fc.constantFrom(...KEYS);
const val = fc.option(fc.constantFrom("0", "1", "2"), { nil: null });

type Op =
  | { readonly kind: "set"; readonly key: string; readonly value: string }
  | { readonly kind: "read"; readonly keys: string[] }
  | { readonly kind: "commit"; readonly writes: StorageWrite[] };

const write: fc.Arbitrary<StorageWrite> = fc
  .tuple(key, val, fc.option(fc.constantFrom("0", "1", "2"), { nil: undefined }))
  .map(([k, e, v]) => (v === undefined ? { key: k, expect: e } : { key: k, expect: e, value: v }));
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant("set" as const), key, value: fc.constantFrom("0", "1", "2") }),
  fc.record({ kind: fc.constant("read" as const), keys: fc.array(key, { maxLength: 4 }) }),
  fc.record({ kind: fc.constant("commit" as const), writes: fc.array(write, { maxLength: 4 }) }),
);

/** The model: a Map, `commit` as compare-and-set over every named key, E1606 for a repeat. */
function model(data: Map<string, string>, o: Op): unknown {
  if (o.kind === "set") {
    data.set(o.key, o.value);
    return undefined;
  }
  if (o.kind === "read") return o.keys.map((k) => data.get(k) ?? null);
  if (new Set(o.writes.map((w) => w.key)).size !== o.writes.length) return "E1606";
  if (o.writes.some((w) => (data.get(w.key) ?? null) !== w.expect)) return false;
  for (const w of o.writes) if (w.value !== undefined) data.set(w.key, w.value);
  return true;
}

async function run(storage: KeyValueStorage, o: Op): Promise<unknown> {
  try {
    if (o.kind === "set") return await storage.set(o.key, o.value);
    if (o.kind === "read") return await storage.read(o.keys);
    return await storage.commit(o.writes);
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : e;
  }
}

let n = 0;
const makers: ReadonlyArray<readonly [string, () => KeyValueStorage]> = [
  ["sim", () => createCtx({ mode: "sim", seed: 1 }).storage],
  ["file", () => fileStorage(join(dir, `p${String(n++)}.json`))],
];

describe("storage commit sequences agree with a model map (k.persist)", () => {
  for (const [name, make] of makers)
    it(`${name}: every result and every final value match the model`, async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(op, { maxLength: 12 }), async (ops) => {
          const storage = make();
          const data = new Map<string, string>();
          for (const o of ops) expect(await run(storage, o)).toEqual(model(data, o));
          expect(await storage.read([...KEYS])).toEqual(KEYS.map((k) => data.get(k) ?? null));
        }),
        { seed: 1337, numRuns: 100 },
      );
    });

  it("file: a fresh driver on the same file reads what the last one committed", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 8 }), async (ops) => {
        const file = join(dir, `q${String(n++)}.json`);
        const storage = fileStorage(file);
        for (const o of ops) await run(storage, o);
        expect(await fileStorage(file).read([...KEYS])).toEqual(await storage.read([...KEYS]));
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("sim: a scheduled `fail` on a commit stores nothing and the next call takes the next step", async () => {
    const ctx = createCtx({ mode: "sim", schedule: { net: [], storage: ["fail", "ok"], offline: [], plans: {} } });
    await expect(ctx.storage.commit([{ key: "a", expect: null, value: "1" }])).rejects.toThrow("scheduled failure");
    expect(await ctx.storage.read(["a"])).toEqual([null]);
  });
});
