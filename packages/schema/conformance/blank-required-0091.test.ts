// k.schema, Primitives "`string` (`{ min, max }`; with `min` >= 1, a blank value fails rule `required` (no character outside `White_Space`, `Default_Ignorable_Code_Point`, `Cc`, `Cf`, `Cs`, `M`, U+2800)"
// Spec: k.schema, clause "`s.string({ min: 1 })` fails `''`, `' '`, U+200B, U+3164 and a lone U+0301 with rule `required`; `decodeStrings` drops each if optional; the JSON Schema `pattern` refuses exactly the blank values without `M`, `Cs` or non-BMP characters." (rfc:0091, rfc:0152)
// k.schema, `decodeStrings`: "for an optional key `''` is absent, as is a blank value for a `string` with `min` >= 1;"
// Seed 1337. Parsing never trims (RFC 0091 B). The spec text does not state the rule of `id` for `''`: not tested.
// The blank set is the oracle `BLANK` below, written from the spec's list. The JSON Schema `pattern` clause is untestable from
// @keel/schema (no derivation is exported): packages/cli/conformance/json-schema-blank.test.ts covers it.
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED } from "./fixtures";

const RUNS = 100;
const WS = [" ", "\t", "\n", "\r", " ", " ", "　", " "];
const whitespace = fc.array(fc.constantFrom(...WS), { minLength: 0, maxLength: 20 }).map((a) => a.join(""));
/** The blank set: no character outside White_Space, Default_Ignorable_Code_Point, Cc, Cf, Cs, M and U+2800. */
const BLANK_CHAR = /^[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cs}\p{M}\u2800]$/u;
const isBlankChar = (c: string): boolean => BLANK_CHAR.test(c);
const isBlank = (v: string): boolean => [...v].every(isBlankChar);
const POINTS: string[] = [];
for (let cp = 0; cp <= 0x10ffff; cp++) POINTS.push(String.fromCodePoint(cp));
/** Blank characters that are not surrogates (joining lone surrogates could form a pair). */
const BLANK = POINTS.filter((c) => isBlankChar(c) && !/^\p{Cs}$/u.test(c));
const FILLED = POINTS.filter((c) => !isBlankChar(c));
const HIGH = POINTS.slice(0xd800, 0xdc00);
const LOW = POINTS.slice(0xdc00, 0xe000);
const pick = (pool: readonly string[]): fc.Arbitrary<string> => fc.nat(pool.length - 1).map((i) => pool[i] ?? "");
/** Blank strings from the whole set: its characters, plus lone surrogates (lows before highs, so no pair forms). */
const blank = fc
  .tuple(
    fc.array(pick(BLANK), { minLength: 0, maxLength: 12 }),
    fc.array(pick(LOW), { minLength: 0, maxLength: 3 }),
    fc.array(pick(HIGH), { minLength: 0, maxLength: 3 }),
  )
  .map(([a, lo, hi]) => `${a.join("")}${lo.join("")}${hi.join("")}`);
const mins = fc.integer({ min: 1, max: 12 });

const rules = (r: { ok: true } | { ok: false; error: { data: { issues: readonly { rule: string }[] } } }): string[] =>
  r.ok ? [] : r.error.data.issues.map((i) => i.rule);

describe("k.schema blank required strings (rfc:0091)", () => {
  it("`s.string({ min: 1 })` fails `''`, `' '`, U+200B, U+3164 and a lone U+0301 with rule `required`; `decodeStrings` drops each if optional", () => {
    const S = s.string({ min: 1 });
    const O = s.object({ n: s.string({ min: 1 }).optional() });
    for (const v of ["", " ", "\u200B", "\u3164", "\u0301"]) {
      const r = S.parse(v);
      expect(r.ok).toBe(false);
      expect(rules(r)).toEqual(["required"]);
      expect(O.decodeStrings({ n: v })).toEqual({ ok: true, value: {} });
    }
  });

  it("the blank set: for every `min` >= 1, any string of blank characters (White_Space, Default_Ignorable_Code_Point, Cc, Cf, Cs, M, U+2800) fails with rule `required`, `decodeStrings` drops it if optional", () => {
    fc.assert(
      fc.property(mins, blank, (min, v) => {
        expect(isBlank(v)).toBe(true);
        expect(rules(s.string({ min }).parse(v))).toEqual(["required"]);
        expect(rules(s.string({ min, max: min + 40 }).parse(v))).toEqual(["required"]);
        const O = s.object({ n: s.string({ min }).optional() });
        expect(O.decodeStrings({ n: v })).toEqual({ ok: true, value: {} });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("the complement: a string with one character outside the blank set, anywhere, parses for `min: 1`, and decodeStrings keeps it", () => {
    fc.assert(
      fc.property(blank, pick(FILLED), blank, (pre, c, post) => {
        const v = `${pre}${c}${post}`;
        fc.pre(!isBlank(v));
        expect(s.string({ min: 1 }).parse(v).ok).toBe(true);
        const d = s.object({ n: s.string({ min: 1 }).optional() }).decodeStrings({ n: v });
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.value).toEqual({ n: v });
      }),
      { seed: SEED, numRuns: RUNS },
    );
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

  it("`gen` for `min` >= 1 yields only strings with a character outside the blank set, and parse accepts them", () => {
    fc.assert(
      fc.property(
        mins.chain((min) => fc.tuple(fc.constant(min), gen(s.string({ min, max: min + 20 })))),
        ([min, v]) => {
          expect(isBlank(v)).toBe(false);
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
      fc.property(blank, (v) => {
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

  it("`decodeStrings` drops both if optional", () => {
    const Opt = s.object({ n: s.string({ min: 1 }).optional() });
    const Plain = s.object({ n: s.string().optional() });
    const Req = s.object({ n: s.string({ min: 1 }) });
    expect(Opt.decodeStrings(new URLSearchParams("n="))).toEqual({ ok: true, value: {} });
    fc.assert(
      fc.property(mins, whitespace, (min, v) => {
        const O = s.object({ n: s.string({ min }).optional() });
        // optional with `min` >= 1: '' and whitespace-only are absent, and parse accepts the result
        for (const blank of ["", v]) {
          const d = O.decodeStrings({ n: blank });
          expect(d.ok).toBe(true);
          if (d.ok) {
            expect(d.value).toEqual({});
            expect("n" in d.value).toBe(false);
          }
        }
        expect(Opt.decodeStrings({ n: v }).ok).toBe(true);
        // required: kept as given, so it fails with rule `required`
        const r = Req.decodeStrings({ n: v });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.data.issues).toEqual([{ path: ["n"], rule: "required" }]);
        // optional without `min`: '' is absent, whitespace is content and kept as given (never trimmed)
        const p = Plain.decodeStrings({ n: v });
        expect(p.ok).toBe(true);
        if (p.ok) expect(p.value).toEqual(v === "" ? {} : { n: v });
        // parse of a typed blank is unchanged
        expect(rules(Opt.parse({ n: v === "" ? " " : v }))).toEqual(["required"]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("`decodeStrings` never trims: a value with a non-whitespace character stays as typed for an optional key", () => {
    const Opt = s.object({ n: s.string({ min: 1 }).optional() });
    fc.assert(
      fc.property(whitespace, fc.stringMatching(/^[a-z]{1,5}$/), whitespace, (pre, core, post) => {
        const v = `${pre}${core}${post}`;
        const d = Opt.decodeStrings({ n: v });
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.value).toEqual({ n: v });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
