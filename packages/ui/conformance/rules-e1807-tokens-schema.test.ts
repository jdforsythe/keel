// k.ui Rule E1807. Property seed: 1337.
import { TokenSchema } from "@keel/ui/tokens";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, tokens } from "./fixtures.ts";

describe("k.ui: E1807 tokens.ts fails TokenSchema", () => {
  it("E1807 accepts the spec tokens (clean counterpart)", () => {
    expect(TokenSchema.parse(tokens).ok).toBe(true);
  });

  it("E1807 rejects a token file with a group outside the closed set", () => {
    expect(TokenSchema.parse({ ...tokens, bogus: { a: "1" } }).ok).toBe(false);
  });

  it("E1807 rejects any unknown group name", () => {
    const known = ["color", "space", "size", "radius", "font", "fontSize", "weight", "shadow", "breakpoint", "motion"];
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }).filter((k) => !known.includes(k) && k !== "__proto__"),
        (k) => {
          expect(TokenSchema.parse({ [k]: { a: "1" } }).ok).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("E1807 rejects non-string token values", () => {
    expect(TokenSchema.parse({ space: { 1: 4 } }).ok).toBe(false);
  });

  it("E1807 rejects a color object missing dark", () => {
    expect(TokenSchema.parse({ color: { fg: { light: "#111" } } }).ok).toBe(false);
  });
});
