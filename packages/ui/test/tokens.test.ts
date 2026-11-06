// TokenSchema and defineTokens beyond conformance. Seed 1337.
import { gen } from "@keel/schema/gen";
import { TokenSchema, defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("TokenSchema", () => {
  it("reports an unknown group as an enum issue at its path", () => {
    const r = TokenSchema.parse({ space: { 1: "4px" }, colour: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues).toEqual([{ path: ["colour"], rule: "enum" }]);
  });

  it("reports nested color pair issues with full paths", () => {
    const r = TokenSchema.parse({ color: { fg: { light: "#111", dark: 1 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.data.issues).toEqual([{ path: ["color", "fg", "dark"], rule: "type" }]);
      expect(r.error.message).toBe("type at color.fg.dark");
    }
  });

  it("accepts every generated token file and encodes it to equal JSON", () => {
    fc.assert(
      fc.property(gen(TokenSchema), (t) => {
        expect(TokenSchema.parse(t).ok).toBe(true);
        expect(TokenSchema.encode(t)).toEqual(JSON.parse(JSON.stringify(t)));
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("defineTokens throws E1807 for an invalid file", () => {
    const extra = { space: { 1: "4px" }, bogus: { a: "1" } };
    expect(() => defineTokens(extra)).toThrow(expect.objectContaining({ code: "E1807" }));
  });
});
