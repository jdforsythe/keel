// Spec: std.text, clause "`line({ max: 3 })` rejects `'\u{2800}'`, `'\u{FFF9}'`, `'\u{FFFB}'`, `'\u{13430}'`, `'\u{301}'`, `'\u{301}\u{302}'` and `'a\u{D800}'`, each with rule `format`, and accepts `'\u{2800}a'`, `'q\u{301}'` and `'a\u{200D}'`."
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

const REJECTED: [string, string][] = [
  ["a Braille blank", "\u{2800}"],
  ["an interlinear annotation anchor", "\u{FFF9}"],
  ["an interlinear annotation terminator", "\u{FFFB}"],
  ["an Egyptian hieroglyph format control", "\u{13430}"],
  ["a combining mark alone", "\u{301}"],
  ["two combining marks alone", "\u{301}\u{302}"],
  ["a letter followed by a lone surrogate", "a\uD800"],
];

for (const [name, value] of REJECTED) {
  test(`\`line({ max: 3 })\` rejects ${name} with rule \`format\`.`, () => {
    expect(rules(line({ max: 3 }), value)).toContain("format");
  });
}

test("`line({ max: 3 })` accepts `'\\u{2800}a'`.", () => {
  expect(line({ max: 3 }).parse("\u{2800}a").ok).toBe(true);
});

test("`line({ max: 3 })` accepts `'q\\u{301}'`.", () => {
  expect(line({ max: 3 }).parse("q\u{301}").ok).toBe(true);
});

test("`line({ max: 3 })` accepts `'a\\u{200D}'`.", () => {
  expect(line({ max: 3 }).parse("a\u{200D}").ok).toBe(true);
});

test("`line({ max: 10 })` rejects every non-empty string of only Braille blanks, interlinear annotation characters, hieroglyph format controls and combining marks, each with rule `format` (property).", () => {
  const blank = fc.constantFrom("\u{2800}", "\u{FFF9}", "\u{FFFA}", "\u{FFFB}", "\u{13430}", "\u{301}", "\u{302}");
  fc.assert(
    fc.property(fc.array(blank, { minLength: 1, maxLength: 6 }), (cs) => {
      expect(rules(line({ max: 10 }), cs.join(""))).toContain("format");
    }),
    { seed: 1337, numRuns: 100 },
  );
});
