// Spec: std.text, clause "`line({ max: 3 })` accepts three `👨‍👩‍👧` (24 code units) and rejects four; it rejects `''`, `'a\nb'`, `'a‮b'`, `'a\u0007'` and `'é'` (not NFC), each with rule `format`. `para({ max: 3 })` accepts `'a\nb'` and rejects `'a\r\nb'`."
// Seed 1337
import { line, para } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

const FAMILY = "👨‍👩‍👧";

function rules(
  schema: { parse(i: unknown): { ok: boolean; error?: { data: { issues: readonly { rule: string }[] } } } },
  input: unknown,
): string[] {
  const r = schema.parse(input);
  expect(r.ok).toBe(false);
  return r.ok || !r.error ? [] : r.error.data.issues.map((i) => i.rule);
}

// Independent oracle for the `line` predicate.
const BIDI = /\p{Bidi_Control}/u;
const CONTROL = new RegExp("[\\p{Cc}" + String.fromCharCode(0x2028, 0x2029) + "]", "u");
const BLANK = { test: (v: string): boolean => !/[^\p{White_Space}\p{Default_Ignorable_Code_Point}]/u.test(v) };
function lineOk(v: string, min: number, max: number, allowLf: boolean): boolean {
  const text = allowLf ? v.replaceAll("\n", "") : v;
  const n = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(v)].length;
  return (
    v.normalize("NFC") === v &&
    (v === "" || !BLANK.test(v)) &&
    !BIDI.test(text) &&
    !CONTROL.test(text) &&
    n >= min &&
    n <= max
  );
}

test("`line({ max: 3 })` accepts three `👨‍👩‍👧` (24 code units) and rejects four; it rejects `''`, `'a\\nb'`, `'a‮b'`, `'a\\u0007'` and `'é'` (not NFC), each with rule `format`.", () => {
  const l = line({ max: 3 });
  expect(FAMILY.repeat(3).length).toBe(24);
  expect(l.parse(FAMILY.repeat(3)).ok).toBe(true);
  expect(l.parse(FAMILY.repeat(4)).ok).toBe(false);
  for (const bad of ["", "a\nb", "a‮b", "a\u0007", "é"]) {
    expect(rules(l, bad)).toContain("format");
  }
});

test("`line({ max: 3 })` rejects every string with a control character, U+2028, U+2029 or a `Bidi_Control` character, each with rule `format` (property).", () => {
  const forbidden = fc.oneof(
    fc.integer({ min: 0, max: 0x1f }),
    fc.integer({ min: 0x7f, max: 0x9f }),
    fc.constantFrom(0x2028, 0x2029),
    fc.constantFrom(0x061c, 0x200e, 0x200f),
    fc.integer({ min: 0x202a, max: 0x202e }),
    fc.integer({ min: 0x2066, max: 0x2069 }),
  );
  fc.assert(
    fc.property(fc.constantFrom("a", "b", "é"), forbidden, fc.constantFrom("", "x"), (head, cp, tail) => {
      const v = `${head}${String.fromCodePoint(cp)}${tail}`;
      expect(rules(line({ max: 10 }), v)).toContain("format");
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("`line` accepts a string exactly when it is NFC, has no forbidden character and has `min` to `max` graphemes (property).", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 12 }), fc.integer({ min: 0, max: 3 }), (v, min) => {
      const max = min + 4;
      expect(line({ min, max }).parse(v).ok).toBe(lineOk(v, min, max, false));
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("`para({ max: 3 })` accepts `'a\\nb'` and rejects `'a\\r\\nb'`.", () => {
  const p = para({ max: 3 });
  expect(p.parse("a\nb").ok).toBe(true);
  expect(rules(p, "a\r\nb")).toContain("format");
});

test("`para` accepts a string exactly when it is `line`-valid apart from U+000A (property).", () => {
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 12 }), (v) => {
      expect(para({ max: 10 }).parse(v).ok).toBe(lineOk(v, 1, 10, true));
    }),
    { seed: 1337, numRuns: 100 },
  );
});
