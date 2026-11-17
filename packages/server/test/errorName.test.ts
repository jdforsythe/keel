// A failed peer forward's `diag` names the thrown error's `name` only: never its message, never a name that is not a
// plain identifier. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { errorName } from "../src/internal/errorName.ts";

const SEED = 1337;

describe("errorName", () => {
  it("gives an Error's name and never its message", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        expect(errorName(new TypeError(message))).toBe("TypeError");
        expect(errorName(new Error(message))).toBe("Error");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("gives Error for a name that is not a plain identifier, a thrown non-Error, and a name read that throws", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const e = new Error("m");
        e.name = `${text} /reset/tok`;
        expect(errorName(e)).toBe("Error");
        expect(errorName(text)).toBe("Error");
      }),
      { seed: SEED, numRuns: 100 },
    );
    const trap = new Error("m");
    Object.defineProperty(trap, "name", {
      get() {
        throw new Error("no");
      },
    });
    expect(errorName(trap)).toBe("Error");
    expect(errorName(null)).toBe("Error");
    expect(errorName(Object.assign(new Error("m"), { name: "x".repeat(65) }))).toBe("Error");
  });
});
