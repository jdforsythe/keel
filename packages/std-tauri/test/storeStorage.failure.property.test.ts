// The plugin-store driver over a fake store whose chosen writes (`set`, `delete`, `save`) throw: after any failed
// write `read` equals a model map of the calls that resolved, the in-memory store holds no value the file was not
// given, a new driver over the file (a restart) reads the same, and a later commit with the right `expect` succeeds.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { storeStorage } from "../src/internal/storeStorage.ts";

const run = { seed: 1337, numRuns: 200 };
const KEYS = ["a", "b", "c", "d"];

/** A plugin-store stand-in with an in-memory copy and a file: `fails(n)` says whether the nth write throws. */
function fakeStore(fails: (n: number) => boolean) {
  const disk = new Map<string, unknown>();
  const state = { writes: 0, loads: 0, off: false, loadFails: 0 };
  const boom = new Error("native write failed");
  const write = (): void => {
    const n = state.writes++;
    if (!state.off && fails(n)) throw boom;
  };
  let memory = new Map<string, unknown>();
  return {
    disk,
    state,
    boom,
    memory: () => memory,
    restart: () => {
      memory = new Map(disk);
    },
    open: async () => {
      state.loads++;
      if (state.loadFails > 0) {
        state.loadFails--;
        throw new Error("load failed");
      }
      return {
        get: async (k: string) => memory.get(k),
        set: async (k: string, v: unknown) => {
          write();
          memory.set(k, v);
        },
        delete: async (k: string) => {
          write();
          return memory.delete(k);
        },
        save: async () => {
          write();
          disk.clear();
          for (const [k, v] of memory) disk.set(k, v);
        },
      };
    },
  };
}

const key = fc.constantFrom(...KEYS);
const word = fc.constantFrom("1", "2", "3");
const op = fc.oneof(
  fc.record({ kind: fc.constant("set" as const), key, value: word }),
  fc.record({
    kind: fc.constant("commit" as const),
    writes: fc.uniqueArray(
      fc.record({ key, expect: fc.option(word, { nil: null }), value: fc.option(word, { nil: undefined }) }),
      { maxLength: 4, selector: (w) => w.key },
    ),
  }),
);

describe("storeStorage across failed writes", () => {
  test("a commit whose save fails leaves memory at the old values, and a later commit with the right expect succeeds", async () => {
    // Writes 0-1 are the first commit's `set` and `save`; 2-4 the second's two `set`s and its `save`, which throws.
    const f = fakeStore((n) => n === 4);
    const st = storeStorage(f.open);
    expect(await st.commit([{ key: "a", expect: null, value: "1" }])).toBe(true);
    await expect(
      st.commit([
        { key: "a", expect: "1", value: "2" },
        { key: "b", expect: null, value: "2" },
      ]),
    ).rejects.toBe(f.boom);
    expect([...f.memory()]).toEqual([["a", "1"]]);
    expect([...f.disk]).toEqual([["a", "1"]]);
    expect(await st.read(["a", "b"])).toEqual(["1", null]);
    expect(
      await st.commit([
        { key: "a", expect: "1", value: "2" },
        { key: "b", expect: null, value: "2" },
      ]),
    ).toBe(true);
    expect([...f.disk]).toEqual([
      ["a", "2"],
      ["b", "2"],
    ]);
  });

  test("a failed load is tried again on the next call", async () => {
    const f = fakeStore(() => false);
    f.state.loadFails = 1;
    const st = storeStorage(f.open);
    await expect(st.get("a")).rejects.toThrow();
    expect(await st.commit([{ key: "a", expect: null, value: "1" }])).toBe(true);
    expect(await st.get("a")).toBe("1");
    expect(f.state.loads).toBe(2);
  });

  test("generated sequences with failed writes agree with a model map, through a restart", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(op, { maxLength: 12 }),
        fc.array(fc.boolean(), { maxLength: 40 }),
        async (ops, plan) => {
          const f = fakeStore((n) => plan[n] === true);
          const st = storeStorage(f.open);
          const model = new Map<string, string>();
          const want = (): (string | null)[] => KEYS.map((k) => model.get(k) ?? null);
          const check = async (): Promise<void> => {
            const off = f.state.off;
            f.state.off = true;
            expect(await st.read(KEYS)).toEqual(want());
            expect(new Map(f.memory())).toEqual(model);
            f.state.off = off;
          };
          const failed = (e: unknown): null => {
            expect(e).toBe(f.boom);
            return null;
          };
          for (const o of ops) {
            if (o.kind === "set") {
              const ok = await st.set(o.key, o.value).then(() => true, failed);
              if (ok) model.set(o.key, o.value);
              else await check();
              continue;
            }
            const ok = o.writes.every((w) => (model.get(w.key) ?? null) === w.expect);
            const got = await st.commit(o.writes).then((r) => r, failed);
            if (got === null) {
              await check();
              continue;
            }
            expect(got).toBe(ok);
            if (got) for (const w of o.writes) if (w.value !== undefined) model.set(w.key, w.value);
          }
          f.state.off = true;
          await check();
          expect(new Map(f.disk)).toEqual(model);
          f.restart();
          expect(await storeStorage(f.open).read(KEYS)).toEqual(want());
          expect(await st.commit(KEYS.map((k) => ({ key: k, expect: model.get(k) ?? null, value: `n${k}` })))).toBe(
            true,
          );
          expect(await storeStorage(f.open).read(KEYS)).toEqual(KEYS.map((k) => `n${k}`));
        },
      ),
      run,
    );
  });
});
