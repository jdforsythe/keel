// A failed peer forward's `diag` names the thrown error's `name` only, and only a name from a fixed list of runtime
// error names: never its message, never a name app code chose. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { errorName } from "../src/internal/errorName.ts";

const SEED = 1337;
const RUNTIME = ["Error", "TypeError", "RangeError", "AbortError", "TimeoutError", "DOMException"];

describe("errorName", () => {
  it("gives an Error's name and never its message", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        expect(errorName(new TypeError(message))).toBe("TypeError");
        expect(errorName(new Error(message))).toBe("Error");
        expect(errorName(new DOMException(message, "AbortError"))).toBe("AbortError");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("gives each runtime error name as is", () => {
    for (const name of RUNTIME) expect(errorName(Object.assign(new Error("m"), { name }))).toBe(name);
  });

  it("gives Error for any other name, an identifier-shaped one too", () => {
    expect(errorName(Object.assign(new Error("m"), { name: "tok_a3f9c2e1b4d5" }))).toBe("Error");
    fc.assert(
      fc.property(fc.string(), (name) => {
        fc.pre(!RUNTIME.includes(name));
        expect(errorName(Object.assign(new Error("m"), { name }))).toBe("Error");
      }),
      { seed: SEED, numRuns: 200 },
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z_$][\w$]{0,63}$/), (name) => {
        fc.pre(!RUNTIME.includes(name));
        expect(errorName(Object.assign(new Error("m"), { name }))).toBe("Error");
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("gives Error for a thrown non-Error and a name read that throws", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
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
    expect(errorName({ name: "TypeError" })).toBe("Error");
  });
});
