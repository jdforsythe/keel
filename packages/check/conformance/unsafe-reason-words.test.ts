// Spec: k.unsafe, Conformance "In `modules/m/unsafe/a.ts`, `unsafe(\"one two three four five six seven\", () => c as T)` is one E1760 at the string and no E1757; with `eight` added to the string, and with the same eight words as a template without substitutions, no E1760; `unsafe(\"a - b - c - d - e - f - g\", () => c as T)` is one E1760."
// Spec: k.unsafe, Rules " E1760 an `unsafe(` justification string of fewer than 8 words, at the string · E1761 a `*.test-d.ts` or `*.test-d.tsx` file not under a `test/` or `conformance/` folder (at its first line), an `import`, `export ... from` or `import()` naming one, at the specifier, or an `unsafe(` call in one, at the call. In this repository `tooling/structure-lint.mjs` reports S0014: an `unsafe(` call in a file of `packages/*` whose lifted range holds no finding E1757 makes. None carries a fix."
// Spec: k.unsafe, Reason " The justification string argues that the escape holds: the invariant that makes it safe and what keeps the invariant true. `keel check` judges its form: E1754 when there is none (k.check), E1760 when it holds fewer than 8 words. A word is a run of non-space characters holding a letter or digit, counted over the string literal's value or the template's cooked text. Whether the argument holds is judged in review: `keel review` lists every call with its reason (R1001, k.escapes), for a person or the `keel-escapes` skill."
// Seed 1337 (every property below). Fixtures are source text over in-memory file maps; the `unsafe` call is built from
// a constant so this file's own source holds no literal call, only fixture text does.
// Ambiguous in the spec: "at the string" names no column; the case asserts the column of the string literal's first
// character (its opening quote).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const U = "unsafe";
const PATH = "modules/m/unsafe/a.ts";
const HELPER = `declare const c: unknown\ntype T = number\nfunction ${U}<V>(reason: string, fn: () => V): V { return fn() }\n`;
const HELPER_LINES = (HELPER.match(/\n/g) ?? []).length;
type Diags = ReturnType<typeof check>["diagnostics"];
const diags = (source: string, path = PATH): Diags => check([{ path, source }], { types: false }).diagnostics;
const of = (ds: Diags, code: string): Diags => ds.filter((d) => d.code === code);
const callSrc = (reason: string, fn = "() => c as T"): string => `${HELPER}export const a = ${U}(${reason}, ${fn})\n`;
const quoted = (words: string): string => `"${words}"`;
const templated = (words: string): string => `\`${words}\``;

/** One word: a run of letters and digits. */
const word = fc.stringMatching(/^[a-z0-9]{1,8}$/);
/** A run of white space between words (spaces and tabs). */
const gap = fc.stringMatching(/^[ \t]{1,3}$/);
/** `n` words separated by runs of white space. */
const wordsOf = (n: number) =>
  fc
    .tuple(fc.array(word, { minLength: n, maxLength: n }), fc.array(gap, { minLength: n, maxLength: n }))
    .map(([ws, gs]) => ws.map((w, i) => (i < n - 1 ? `${w}${gs[i]}` : w)).join(""));
const sized = (min: number, max: number) => fc.integer({ min, max }).chain((n) => fc.tuple(fc.constant(n), wordsOf(n)));
/** Runs with no letter or digit: not words. */
const noise = fc.constantFrom("-", "--", "...", "/", "&", "+", "*", "=>", "()");

describe("k.unsafe Reason: E1760", () => {
  test('`unsafe("one two three four five six seven", () => c as T)` is one E1760 at the string and no E1757', () => {
    const ds = diags(callSrc(quoted("one two three four five six seven")));
    expect(of(ds, "E1760")).toHaveLength(1);
    expect(of(ds, "E1757")).toEqual([]);
    expect(of(ds, "E1760")[0]?.line).toBe(HELPER_LINES + 1);
    expect(of(ds, "E1760")[0]?.col).toBe(`export const a = ${U}(`.length + 1);
  });

  test("with `eight` added to the string, no E1760", () => {
    expect(of(diags(callSrc(quoted("one two three four five six seven eight"))), "E1760")).toEqual([]);
  });

  test("with the same eight words as a template without substitutions, no E1760", () => {
    expect(of(diags(callSrc(templated("one two three four five six seven eight"))), "E1760")).toEqual([]);
  });

  test('`unsafe("a - b - c - d - e - f - g", () => c as T)` is one E1760', () => {
    expect(of(diags(callSrc(quoted("a - b - c - d - e - f - g"))), "E1760")).toHaveLength(1);
  });

  test("property: a string literal of n words is one E1760 for n under 8 and none for n of 8 or more", () => {
    fc.assert(
      fc.property(sized(1, 14), ([n, text]) => {
        expect(of(diags(callSrc(quoted(text))), "E1760")).toHaveLength(n < 8 ? 1 : 0);
      }),
      { seed: SEED, numRuns: 80 },
    );
  });

  test("property: a template without substitutions is counted over its cooked text, as a string literal is", () => {
    fc.assert(
      fc.property(sized(1, 14), ([n, text]) => {
        expect(of(diags(callSrc(templated(text))), "E1760")).toHaveLength(n < 8 ? 1 : 0);
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("property: a run of non-space characters holding no letter or digit is no word", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.array(noise, { minLength: 0, maxLength: 6 }),
        fc.array(word, { minLength: 12, maxLength: 12 }),
        (n, junk, ws) => {
          const mixed = [...ws.slice(0, n), ...junk].join(" ");
          expect(of(diags(callSrc(quoted(mixed))), "E1760")).toHaveLength(n < 8 ? 1 : 0);
        },
      ),
      { seed: SEED, numRuns: 80 },
    );
  });

  test("property: a word is a run of non-space characters, punctuation joined to letters or digits included", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), word, (n, w) => {
        const dotted = Array.from({ length: n }, (_, i) => `${w}-${i}.x`).join(" ");
        expect(of(diags(callSrc(quoted(dotted))), "E1760")).toHaveLength(n < 8 ? 1 : 0);
        const glued = Array.from({ length: n }, () => `${w}-${w}`).join(" ");
        expect(of(diags(callSrc(quoted(glued))), "E1760")).toHaveLength(n < 8 ? 1 : 0);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("property: a reason under 8 words still lifts its range: one E1760 beside, no E1757, no E1754", () => {
    fc.assert(
      fc.property(sized(1, 7), ([, text]) => {
        const ds = diags(callSrc(quoted(text)));
        expect(of(ds, "E1760")).toHaveLength(1);
        expect(of(ds, "E1757")).toEqual([]);
        expect(of(ds, "E1754")).toEqual([]);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("property: E1760 is reported once per call, at each call's own string", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 5 }), (sizes) => {
        const text = (n: number): string => Array.from({ length: n }, (_, k) => `w${k}`).join(" ");
        const lines = sizes.map((n, i) => `export const a${i} = ${U}(${quoted(text(n))}, () => c as T)`);
        const got = of(diags(`${HELPER}${lines.join("\n")}\n`), "E1760").map((d) => d.line);
        const want = sizes.flatMap((n, i) => (n < 8 ? [HELPER_LINES + 1 + i] : []));
        expect(got).toEqual(want);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test("E1760 holds outside an `unsafe/` folder too: a short reason in `src/x.ts` is one E1760", () => {
    // Reading: the Rules sentence names no folder for E1760, so it applies wherever a call is read (as E1754 does).
    const src = `${HELPER}export const x = ${U}("one two", () => 1)\n`;
    expect(of(diags(src, "src/x.ts"), "E1760")).toHaveLength(1);
  });

  test("E1760 carries no fix", () => {
    const ds = of(diags(callSrc(quoted("one two"))), "E1760");
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) expect(d.fix).toBeUndefined();
  });
});
