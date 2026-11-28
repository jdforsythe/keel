// @vitest-environment happy-dom
// k.ui Base elements: `Text role` is `status` or `alert`, written as the `role` attribute whatever the tag; a
// parsed-JSON value outside the pair throws before any element is created, as `as` does.
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const TEXT = ["span", "p", "strong", "em", "small", "code", "pre", "blockquote"] as const;
const roleOf = (n: Node): string | null => (n instanceof Element ? n.getAttribute("role") : null);

describe("Text role", () => {
  it("writes the role on every tag and leaves `as` as it is", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT), fc.constantFrom("status" as const, "alert" as const), (as, role) => {
        const n = Text({ as, role, children: "x" });
        expect(roleOf(n)).toBe(role);
        expect(n instanceof Element ? n.localName : "").toBe(as);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("a parsed-JSON role outside the pair throws", () => {
    for (const v of ['"button"', '"log"', '"STATUS"', '""', "1", "null", '["status"]']) {
      expect(() => Text({ ...JSON.parse(`{"role":${v}}`) }), v).toThrow(/k\.ui: Text role=/);
    }
  });
});
