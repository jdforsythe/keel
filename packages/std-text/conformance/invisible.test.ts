// Spec: std.text, clause "`line({ max: 3 })` rejects `'\u{200B}'`, `'\u{3164}'`, `'\u{FEFF}'`, `' \u{E0041}'`, `'a\u{200E}b'`, `'a\u{200F}'` and `'a\u{61C}'`, each with rule `format`, and accepts `'\u{2764}\u{FE0F}'` and `'a\u{200D}b'`."
// Seed 1337
import { line } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

function rules(
  schema: { parse(i: unknown): { ok: boolean; error?: { data: { issues: readonly { rule: string }[] } } } },
  input: unknown,
): string[] {
  const r = schema.parse(input);
  expect(r.ok).toBe(false);
  return r.ok || !r.error ? [] : r.error.data.issues.map((i) => i.rule);
}

test("`line({ max: 3 })` rejects a zero width space alone with rule `format`.", () => {
  expect(rules(line({ max: 3 }), "\u{200B}")).toContain("format");
});

test("`line({ max: 3 })` rejects a Hangul filler alone with rule `format`.", () => {
  expect(rules(line({ max: 3 }), "\u{3164}")).toContain("format");
});

test("`line({ max: 3 })` rejects a byte order mark alone with rule `format`.", () => {
  expect(rules(line({ max: 3 }), "\u{FEFF}")).toContain("format");
});

test("`line({ max: 3 })` rejects a space followed by a tag character with rule `format`.", () => {
  expect(rules(line({ max: 3 }), " \u{E0041}")).toContain("format");
});

test("`line({ max: 3 })` rejects `'a\\u{200E}b'` with rule `format`.", () => {
  expect(rules(line({ max: 3 }), "a\u{200E}b")).toContain("format");
});

test("`line({ max: 3 })` rejects `'a\\u{200F}'` with rule `format`.", () => {
  expect(rules(line({ max: 3 }), "a\u{200F}")).toContain("format");
});

test("`line({ max: 3 })` rejects `'a\\u{61C}'` with rule `format`.", () => {
  expect(rules(line({ max: 3 }), "a\u{61C}")).toContain("format");
});

test("`line({ max: 3 })` accepts a heart with a variation selector.", () => {
  expect(line({ max: 3 }).parse("\u{2764}\u{FE0F}").ok).toBe(true);
});

test("`line({ max: 3 })` accepts `'a\\u{200D}b'`.", () => {
  expect(line({ max: 3 }).parse("a\u{200D}b").ok).toBe(true);
});

// Every code point that is White_Space or Default_Ignorable_Code_Point, less Cc and Bidi_Control.
const HIDDEN: string[] = [];
for (let cp = 0; cp <= 0x10ffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) continue;
  const c = String.fromCodePoint(cp);
  if (/^[\p{White_Space}\p{Default_Ignorable_Code_Point}]$/u.test(c) && !/^[\p{Cc}\p{Bidi_Control}]$/u.test(c)) {
    HIDDEN.push(c);
  }
}

test("`line({ max: 10 })` rejects every non-empty string of only `White_Space` and `Default_Ignorable_Code_Point` characters, each with rule `format` (property).", () => {
  expect(HIDDEN.length).toBeGreaterThan(20);
  fc.assert(
    fc.property(fc.array(fc.constantFrom(...HIDDEN), { minLength: 1, maxLength: 8 }), (cs) => {
      expect(rules(line({ max: 10 }), cs.join(""))).toContain("format");
    }),
    { seed: 1337, numRuns: 200 },
  );
});
