// k.schema, clause "`enum` (`{ pathDefault }`: the value a leading path param leaves out of the URL, k.prefix)" (rfc:0079); ADR-0070: parse, encode and gen ignore `pathDefault`.
// Seed 1337.
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const values = ["en-US", "de-DE", "ja-JP"] as const;
const Plain = s.enum(values);
const Prefixed = s.enum(values, { pathDefault: "en-US" });

describe("k.schema enum pathDefault", () => {
  test("`parse`, `encode` and `gen` of an enum ignore `pathDefault`", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constantFrom(...values), fc.string(), fc.integer()), (v) => {
        const a = Plain.parse(v);
        const b = Prefixed.parse(v);
        expect(b.ok).toBe(a.ok);
        if (a.ok && b.ok) expect(Prefixed.encode(b.value)).toEqual(Plain.encode(a.value));
        if (!a.ok && !b.ok) expect(b.error.data.issues).toEqual(a.error.data.issues);
      }),
      { seed: 1337, numRuns: 100 },
    );
    fc.assert(
      fc.property(gen(Prefixed), (v) => {
        expect(values).toContain(v);
        expect(Plain.parse(v).ok).toBe(true);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
