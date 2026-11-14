// Same clause as packages/std-capacitor/conformance/storage-contract.test.ts: Conformance "Each package's `storage` passes k.persist's storage clauses."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumption: the k.persist storage clauses are tested here over the driver's `storage` alone: `get`/`set`, `read` order, `commit` (all, stale, condition-only),
// commits run one at a time, E1606 on a key twice (a throw or a rejection; `code` is `E1606`).
import { tauriDrivers } from "@keel/std-tauri";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { begin, end, ORIGIN, PAGES, type World } from "./fixtures.ts";

const run = { seed: 1337, numRuns: 100 };
const word = fc.string({ maxLength: 10 });
const entries = fc.uniqueArray(
  fc.record({ key: fc.string({ minLength: 1, maxLength: 8 }), value: fc.option(word, { nil: null }) }),
  {
    minLength: 1,
    maxLength: 6,
    selector: (e) => e.key,
  },
);
let world: World;
const storage = () => tauriDrivers({ origin: ORIGIN }).storage;

describe("std.shells: storage passes k.persist's storage clauses", () => {
  beforeEach(() => {
    world = begin(PAGES[0]);
  });
  afterEach(end);

  test("`get` is `null` for an absent key and `set` stores the value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }), word, async (key, value) => {
        world.wipe();
        const st = storage();
        expect(await st.get(key)).toBeNull();
        await st.set(key, value);
        expect(await st.get(key)).toBe(value);
      }),
      run,
    );
  });

  test("`read(keys)` returns each key's value in the order asked, `null` for an absent key", async () => {
    await fc.assert(
      fc.asyncProperty(entries, async (es) => {
        world.wipe();
        const st = storage();
        for (const e of es) if (e.value !== null) await st.set(e.key, e.value);
        const asked = [...es].reverse();
        expect(await st.read(asked.map((e) => e.key))).toEqual(asked.map((e) => e.value));
      }),
      run,
    );
  });

  test("`commit` stores every `value` and resolves `true` when each `expect` matches", async () => {
    await fc.assert(
      fc.asyncProperty(entries, async (es) => {
        world.wipe();
        const st = storage();
        for (const e of es) if (e.value !== null) await st.set(e.key, e.value);
        const ok = await st.commit(es.map((e) => ({ key: e.key, expect: e.value, value: `next:${e.key}` })));
        expect(ok).toBe(true);
        expect(await st.read(es.map((e) => e.key))).toEqual(es.map((e) => `next:${e.key}`));
      }),
      run,
    );
  });

  test("with one `expect` stale `commit` stores nothing and resolves `false`", async () => {
    await fc.assert(
      fc.asyncProperty(entries, fc.nat(), async (es, pick) => {
        world.wipe();
        const st = storage();
        for (const e of es) if (e.value !== null) await st.set(e.key, e.value);
        const stale = pick % es.length;
        const ok = await st.commit(
          es.map((e, i) => ({
            key: e.key,
            expect: i === stale ? (e.value === null ? "stale" : null) : e.value,
            value: `next:${e.key}`,
          })),
        );
        expect(ok).toBe(false);
        expect(await st.read(es.map((e) => e.key))).toEqual(es.map((e) => e.value));
      }),
      run,
    );
  });

  test("a write without `value` is checked and not stored", async () => {
    await fc.assert(
      fc.asyncProperty(entries, async (es) => {
        world.wipe();
        const st = storage();
        for (const e of es) if (e.value !== null) await st.set(e.key, e.value);
        const ok = await st.commit([
          ...es.map((e) => ({ key: e.key, expect: e.value })),
          { key: "fresh-key-extra", expect: null, value: "stored" },
        ]);
        expect(ok).toBe(true);
        expect(await st.read(es.map((e) => e.key))).toEqual(es.map((e) => e.value));
        expect(await st.get("fresh-key-extra")).toBe("stored");
        expect(await st.commit([{ key: es[0]?.key ?? "", expect: "never-held-value" }])).toBe(false);
      }),
      run,
    );
  });

  test("commits run one at a time: of concurrent commits on one `expect`, one resolves `true` and the stored values are that commit's", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 6 }), async (n) => {
        world.wipe();
        const st = storage();
        const ids = Array.from({ length: n }, (_, i) => i);
        const results = await Promise.all(
          ids.map((i) =>
            st.commit([
              { key: "lock", expect: null, value: `w${i}` },
              { key: `mark${i}`, expect: null, value: `w${i}` },
            ]),
          ),
        );
        expect(results.filter((r: boolean) => r)).toHaveLength(1);
        const winner = results.indexOf(true);
        const stored = await st.read(["lock", ...ids.map((i) => `mark${i}`)]);
        expect(stored).toEqual([`w${winner}`, ...ids.map((i) => (i === winner ? `w${i}` : null))]);
      }),
      run,
    );
  });

  test("a `read` never returns a value from between two writes of one `commit`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }), async (commits, reads) => {
        world.wipe();
        const st = storage();
        const writers = Array.from({ length: commits }, async (_, i) =>
          st.commit([
            { key: "a", expect: i === 0 ? null : `v${i - 1}`, value: `v${i}` },
            { key: "b", expect: i === 0 ? null : `v${i - 1}`, value: `v${i}` },
          ]),
        );
        const readers = Array.from({ length: reads }, async () => st.read(["a", "b"]));
        const [, seen] = await Promise.all([Promise.all(writers), Promise.all(readers)]);
        for (const [a, b] of seen) expect(a).toBe(b);
      }),
      run,
    );
  });

  test("a `commit` naming one key twice throws E1606", async () => {
    const st = storage();
    const err = await Promise.resolve()
      .then(() =>
        st.commit([
          { key: "dup", expect: null, value: "1" },
          { key: "dup", expect: null, value: "2" },
        ]),
      )
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(Error);
    expect(Reflect.get(Object(err), "code")).toBe("E1606");
    expect(await st.get("dup")).toBeNull();
  });
});

// Same clause, the Tauri half of the API bullet "saved before a write resolves": `keel.json` holds the value when `set` or a `true` `commit` resolves.
describe("std.shells: a write is saved to keel.json before it resolves", () => {
  beforeEach(() => {
    world = begin(PAGES[0]);
  });
  afterEach(end);

  test("`set` and a `true` `commit` are in the saved `keel.json` when they resolve", async () => {
    const chars = fc
      .array(fc.constantFrom(..."abcdefgh0123456789"), { minLength: 4, maxLength: 8 })
      .map((c) => c.join(""));
    await fc.assert(
      fc.asyncProperty(chars, chars, async (viaSet, viaCommit) => {
        world.wipe();
        const st = storage();
        await st.set("kset", `v-${viaSet}`);
        expect(world.saved()).toContain(`v-${viaSet}`);
        expect(await st.commit([{ key: "kcommit", expect: null, value: `c-${viaCommit}` }])).toBe(true);
        expect(world.saved()).toContain(`c-${viaCommit}`);
        expect(await st.commit([{ key: "kcommit", expect: "stale-expect", value: "refused-value" }])).toBe(false);
        expect(world.saved()).not.toContain("refused-value");
      }),
      run,
    );
  });
});
