// Spec: k.ui, Conformance "A 200-character unbroken string in a 320px `Box` keeps the document 320px wide."
// Seed: 1337 (property over string length).
// Not built yet: the cases are `test.skip`; the builder changes `test.skip` to `test` in each.
// The document width in Chromium is not testable here (no browser in this suite); the `body` rule `overflow-wrap: anywhere` in the `keel.base` layer is what it follows from, and is asserted.
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./fixtures.ts";
import { baseLayer, compileWith, ruleBody } from "./base-support.ts";

describe("k.ui: a long unbroken string does not widen the page", () => {
  test.skip("the `keel.base` layer holds `body` with `overflow-wrap: anywhere`", () => {
    const { css } = compileWith({}, []);
    const layer = baseLayer(css);
    expect(layer).not.toBeNull();
    expect(ruleBody(layer ?? "", "body") ?? "").toContain("overflow-wrap:anywhere");
  });

  test.skip("it does so with or without a `base.page` set, which adds to the `body` rule and does not replace it", () => {
    fc.assert(
      fc.property(fc.boolean(), (withPage) => {
        const { css } = compileWith(withPage ? { base: { page: { fg: "fg", bg: "bg" } } } : {}, []);
        expect(ruleBody(baseLayer(css) ?? "", "body") ?? "").toContain("overflow-wrap:anywhere");
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});
