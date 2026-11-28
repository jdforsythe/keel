// Spec: std.text, clause "For every generated string `s` and `max` from 1 to 20, `graphemes(truncate(s, max)) <= max`; `truncate(s, max) === s` exactly when `graphemes(s) <= max`; otherwise the result ends with `…` and the graphemes before it begin `s`, none split. `truncate('Crème brûlée', 6)` is `Crème…`."
// Seed 1337
import { graphemes, truncate } from "@keel/std-text";
import fc from "fast-check";
import { expect, test } from "vitest";

const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
const parts = (v: string): string[] => [...seg.segment(v)].map((x) => x.segment);

const text = fc.oneof(
  fc.fullUnicodeString({ maxLength: 40 }),
  fc
    .array(fc.constantFrom("a", " ", "é", "👨‍👩‍👧", "é", "\n", "\t", "x", "🇯🇵"), { maxLength: 40 })
    .map((a) => a.join("")),
);

test("For every generated string `s` and `max` from 1 to 20, `graphemes(truncate(s, max)) <= max`.", () => {
  fc.assert(
    fc.property(text, fc.integer({ min: 1, max: 20 }), (v, max) => {
      expect(graphemes(truncate(v, max))).toBeLessThanOrEqual(max);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("`truncate(s, max) === s` exactly when `graphemes(s) <= max`.", () => {
  fc.assert(
    fc.property(text, fc.integer({ min: 1, max: 20 }), (v, max) => {
      expect(truncate(v, max) === v).toBe(graphemes(v) <= max);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("Otherwise the result ends with `…` and the graphemes before it begin `s`, none split.", () => {
  fc.assert(
    fc.property(text, fc.integer({ min: 1, max: 20 }), (v, max) => {
      fc.pre(graphemes(v) > max);
      const out = truncate(v, max);
      expect(out.endsWith("…")).toBe(true);
      const body = out.slice(0, -1);
      expect(body).toBe(
        parts(v)
          .slice(0, max - 1)
          .join("")
          .trimEnd(),
      );
      expect(v.startsWith(body)).toBe(true);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("`truncate('Crème brûlée', 6)` is `Crème…`.", () => {
  expect(truncate("Crème brûlée", 6)).toBe("Crème…");
  expect(truncate("ab cd", 4)).toBe("ab…");
});

test("`truncate` throws unless `max` is an integer of at least 1.", () => {
  for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => truncate("abc", bad)).toThrow();
  }
});
