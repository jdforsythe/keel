// Seed 1337
import fc from "fast-check";
import { expect, test, vi } from "vitest";
import { graphemes } from "../src/graphemes.ts";
import { line } from "../src/line.ts";
import { segmenter } from "../src/segmenter.ts";
import { truncate } from "../src/truncate.ts";

function reference(s: string, max: number): string {
  const parts = Array.from(segmenter.segment(s), (x) => x.segment);
  return parts.length <= max
    ? s
    : `${parts
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
}

test("a huge input is rejected and truncated after max + 1 graphemes are read", () => {
  const real = segmenter.segment.bind(segmenter);
  let read = 0;
  const spy = vi.spyOn(segmenter, "segment").mockImplementation((input) => {
    const segments = real(input);
    return {
      containing: (i) => segments.containing(i),
      [Symbol.iterator]() {
        const it = segments[Symbol.iterator]();
        return {
          next: () => {
            read++;
            return it.next();
          },
          [Symbol.iterator]() {
            return this;
          },
        };
      },
    };
  });
  try {
    const big = "a".repeat(2e5);
    expect(line({ max: 80 }).parse(big).ok).toBe(false);
    expect(read).toBeLessThanOrEqual(82);
    read = 0;
    expect(truncate(big, 10)).toBe(`${"a".repeat(9)}…`);
    expect(read).toBeLessThanOrEqual(12);
  } finally {
    spy.mockRestore();
  }
});

test("truncate equals the whole-string reference", () => {
  fc.assert(
    fc.property(fc.string({ unit: "binary" }), fc.integer({ min: 1, max: 20 }), (s, max) => {
      expect(truncate(s, max)).toBe(reference(s, max));
    }),
    { seed: 1337 },
  );
});

test("line rejects every printable value outside its grapheme bounds", () => {
  const t = line({ min: 2, max: 5 });
  fc.assert(
    fc.property(fc.string({ unit: "grapheme-ascii", maxLength: 12 }), (s) => {
      const n = graphemes(s);
      if (n < 2 || n > 5) expect(t.parse(s).ok).toBe(false);
    }),
    { seed: 1337 },
  );
});
