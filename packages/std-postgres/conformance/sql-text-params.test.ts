// Spec: std.postgres, Conformance "`sql(S)`select ${"x'; drop table t"}` has `text` `select $1` and `params` `["x'; drop table t"]`; `sql(S)`a ${1} ${fragment`b ${2}`} ${3}` has `text` `a $1 b $2 $3`."
// Spec: std.postgres, API "Each `${value}` is a parameter, never text, numbered `$1`, ... in template order; a `fragment` value is spliced, its own parameters numbered in place; nothing else is spliced."
// Seed: 1337.
// Assumption: `sql` and `fragment` are pure, so tests need no ctx; `Query<T>` is `{ text, params }`; `fragment` is a template tag whose value `sql` splices.
// Skipped until `@keel/std-postgres` exists (the package is built after its conformance).
import { s } from "@keel/schema";
import { fragment, sql } from "@keel/std-postgres";
import fc from "fast-check";
import { expect, test } from "vitest";

const S = s.object({ x: s.string() });
const SEED = 1337;

test('`sql(S)`select ${"x\'; drop table t"}` has `text` `select $1` and `params` `["x\'; drop table t"]`; `sql(S)`a ${1} ${fragment`b ${2}`} ${3}` has `text` `a $1 b $2 $3`.', () => {
  const q = sql(S)`select ${"x'; drop table t"}`;
  expect(q.text).toBe("select $1");
  expect(q.params).toEqual(["x'; drop table t"]);
  const f = sql(S)`a ${1} ${fragment`b ${2}`} ${3}`;
  expect(f.text).toBe("a $1 b $2 $3");
  expect(f.params).toEqual([1, 2, 3]);
});

test("a string parameter is never text: any string gives `select $1` and itself as the one param", () => {
  fc.assert(
    fc.property(fc.string(), (v) => {
      const q = sql(S)`select ${v}`;
      expect(q.text).toBe("select $1");
      expect(q.params).toEqual([v]);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("parameters are numbered in template order, a fragment's own parameters numbered in place", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.boolean(),
      (a, b, c, d) => {
        const q = sql(S)`x ${a} ${fragment`y ${b} z ${d}`} w ${c}`;
        expect(q.text).toBe("x $1 y $2 z $3 w $4");
        expect(q.params).toEqual([a, b, d, c]);
      },
    ),
    { seed: SEED, numRuns: 100 },
  );
});
