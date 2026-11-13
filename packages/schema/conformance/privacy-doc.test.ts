// Spec: k.privacy, Conformance "`s.string().pii('contact')` has `doc()` `string pii(contact)` and JSON Schema `x-keel-pii: \"contact\"`."
// Seed: 1337.
// Skipped until `.pii(class)` exists.
// Untestable here: the JSON Schema half. @keel/schema exports no JSON Schema derivation, so `x-keel-pii` cannot be read from its public API.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CLASSES, RUNS, SEED } from "./privacy-fixtures";

describe("k.privacy doc", () => {
  it.skip("s.string().pii('contact') has doc() `string pii(contact)`", () => {
    expect(s.string().pii("contact").doc()).toBe("string pii(contact)");
  });

  it.skip("for every PiiClass, doc() appends ` pii(<class>)` to the unmarked doc", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLASSES), (cls) => {
        expect(s.string().pii(cls).doc()).toBe(`${s.string().doc()} pii(${cls})`);
        expect(s.int().pii(cls).doc()).toBe(`${s.int().doc()} pii(${cls})`);
        expect(s.array(s.string()).pii(cls).doc()).toBe(`${s.array(s.string()).doc()} pii(${cls})`);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it.skip("the marked node gains `pii: <class>`", () => {
    expect(Reflect.get(s.string().pii("contact").node, "pii")).toBe("contact");
  });
});
