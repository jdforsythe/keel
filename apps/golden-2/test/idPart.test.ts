import { describe, expect, it } from "vitest";
import { idPart } from "../modules/recipes/idPart.ts";

describe("idPart", () => {
  it("keeps minted and fixture ids, and turns any other id into one part with no whitespace or quote", () => {
    expect(idPart("r1")).toBe("r1");
    expect(idPart("0b9c2a4e-6f1d-4c8b-9a3e-2d7f5b1c8e40")).toBe("0b9c2a4e-6f1d-4c8b-9a3e-2d7f5b1c8e40");
    expect(idPart('" ')).toBe("%22%20");
    expect(idPart("a b")).not.toBe(idPart("a%20b"));
  });
});
