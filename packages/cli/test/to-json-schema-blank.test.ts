// k.schema API: a `string` with `min` >= 1 fails blank values with rule `required`; JSON Schema adds `pattern: "\\S"`. Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/internal/toJsonSchema.ts";

describe("toJsonSchema of a blank-refusing string", () => {
  it("adds `pattern: \\S` exactly when `min` >= 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.option(fc.integer({ min: 20, max: 40 }), { nil: undefined }),
        (min, max) => {
          const js = toJsonSchema(s.string(max === undefined ? { min } : { min, max }).node);
          expect(js.pattern).toBe(min >= 1 ? "\\S" : undefined);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("the pattern admits what parse admits for whitespace and padded text", () => {
    const S = s.string({ min: 1 });
    const pattern = toJsonSchema(S.node).pattern;
    expect(typeof pattern).toBe("string");
    const re = new RegExp(typeof pattern === "string" ? pattern : "", "u");
    for (const v of ["", " ", "\t\n", " ", "　", " a ", "milk"]) expect(re.test(v)).toBe(S.parse(v).ok);
  });
});
