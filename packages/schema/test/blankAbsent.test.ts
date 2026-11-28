// fast-check seed 1337
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { s } from "../src/index.ts";

const blanks = fc.stringMatching(/^[ \t\n　]{1,8}$/);
const Named = s.format("named", s.string({ min: 1 }), {
  check: (v) => v.length > 0,
  gen: { from: s.string({ min: 1 }), map: (v) => v },
});
const run = { seed: 1337, numRuns: 100 };

describe("decodeStrings: a blank optional string", () => {
  it("is absent when the string has min >= 1, also under secret and format", () => {
    const schemas = [
      s.object({ n: s.string({ min: 1 }).optional() }),
      s.object({ n: s.secret(s.string({ min: 2 })).optional() }),
      s.object({ n: Named.optional() }),
    ];
    fc.assert(
      fc.property(blanks, (blank) => {
        for (const schema of schemas) {
          expect(schema.decodeStrings({ n: blank })).toEqual({ ok: true, value: {} });
          expect(schema.decodeStrings({ n: "" })).toEqual({ ok: true, value: {} });
        }
      }),
      run,
    );
  });
  it("is kept as given with no min, for a required key, and for a nullable key", () => {
    fc.assert(
      fc.property(blanks, (blank) => {
        expect(s.object({ n: s.string().optional() }).decodeStrings({ n: blank })).toEqual({
          ok: true,
          value: { n: blank },
        });
        const required = s.object({ n: s.string({ min: 1 }) }).decodeStrings({ n: blank });
        expect(!required.ok && required.error.data.issues[0]?.rule).toBe("required");
        expect(s.object({ n: s.string({ min: 1 }).nullable() }).decodeStrings({ n: blank }).ok).toBe(false);
      }),
      run,
    );
  });
  it("parse of a typed blank still fails required", () => {
    const r = s.object({ n: s.string({ min: 1 }).optional() }).parse({ n: "  " });
    expect(!r.ok && r.error.data.issues[0]?.rule).toBe("required");
  });
  it("keeps text with a non-blank character exactly as typed", () => {
    const r = s.object({ n: s.string({ min: 1 }).optional() }).decodeStrings({ n: " a " });
    expect(r).toEqual({ ok: true, value: { n: " a " } });
  });
});
