import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isReverseDns } from "../src/hosting/isReverseDns.ts";

const label = fc
  .tuple(fc.constantFrom(..."abcxyzABZ"), fc.stringMatching(/^[a-z0-9_-]{0,8}$/))
  .map(([a, b]) => `${a}${b}`);

describe("isReverseDns", () => {
  it("two or more labels starting with a letter are reverse-DNS", () => {
    fc.assert(
      fc.property(fc.array(label, { minLength: 2, maxLength: 5 }), (labels) => {
        expect(isReverseDns(labels.join("."))).toBe(true);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  it("one label is not", () => {
    fc.assert(
      fc.property(label, (l) => {
        expect(isReverseDns(l)).toBe(false);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  it("an empty label, a label starting with a digit, or another character is not", () => {
    for (const id of ["", "com.", ".com.acme", "com..acme", "com.1acme", "com.acme shop", "com/acme.x", "com.ac.me!"])
      expect(isReverseDns(id), id).toBe(false);
    for (const id of ["dev.keel.nativetauri", "com.acme.p", "a.b", "com.my-app.x_1"])
      expect(isReverseDns(id), id).toBe(true);
  });
});
