// fast-check seed 1337
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { coerceText } from "../src/internal/coerceText.ts";

const blanks = fc.stringMatching(/^[ \t\n　]{1,8}$/);
const run = { seed: 1337, numRuns: 100 };
const absent = { kind: "absent" };

describe("coerceText: blank text", () => {
  it("is absent for an optional string with min >= 1, also under secret", () => {
    fc.assert(
      fc.property(blanks, (blank) => {
        expect(coerceText(s.string({ min: 1 }).optional().node, blank)).toEqual(absent);
        expect(coerceText(s.secret(s.string({ min: 3 })).optional().node, blank)).toEqual(absent);
      }),
      run,
    );
  });
  it("is kept as given for no min, a required key, a nullable key, and non-blank text", () => {
    fc.assert(
      fc.property(blanks, (blank) => {
        const kept = { kind: "value", value: blank };
        expect(coerceText(s.string().optional().node, blank)).toEqual(kept);
        expect(coerceText(s.string({ min: 1 }).node, blank)).toEqual(kept);
        expect(coerceText(s.string({ min: 1 }).nullable().node, blank)).toEqual(kept);
        expect(coerceText(s.string({ min: 1 }).optional().node, `${blank}a`)).toEqual({
          kind: "value",
          value: `${blank}a`,
        });
      }),
      run,
    );
  });
});
