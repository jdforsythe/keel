// The plugin-store driver over a stand-in whose chosen saves reject before touching their file: after any failed write
// the driver loads again from the files and reads the state before the write or the state after it (the second file's
// save failing after the first one's succeeded leaves the new state), a new driver over the files (a restart) reads the
// same, and a later commit with the right `expect` succeeds.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { storeStorage } from "../src/internal/storeStorage.ts";
import { pluginStoreFiles } from "./pluginStoreFiles.ts";

const run = { seed: 1337, numRuns: 200 };
const KEYS = ["a", "b", "c", "d"];

const key = fc.constantFrom(...KEYS);
const word = fc.constantFrom("1", "2", "3");
const op = fc.oneof(
  fc.record({ kind: fc.constant<"set">("set"), key, value: word }),
  fc.record({
    kind: fc.constant<"commit">("commit"),
    writes: fc.uniqueArray(
      fc.record({ key, expect: fc.option(word, { nil: null }), value: fc.option(word, { nil: undefined }) }),
      { maxLength: 4, selector: (w) => w.key },
    ),
  }),
);

describe("storeStorage across failed writes", () => {
  test("a commit whose first save fails stores nothing, and a later commit with the right expect succeeds", async () => {
    const f = pluginStoreFiles();
    const st = storeStorage(f.open);
    expect(await st.commit([{ key: "a", expect: null, value: "1" }])).toBe(true);
    f.failSave(0);
    const writes = [
      { key: "a", expect: "1", value: "2" },
      { key: "b", expect: null, value: "2" },
    ];
    await expect(st.commit(writes)).rejects.toThrow("native write failed");
    expect(await st.read(["a", "b"])).toEqual(["1", null]);
    expect(await storeStorage(f.open).read(["a", "b"])).toEqual(["1", null]);
    expect(await st.commit(writes)).toBe(true);
    expect(await storeStorage(f.open).read(["a", "b"])).toEqual(["2", "2"]);
  });

  test("a write whose second save fails reads as the new state, as a restart does", async () => {
    const f = pluginStoreFiles();
    const st = storeStorage(f.open);
    await st.set("a", "1");
    f.failSave(1);
    await expect(st.set("a", "2")).rejects.toThrow("native write failed");
    expect(await st.get("a")).toBe("2");
    expect(await storeStorage(f.open).get("a")).toBe("2");
  });

  test("a failed load is tried again on the next call", async () => {
    const f = pluginStoreFiles();
    let fails = 1;
    let loads = 0;
    const st = storeStorage(async (path) => {
      loads++;
      if (fails > 0) {
        fails--;
        throw new Error("load failed");
      }
      return f.open(path);
    });
    await expect(st.get("a")).rejects.toThrow("load failed");
    expect(await st.commit([{ key: "a", expect: null, value: "1" }])).toBe(true);
    expect(await st.get("a")).toBe("1");
    expect(loads).toBe(3);
  });

  test("generated sequences with failed saves agree with a model map, through a restart", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(op, { maxLength: 12 }),
        fc.array(fc.option(fc.nat(1), { nil: undefined }), { maxLength: 12 }),
        async (ops, plan) => {
          const f = pluginStoreFiles();
          const st = storeStorage(f.open);
          let model = new Map<string, string>();
          const view = (m: ReadonlyMap<string, string>): (string | null)[] => KEYS.map((k) => m.get(k) ?? null);
          for (const [i, o] of ops.entries()) {
            const failAt = plan[i];
            const after = new Map(model);
            const ok = o.kind === "set" || o.writes.every((w) => (model.get(w.key) ?? null) === w.expect);
            if (o.kind === "set") after.set(o.key, o.value);
            else if (ok) for (const w of o.writes) if (w.value !== undefined) after.set(w.key, w.value);
            if (failAt !== undefined) f.failSave(failAt);
            const got = await (o.kind === "set" ? st.set(o.key, o.value).then(() => true) : st.commit(o.writes)).then(
              (r) => r,
              (e: unknown) => {
                expect(e).toBeInstanceOf(Error);
                return null;
              },
            );
            f.heal();
            if (got !== null) {
              expect(got).toBe(ok);
              model = after;
              continue;
            }
            const read = await st.read(KEYS);
            expect([view(model), view(after)]).toContainEqual(read);
            expect(await storeStorage(f.open).read(KEYS)).toEqual(read);
            if (JSON.stringify(read) === JSON.stringify(view(after))) model = after;
          }
          expect(await st.read(KEYS)).toEqual(view(model));
          expect(await storeStorage(f.open).read(KEYS)).toEqual(view(model));
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
