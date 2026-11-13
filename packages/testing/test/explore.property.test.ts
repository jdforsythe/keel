// Properties for explore (k.model): generated small stores against a naive enumeration. Seed: 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import { explore } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalKey } from "../src/internal/canonicalKey.ts";
import { domainOf } from "../src/internal/domainOf.ts";

const FC = { seed: 1337, numRuns: 100 };
const SIZE = 8;
let seq = 0;

// A store over n in 0..SIZE-1 with two transactions whose successors come from `table[tx][n][i]`, i in 0..1.
function machine(table: readonly (readonly (readonly number[])[])[]) {
  seq += 1;
  let out: ReturnType<typeof mk> | undefined;
  const mk = () => {
    const st = store(s.object({ n: s.int({ min: 0, max: SIZE - 1 }) }), { n: 0 }, { id: `prop.explore.${seq}` });
    const txs = [0, 1].map((k) =>
      transaction(st, `prop.explore.${seq}.t${k}`, s.object({ i: s.int({ min: 0, max: 1 }) }), (state, { i }) => ({
        n: table[k]?.[state.n]?.[i] ?? state.n,
      })),
    );
    return { st, txs };
  };
  scope(() => {
    out = mk();
  });
  if (out === undefined) throw new Error("scope did not run");
  return out;
}

// Every state reachable within `depth` steps, by repeated relaxation (no queue, no visiting order).
function naive(table: readonly (readonly (readonly number[])[])[], start: number, depth: number): Set<number> {
  let seen = new Set([start]);
  for (let d = 0; d < depth; d++) {
    const next = new Set(seen);
    for (const n of seen) for (const k of [0, 1]) for (const i of [0, 1]) next.add(table[k]?.[n]?.[i] ?? n);
    if (next.size === seen.size) break;
    seen = next;
  }
  return seen;
}

const tableArb = fc.array(
  fc.array(fc.array(fc.integer({ min: 0, max: SIZE - 1 }), { minLength: 2, maxLength: 2 }), {
    minLength: SIZE,
    maxLength: SIZE,
  }),
  { minLength: 2, maxLength: 2 },
);

describe("explore", () => {
  it("property: visits exactly the states a naive enumeration reaches, each once, with one edge per state and payload", () => {
    fc.assert(
      fc.property(
        tableArb,
        fc.integer({ min: 0, max: SIZE - 1 }),
        fc.integer({ min: 0, max: 10 }),
        (table, start, depth) => {
          const { txs } = machine(table);
          const r = explore(txs, { from: { n: start }, depth });
          const got = r.states.map((x) => x.n);
          expect(new Set(got).size).toBe(got.length);
          expect(new Set(got)).toEqual(naive(table, start, depth));
          expect(got[0]).toBe(start);
          expect(r.edges % 4).toBe(0);
          expect(r.edges).toBeLessThanOrEqual(got.length * 4);
          if (r.complete) expect(r.edges).toBe(got.length * 4);
        },
      ),
      FC,
    );
  });

  it("property: the closed form closes and agrees with a naive enumeration from the start", () => {
    fc.assert(
      fc.property(tableArb, (table) => {
        const { txs } = machine(table);
        const r = explore(txs);
        expect(r.complete).toBe(true);
        expect(new Set(r.states.map((x) => x.n))).toEqual(naive(table, 0, SIZE));
        expect(r.edges).toBe(r.states.length * 4);
      }),
      FC,
    );
  });

  it("property: canonicalKey ignores key order", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.oneof(fc.integer(), fc.string(), fc.boolean())), (o) => {
        const reversed = Object.fromEntries(Object.entries(o).reverse());
        expect(canonicalKey(reversed)).toBe(canonicalKey(o));
      }),
      FC,
    );
  });

  it("property: an object of booleans and small integers enumerates its whole product, each value once", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 3 }), (maxes) => {
        const schema = s.object(Object.fromEntries(maxes.map((m, i) => [`k${i}`, s.int({ min: 0, max: m })])));
        const all = domainOf(schema) ?? [];
        expect(all).toHaveLength(maxes.reduce((p, m) => p * (m + 1), 1));
        expect(new Set(all.map((v) => JSON.stringify(v))).size).toBe(all.length);
        for (const v of all) expect(schema.parse(v).ok).toBe(true);
      }),
      FC,
    );
  });
});
