// Spec: k.persist, Conformance "`createCtx({ mode: 'real' })`'s `ctx.storage` and `fileStorage(f)` have no `watch`."
// Spec: k.persist, Conformance "Under sim, with `b = replica(a)` and a `watch` on `a.storage` resolved, a `commit` through `b.storage` storing `keel.store.s1` and `keel.store.s0` and resolving `true` gives `on` exactly one `{ kind: 'committed', keys: ['keel.store.s0', 'keel.store.s1'] }`, with no `ctx.clock` advance."
// Spec: k.persist, Conformance "Under sim, with `b = replica(a)` and a `watch` on `a.storage` resolved, each of these gives `on` nothing: a `commit` through `a.storage`; a `commit` through `b.storage` resolving `false`; one of condition-only writes; one storing only `x.other`; a `set` through `b.storage` of `keel.store.s0`; and any `commit` after the watch's returned function ran."
// Spec: k.persist, Conformance "Under sim, three `commit`s through `b.storage` of `keel.store.s0`, `keel.store.s1` and `keel.store.s2`, in that order, give a `watch` on `a.storage` three reports, in that order."
// Seed: 1337.
// Reading: a sim report is due once the committing `commit` has resolved and the microtask queue has drained ("when the committing step settles"); `settle()` drains it, and no clock advance is ever made.
// Reading: `watch` is reached by property lookup so a storage without one is told from one with one; `replica` is reached the same way so a real ctx can be passed to it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx, replica } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { fileStorage } from "@keel/ctx/node";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";

const SEED = 1337;
const dir = mkdtempSync(join(tmpdir(), "keel-storage-watch-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

type Report = unknown;

/** Starts `watch` on `storage`, collecting every report; resolves once listening. */
async function watching(storage: unknown): Promise<{ reports: Report[]; stop: () => void }> {
  const f: unknown = Reflect.get(Object(storage), "watch");
  if (typeof f !== "function") throw new Error("the storage has no watch");
  const reports: Report[] = [];
  const stop: unknown = await Reflect.apply(f, storage, [(e: Report) => reports.push(e)]);
  if (typeof stop !== "function") throw new Error("watch did not resolve a stop function");
  return { reports, stop: () => void Reflect.apply(stop, undefined, []) };
}

function pair(): { a: SimCtx; b: SimCtx } {
  const a = createCtx({ mode: "sim", seed: SEED });
  return { a, b: replica(a) };
}

const secretArb = fc.hexaString({ minLength: 8, maxLength: 16 }).map((h) => `sk_live_${h}`);

describe("k.persist: Watch", () => {
  it("`createCtx({ mode: 'real' })`'s `ctx.storage` and `fileStorage(f)` have no `watch`", () => {
    const real: Ctx = createCtx({ mode: "real" });
    expect(Reflect.get(Object(real.storage), "watch")).toBeUndefined();
    const f = join(dir, "no-watch.json");
    expect(Reflect.get(Object(fileStorage(f)), "watch")).toBeUndefined();
    const shell: Ctx = createCtx({ mode: "shell" });
    expect(Reflect.get(Object(shell.storage), "watch")).toBeUndefined();
  });

  it("under sim, a `commit` through `replica(a).storage` storing `keel.store.s1` and `keel.store.s0` and resolving `true` gives the `watch` on `a.storage` exactly one sorted `committed` report, with no `ctx.clock` advance", async () => {
    await fc.assert(
      fc.asyncProperty(secretArb, secretArb, async (v0, v1) => {
        const { a, b } = pair();
        const w = await watching(a.storage);
        const before = a.clock.now();
        const ok = await b.storage.commit([
          { key: "keel.store.s1", expect: null, value: v1 },
          { key: "keel.store.s0", expect: null, value: v0 },
        ]);
        await settle();
        expect(ok).toBe(true);
        expect(w.reports).toEqual([{ kind: "committed", keys: ["keel.store.s0", "keel.store.s1"] }]);
        expect(a.clock.now()).toBe(before);
        expect(b.clock.now()).toBe(before);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  describe("under sim, each of these gives `on` nothing", () => {
    it("a `commit` through `a.storage`", async () => {
      const { a } = pair();
      const w = await watching(a.storage);
      expect(await a.storage.commit([{ key: "keel.store.s0", expect: null, value: "v" }])).toBe(true);
      await settle();
      expect(w.reports).toEqual([]);
    });

    it("a `commit` through `b.storage` resolving `false`", async () => {
      const { a, b } = pair();
      await a.storage.set("keel.store.s0", "held");
      const w = await watching(a.storage);
      expect(await b.storage.commit([{ key: "keel.store.s0", expect: "other", value: "v" }])).toBe(false);
      await settle();
      expect(w.reports).toEqual([]);
    });

    it("one of condition-only writes", async () => {
      const { a, b } = pair();
      const w = await watching(a.storage);
      expect(await b.storage.commit([{ key: "keel.store.s0", expect: null }])).toBe(true);
      await settle();
      expect(w.reports).toEqual([]);
    });

    it("one storing only `x.other`", async () => {
      const { a, b } = pair();
      const w = await watching(a.storage);
      expect(await b.storage.commit([{ key: "x.other", expect: null, value: "v" }])).toBe(true);
      await settle();
      expect(w.reports).toEqual([]);
    });

    it("a `set` through `b.storage` of `keel.store.s0`", async () => {
      const { a, b } = pair();
      const w = await watching(a.storage);
      await b.storage.set("keel.store.s0", "v");
      await settle();
      expect(w.reports).toEqual([]);
    });

    it("any `commit` after the watch's returned function ran", async () => {
      const { a, b } = pair();
      const w = await watching(a.storage);
      w.stop();
      expect(await b.storage.commit([{ key: "keel.store.s0", expect: null, value: "v" }])).toBe(true);
      await settle();
      expect(w.reports).toEqual([]);
    });

    it("whatever generated mix of these is committed, nothing is reported", async () => {
      const opArb = fc.constantFrom("own", "stale", "condition", "other", "set");
      await fc.assert(
        fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 8 }), async (ops) => {
          const { a, b } = pair();
          await a.storage.set("keel.store.held", "h");
          const w = await watching(a.storage);
          for (const [i, op] of ops.entries()) {
            if (op === "own") await a.storage.commit([{ key: `keel.store.o${i}`, expect: null, value: "v" }]);
            if (op === "stale") await b.storage.commit([{ key: "keel.store.held", expect: "no", value: "v" }]);
            if (op === "condition") await b.storage.commit([{ key: `keel.store.c${i}`, expect: null }]);
            if (op === "other") await b.storage.commit([{ key: `x.other${i}`, expect: null, value: "v" }]);
            if (op === "set") await b.storage.set(`keel.store.t${i}`, "v");
          }
          await settle();
          expect(w.reports).toEqual([]);
        }),
        { seed: SEED, numRuns: 25 },
      );
    });
  });

  it("under sim, three `commit`s through `b.storage` of `keel.store.s0`, `keel.store.s1` and `keel.store.s2`, in that order, give a `watch` on `a.storage` three reports, in that order", async () => {
    const { a, b } = pair();
    const w = await watching(a.storage);
    for (const k of ["keel.store.s0", "keel.store.s1", "keel.store.s2"]) {
      expect(await b.storage.commit([{ key: k, expect: null, value: "v" }])).toBe(true);
    }
    await settle();
    expect(w.reports).toEqual([
      { kind: "committed", keys: ["keel.store.s0"] },
      { kind: "committed", keys: ["keel.store.s1"] },
      { kind: "committed", keys: ["keel.store.s2"] },
    ]);
  });

  it("for any interleaving of commits on two replicas' storages, each watcher sees exactly the other's `keel.store.` keys in commit order and never its own, never `lost`, and no stored value", async () => {
    const opArb = fc.record({
      side: fc.constantFrom<0 | 1>(0, 1),
      keys: fc.subarray(["keel.store.s0", "keel.store.s1", "keel.store.s2", "x.other", "jobs.q"], { minLength: 1 }),
      stale: fc.boolean(),
      value: secretArb,
    });
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 10 }), async (ops) => {
        const { a, b } = pair();
        const sides = [a, b];
        const wa = await watching(a.storage);
        const wb = await watching(b.storage);
        const expected: [Report[], Report[]] = [[], []];
        const values: string[] = [];
        for (const [i, op] of ops.entries()) {
          const side = sides[op.side];
          if (side === undefined) throw new Error("no side");
          // Each op writes keys of its own generation, so a fresh `expect: null` holds; a stale op expects a value nothing holds.
          const writes = op.keys.map((k) => ({
            key: `${k}.g${i}`,
            expect: op.stale ? "never-stored" : null,
            value: op.value,
          }));
          values.push(op.value);
          const ok = await side.storage.commit(writes);
          expect(ok).toBe(!op.stale);
          const storeKeys = writes
            .map((w) => w.key)
            .filter((k) => k.startsWith("keel.store."))
            .sort();
          if (ok && storeKeys.length > 0) expected[op.side === 0 ? 1 : 0].push({ kind: "committed", keys: storeKeys });
        }
        await settle();
        // watcher on a hears b's commits; watcher on b hears a's
        expect(wa.reports).toEqual(expected[0]);
        expect(wb.reports).toEqual(expected[1]);
        for (const r of [...wa.reports, ...wb.reports]) {
          expect(Object.keys(Object(r)).sort()).toEqual(["keys", "kind"]);
          const text = JSON.stringify(r);
          for (const v of values) expect(text.includes(v)).toBe(false);
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});
