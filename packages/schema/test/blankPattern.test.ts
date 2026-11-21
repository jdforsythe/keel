// The JSON Schema `pattern` of a blank-refusing string is written out as `\u` ranges; this keeps it equal to the blank
// set (`isBlank`, read from the engine's Unicode tables) below U+10000 without `M` and `Cs`. A failure after an engine
// update means the set grew: write the pattern again from the ranges this test prints. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { blankPattern } from "../src/internal/blankPattern.ts";
import { isBlank } from "../src/internal/isBlank.ts";

const MARK_OR_SURROGATE = /^[\p{M}\p{Cs}]$/u;
const hex = (cp: number): string => `\\u${cp.toString(16).toUpperCase().padStart(4, "0")}`;

/** The negated class of the blank BMP characters other than `M` and `Cs`, as ranges, from `isBlank`. */
function derived(): string {
  const ranges: string[] = [];
  let start = -1;
  for (let cp = 0; cp <= 0x10000; cp++) {
    const c = String.fromCharCode(cp);
    const refused = cp < 0x10000 && isBlank(c) && !MARK_OR_SURROGATE.test(c);
    if (refused && start < 0) start = cp;
    if (!refused && start >= 0) {
      ranges.push(start === cp - 1 ? hex(start) : `${hex(start)}-${hex(cp - 1)}`);
      start = -1;
    }
  }
  return `[^${ranges.join("")}]`;
}

describe("blankPattern", () => {
  it("is the blank set's BMP part without `M` and `Cs`, from this engine's tables", () => {
    expect(blankPattern).toBe(derived());
  });

  it("a string matches it whenever `isBlank` is false, with and without the `u` flag", () => {
    const plain = new RegExp(blankPattern);
    const unicode = new RegExp(blankPattern, "u");
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 8 }), (v) => {
        if (!isBlank(v)) {
          expect(plain.test(v)).toBe(true);
          expect(unicode.test(v)).toBe(true);
        }
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
