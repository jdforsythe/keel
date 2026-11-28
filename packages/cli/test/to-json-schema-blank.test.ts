// k.schema Primitives: a `string` with `min` >= 1 fails a blank value with rule `required`; JSON Schema adds a `pattern` of
// `\u` ranges for the blank set's BMP part but `M` and `Cs`. Seed 1337.
import { s } from "@keel/schema";
import { blankPattern } from "@keel/schema/internal";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";

describe("toJsonSchema of a blank-refusing string", () => {
  it("adds the blank `pattern` exactly when `min` >= 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.option(fc.integer({ min: 20, max: 40 }), { nil: undefined }),
        (min, max) => {
          const js = toJsonSchema(s.string(max === undefined ? { min } : { min, max }).node);
          expect(js.pattern).toBe(min >= 1 ? blankPattern : undefined);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("the pattern admits what parse admits for blank and padded text, with and without the `u` flag", () => {
    const S = s.string({ min: 1 });
    const pattern = toJsonSchema(S.node).pattern;
    expect(typeof pattern).toBe("string");
    const source = typeof pattern === "string" ? pattern : "";
    for (const re of [new RegExp(source), new RegExp(source, "u")])
      for (const v of ["", " ", "\t\n", " ", "　", "​", "ㅤ", "⠀", "﻿", " a ", "milk"])
        expect(re.test(v), JSON.stringify(v)).toBe(S.parse(v).ok);
  });
});
