// TokenSchema and defineTokens beyond conformance. Seed 1337.
import { gen } from "@keel/schema/gen";
import { TokenSchema, defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("TokenSchema", () => {
  it("reports an unknown group as an unknown-key issue at its path", () => {
    const r = TokenSchema.parse({ space: { 1: "4px" }, colour: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues).toEqual([{ path: ["colour"], rule: "unknown-key" }]);
  });

  it("rejects a color pair with an extra key and a non-string, non-pair color", () => {
    const extra = TokenSchema.parse({ color: { fg: { light: "#111", dark: "#eee", hc: "#000" } } });
    if (!extra.ok) expect(extra.error.data.issues).toEqual([{ path: ["color", "fg", "hc"], rule: "unknown-key" }]);
    expect(extra.ok).toBe(false);
    const num = TokenSchema.parse({ color: { fg: 1 } });
    if (!num.ok) expect(num.error.data.issues).toEqual([{ path: ["color", "fg"], rule: "type" }]);
    expect(num.ok).toBe(false);
  });

  it("describes the closed shape in its doc and node", () => {
    expect(TokenSchema.doc().split("\n")[0]).toBe("{|");
    expect(TokenSchema.doc()).toContain("color?: record<string | {| light: string, dark: string |}>");
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
