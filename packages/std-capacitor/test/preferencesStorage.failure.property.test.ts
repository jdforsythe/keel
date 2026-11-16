// The Preferences driver over a fake plugin whose chosen writes throw: a commit is one native write, so after any
// failed write `read` equals a model map of the calls that resolved, the stored document is the last one written,
// a new driver over it (a restart) reads the same, and a later commit with the right `expect` succeeds.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { preferencesStorage } from "../src/internal/preferencesStorage.ts";

const run = { seed: 1337, numRuns: 200 };
const KEYS = ["a", "b", "c", "d"];

/** A Preferences stand-in: `fails(n)` says whether the nth `set` (from 0) throws; `off` turns failures off. */
function fakePrefs(fails: (n: number) => boolean) {
  const stored = new Map<string, string>();
  const state = { writes: 0, gets: 0, off: false };
  const boom = new Error("native write failed");
  return {
    stored,
    state,
    boom,
    prefs: {
      get: async (o: { key: string }) => {
        state.gets++;
        return { value: stored.get(o.key) ?? null };
      },
      set: async (o: { key: string; value: string }) => {
        const n = state.writes++;
        if (!state.off && fails(n)) throw boom;
        stored.set(o.key, o.value);
      },
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

describe("preferencesStorage across failed writes", () => {
  test("a commit of two keys whose write throws stores neither, and a later commit with the right expect succeeds", async () => {
    const f = fakePrefs((n) => n === 1);
    const st = preferencesStorage(f.prefs);
    expect(await st.commit([{ key: "a", expect: null, value: "1" }])).toBe(true);
    const before = new Map(f.stored);
    await expect(
      st.commit([
        { key: "a", expect: "1", value: "2" },
        { key: "b", expect: null, value: "2" },
      ]),
    ).rejects.toBe(f.boom);
    expect(f.stored).toEqual(before);
    expect(await st.read(["a", "b"])).toEqual(["1", null]);
    expect(await preferencesStorage(f.prefs).read(["a", "b"])).toEqual(["1", null]);
    expect(
      await st.commit([
        { key: "a", expect: "1", value: "2" },
        { key: "b", expect: null, value: "2" },
      ]),
    ).toBe(true);
    expect(await st.read(["a", "b"])).toEqual(["2", "2"]);
  });

  test("every key lives in one native entry, read once and written once per commit", async () => {
    const f = fakePrefs(() => false);
    const st = preferencesStorage(f.prefs);
    expect(
      await st.commit([
        { key: "a", expect: null, value: "1" },
        { key: "b", expect: null, value: "2" },
        { key: "c", expect: null, value: "3" },
      ]),
    ).toBe(true);
    await st.read(KEYS);
    expect(f.stored.size).toBe(1);
    expect(f.state.writes).toBe(1);
    expect(f.state.gets).toBe(1);
  });

  test("an unreadable stored document rejects naming no key or value, and stays unread until it is readable", async () => {
    for (const text of [
      '[["k-secret","v-secret"',
      '{"k-secret":"v-secret"}',
      '[["k-secret"]]',
      '[["k-secret",7]]',
      "7",
    ]) {
      const f = fakePrefs(() => false);
      f.stored.set("keel", text);
      const st = preferencesStorage(f.prefs);
      const err = await st.get("k-secret").then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(Error);
      expect(String(Reflect.get(Object(err), "message"))).not.toMatch(/secret/);
      await expect(st.commit([{ key: "x", expect: null, value: "1" }])).rejects.toBeInstanceOf(Error);
      expect(f.stored.get("keel")).toBe(text);
    }
  });

  test("generated sequences with failed writes agree with a model map, through a restart", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(op, { maxLength: 12 }),
        fc.array(fc.boolean(), { maxLength: 16 }),
        async (ops, plan) => {
          const f = fakePrefs((n) => plan[n] === true);
          const st = preferencesStorage(f.prefs);
          const model = new Map<string, string>();
          const check = async (): Promise<void> => {
            const off = f.state.off;
            f.state.off = true;
            expect(await st.read(KEYS)).toEqual(KEYS.map((k) => model.get(k) ?? null));
            f.state.off = off;
          };
          for (const o of ops) {
            if (o.kind === "set") {
              const ok = await st.set(o.key, o.value).then(
                () => true,
                (e: unknown) => {
                  expect(e).toBe(f.boom);
                  return false;
                },
              );
              if (ok) model.set(o.key, o.value);
              else await check();
              continue;
            }
            const want = o.writes.every((w) => (model.get(w.key) ?? null) === w.expect);
            const got = await st.commit(o.writes).then(
              (r) => r,
              (e: unknown) => {
                expect(e).toBe(f.boom);
                return null;
              },
            );
            if (got === null) {
              expect(want).toBe(true);
              await check();
              continue;
            }
            expect(got).toBe(want);
            if (got) for (const w of o.writes) if (w.value !== undefined) model.set(w.key, w.value);
          }
          f.state.off = true;
          await check();
          expect(await preferencesStorage(f.prefs).read(KEYS)).toEqual(KEYS.map((k) => model.get(k) ?? null));
          expect(await st.commit(KEYS.map((k) => ({ key: k, expect: model.get(k) ?? null, value: `n${k}` })))).toBe(
            true,
          );
          expect(await preferencesStorage(f.prefs).read(KEYS)).toEqual(KEYS.map((k) => `n${k}`));
        },
      ),
      run,
    );
  });
});
