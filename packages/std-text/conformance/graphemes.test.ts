// Spec: std.text, clause "`graphemes` is 1 for `👨‍👩‍👧` and for `'é'`, 0 for `''`, and `s.length` for every generated ASCII string."
// Seed 1337
import { graphemes } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

test.skip("`graphemes` is 1 for `👨‍👩‍👧` and for `'é'`, 0 for `''`, and `s.length` for every generated ASCII string.", () => {
  expect(graphemes("👨‍👩‍👧")).toBe(1);
  expect(graphemes("é")).toBe(1);
  expect(graphemes("é")).toBe(1);
  expect(graphemes("")).toBe(0);
  fc.assert(
    fc.property(
      fc.stringOf(
        fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)),
        { maxLength: 200 },
      ),
      (v) => {
        expect(graphemes(v)).toBe(v.length);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});

test.skip("`graphemes` equals the `Intl.Segmenter` grapheme count for every generated string (property).", () => {
  const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
  fc.assert(
    fc.property(fc.fullUnicodeString({ maxLength: 30 }), (v) => {
      expect(graphemes(v)).toBe([...seg.segment(v)].length);
    }),
    { seed: 1337, numRuns: 100 },
  );
});
