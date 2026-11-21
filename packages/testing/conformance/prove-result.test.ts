// Spec: k.prove, API "`prove(transactions, { rlimit? })` takes transactions of one store, each once. It resolves `{ proven, z3 }` (the names proven; the Z3 version as `major.minor.build`, `5.3.3`)"
// Spec: k.prove, API "An empty or mixed list, a repeated transaction, or an `rlimit` that is not an integer from 1 to 2^32 - 1 rejects E1710 (k.model)."
// Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { invariant, store, transaction } from "@keel/store";
import { prove } from "@keel/testing/prove";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const LONG = 120_000;

let seq = 0;
/** Build a fixture inside a scope (E1203) under ids unique to this call. */
const build = <R>(mk: (id: string) => R): R => {
  seq += 1;
  const id = `pv${seq}`;
  let out: { value: R } | undefined;
  scope(() => {
    out = { value: mk(id) };
  });
  if (out === undefined) throw new Error("fixture: scope did not run");
  return out.value;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codeOf = (e: unknown): string | undefined => (isRecord(e) && typeof e.code === "string" ? e.code : undefined);
const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e ?? new Error("rejected with a falsy value");
  }
};

const fixture = (id: string) => {
  const none = s.object({});
  const a = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: `${id}.a` });
  invariant(a, (state) => state.n >= 0);
  const inc = transaction(a, `${id}.inc`, none, (state) => ({ n: state.n < 9 ? state.n + 1 : state.n }));
  const dec = transaction(a, `${id}.dec`, none, (state) => ({ n: state.n > 0 ? state.n - 1 : state.n }));
  const b = store(s.object({ n: s.int({ min: 0, max: 9 }) }), { n: 0 }, { id: `${id}.b` });
  invariant(b, (state) => state.n >= 0);
  const other = transaction(b, `${id}.other`, none, (state) => ({ n: state.n < 9 ? state.n + 1 : state.n }));
  return { id, inc, dec, other };
};

describe("k.prove: result", () => {
  it(
    "prove resolves { proven, z3 } with the names proven and the Z3 version as major.minor.build",
    async () => {
      const f = build(fixture);
      const r: unknown = await prove([f.inc, f.dec]);
      expect(isRecord(r)).toBe(true);
      expect(isRecord(r) ? Object.keys(r).sort() : []).toEqual(["proven", "z3"]);
      const proven = isRecord(r) ? r.proven : undefined;
      expect(Array.isArray(proven) ? [...proven].sort() : proven).toEqual([`${f.id}.dec`, `${f.id}.inc`]);
      expect(isRecord(r) ? r.z3 : undefined).toMatch(/^\d+\.\d+\.\d+$/);
    },
    LONG,
  );

  it(
    "an empty list rejects E1710",
    async () => {
      expect(codeOf(await rejection(() => prove([])))).toBe("E1710");
    },
    LONG,
  );

  it(
    "a mixed list of transactions of two stores rejects E1710",
    async () => {
      const f = build(fixture);
      expect(codeOf(await rejection(() => prove([f.inc, f.other])))).toBe("E1710");
    },
    LONG,
  );

  it(
    "a repeated transaction rejects E1710",
    async () => {
      const f = build(fixture);
      expect(codeOf(await rejection(() => prove([f.inc, f.inc])))).toBe("E1710");
    },
    LONG,
  );

  it(
    "an rlimit that is not an integer from 1 to 2^32 - 1 rejects E1710",
    async () => {
      const f = build(fixture);
      const bad = fc.oneof(
        fc.constantFrom(0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32, 2 ** 53 - 1),
        fc.integer({ max: 0 }),
        fc.double({ noInteger: true, noNaN: true, min: 0.001, max: 1e6 }),
      );
      // seed 1337
      await fc.assert(
        fc.asyncProperty(bad, async (rlimit) => {
          expect(codeOf(await rejection(() => prove([f.inc], { rlimit })))).toBe("E1710");
        }),
        { seed: SEED, numRuns: 8 },
      );
      for (const rlimit of [2 ** 32, 2 ** 53 - 1]) {
        expect(codeOf(await rejection(() => prove([f.inc], { rlimit })))).toBe("E1710");
      }
    },
    LONG,
  );

  it(
    "an rlimit of 2^32 - 1 is accepted",
    async () => {
      const f = build(fixture);
      const base: unknown = await prove([f.inc]);
      const r: unknown = await prove([f.inc], { rlimit: 2 ** 32 - 1 });
      const names = (v: unknown): unknown => (isRecord(v) && Array.isArray(v.proven) ? [...v.proven].sort() : v);
      expect(names(r)).toEqual([`${f.id}.inc`]);
      expect(names(r)).toEqual(names(base));
    },
    LONG,
  );
});
