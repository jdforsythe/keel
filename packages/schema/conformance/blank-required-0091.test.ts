// Spec: k.schema, API "with `min` >= 1, `''` or only whitespace fails rule `required`; JSON Schema adds `pattern: "\\S"`"
// Spec: k.schema, clause "`s.string({ min: 1 })` fails `''` and `' '` with rule `required`." (rfc:0091)
// Seed 1337. Parsing never trims (RFC 0091 B). The spec text does not state the rule of `id` for `''`: not tested.
// JSON Schema `pattern: "\\S"`: untestable from the public API of @keel/schema (no derivation is exported); the
// `gen` clause below keeps the same fact (every generated value has a non-whitespace character).
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures";

const RUNS = 100;
const WS = [" ", "\t", "\n", "\r", " ", " ", "　", " "];
const whitespace = fc.array(fc.constantFrom(...WS), { minLength: 0, maxLength: 20 }).map((a) => a.join(""));
const mins = fc.integer({ min: 1, max: 12 });

const rules = (r: ReturnType<ReturnType<typeof s.string>["parse"]>): string[] =>
  r.ok ? [] : r.error.data.issues.map((i) => i.rule);

describe("k.schema blank required strings (rfc:0091)", () => {
  it("`s.string({ min: 1 })` fails `''` and `' '` with rule `required`.", () => {
    const S = s.string({ min: 1 });
    for (const v of ["", " "]) {
      const r = S.parse(v);
      expect(r.ok).toBe(false);
      expect(rules(r)).toEqual(["required"]);
    }
  });

  it("for every `min` >= 1, any whitespace-only value, `''` included, fails with rule `required`", () => {
    fc.assert(
      fc.property(mins, whitespace, (min, v) => {
        expect(rules(s.string({ min }).parse(v))).toEqual(["required"]);
        expect(rules(s.string({ min, max: min + 40 }).parse(v))).toEqual(["required"]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a non-empty value shorter than `min` that has a non-whitespace character still fails with rule `min`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 12 }), fc.stringMatching(/^[a-z]{1,11}$/), (min, v) => {
        fc.pre(v.length < min);
        expect(rules(s.string({ min }).parse(v))).toEqual(["min"]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("length is counted on the value as given: a value with padding that reaches `min` parses", () => {
    fc.assert(
      fc.property(whitespace, fc.stringMatching(/^[a-z]{1,5}$/), whitespace, (pre, core, post) => {
        const v = `${pre}${core}${post}`;
        const r = s.string({ min: v.length }).parse(v);
        expect(r.ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("parsing never changes a value: `'  milk '` parses to itself", () => {
    const r = s.string({ min: 1 }).parse("  milk ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("  milk ");
    fc.assert(
      fc.property(whitespace, fc.stringMatching(/^[a-z]{1,8}$/), whitespace, (pre, core, post) => {
        const v = `${pre}${core}${post}`;
        const parsed = s.string({ min: 1 }).parse(v);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value).toBe(v);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("`encode` and `parse` stay inverses for a `min` >= 1 string that has padding", () => {
    const S = s.string({ min: 1 });
    fc.assert(
      fc.property(whitespace, fc.stringMatching(/^[a-z]{1,8}$/), whitespace, (pre, core, post) => {
        const v = `${pre}${core}${post}`;
        const r = S.parse(S.encode(v));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toBe(v);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("`gen` for `min` >= 1 yields only strings with a non-whitespace character, and parse accepts them", () => {
    fc.assert(
      fc.property(
        mins.chain((min) => fc.tuple(fc.constant(min), gen(s.string({ min, max: min + 20 })))),
        ([min, v]) => {
          expect(/\S/.test(v)).toBe(true);
          expect(v.length).toBeGreaterThanOrEqual(min);
          expect(s.string({ min, max: min + 20 }).parse(v).ok).toBe(true);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a nested `min` >= 1 string fails with rule `required` at its own path", () => {
    const Todo = s.object({ title: s.string({ min: 1 }), note: s.string().optional() });
    fc.assert(
      fc.property(whitespace, (v) => {
        const r = Todo.parse({ title: v });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.data.issues).toEqual([{ path: ["title"], rule: "required" }]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("a string without `min` accepts whitespace and `''`", () => {
    fc.assert(
      fc.property(whitespace, (v) => {
        expect(s.string().parse(v).ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
