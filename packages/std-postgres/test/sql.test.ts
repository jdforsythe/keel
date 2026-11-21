// Seed 1337. Properties of `sql`, `fragment` and the parameter check (std.postgres API, E2457).
import type { JsonValue } from "@keel/schema";
import { s } from "@keel/schema";
import { fragment, sql } from "@keel/std-postgres";
import fc from "fast-check";
import { expect, test } from "vitest";
import { toParam } from "../src/internal/toParam.ts";

const SEED = 1337;
const S = s.object({});
const json: fc.Arbitrary<JsonValue> = fc.jsonValue().map((v) => toParam(v, 1));

test("every JSON value is a parameter, copied equal, and never text", () => {
  fc.assert(
    fc.property(json, (v) => {
      const q = sql(S)`select ${v}`;
      expect(q.text).toBe("select $1");
      expect(q.params).toEqual([v]);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("nested fragments are spliced, their parameters numbered in template order", () => {
  fc.assert(
    fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 6 }), fc.nat({ max: 5 }), (xs, depth) => {
      let inner = fragment`${xs[0]}`;
      for (let d = 0; d < depth; d++) inner = fragment`(${inner})`;
      const rest = xs.slice(1);
      const tail = rest.reduce((f, x) => fragment`${f} ${x}`, fragment``);
      const q = sql(S)`${inner}${tail}`;
      expect(q.params).toEqual(xs);
      const numbers = [...q.text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      expect(numbers).toEqual(xs.map((_, i) => i + 1));
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("a value that is not JSON at any depth throws E2457 naming its 1-based position and no value", () => {
  const bad = fc.constantFrom<unknown>(
    undefined,
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    1n,
    new Date(0),
    () => 0,
    new Set(),
  );
  fc.assert(
    fc.property(fc.array(fc.string(), { maxLength: 4 }), bad, fc.boolean(), (before, v, nested) => {
      const value = nested ? { deep: [v] } : v;
      let thrown: unknown;
      try {
        sql(S)`${fragment`${before.length}`} ${before} ${value}`;
      } catch (e) {
        thrown = e;
      }
      expect(Reflect.get(Object(thrown), "code")).toBe("E2457");
      expect(String(thrown)).toContain("parameter $3 ");
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("a cycle is E2457, a shared value that is no cycle is not", () => {
  const shared = { a: 1 };
  expect(toParam({ x: shared, y: shared }, 1)).toEqual({ x: { a: 1 }, y: { a: 1 } });
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  expect(() => toParam(loop, 4)).toThrow(/E2457 parameter \$4 .*a cycle/);
});

test("an object with a null prototype is plain; a sparse array's hole is undefined", () => {
  const bare = Object.assign(Object.create(null), { k: "v" });
  expect(toParam(bare, 1)).toEqual({ k: "v" });
  // biome-ignore lint/suspicious/noSparseArray: the hole is the case under test
  expect(() => toParam([1, , 3], 2)).toThrow(/E2457 parameter \$2 is not a JSON value: undefined/);
});
