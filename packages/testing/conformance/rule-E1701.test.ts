// @vitest-environment happy-dom
// Spec: k.testing Rules, E1701 DOM selector or DOM query in a test. Seed: 1337.
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Button, SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

describe("k.testing: E1701 DOM selector or DOM query in a test", () => {
  it("E1701 find with a selector string rejects/throws with E1701", async () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("#save", ".y", "div", "button[disabled]", "> p"), async (sel) => {
        const e = await thrown(() => t.find(sel));
        expect(codeOf(e)).toBe("E1701");
        expect(messageOf(e)).toContain("E1701");
      }),
      { seed: SEED, numRuns: 25 },
    );
    t.dispose();
  });

  it("E1701 fire with a selector string rejects with E1701", async () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    expect(codeOf(await thrown(() => t.fire("#save", { type: "click" })))).toBe("E1701");
    t.dispose();
  });

  it("E1701 a11y(id) with a selector string rejects/throws with E1701", async () => {
    const t = render(Button, { props: { label: "Save", disabled: false }, ctx: simCtx() });
    expect(codeOf(await thrown(() => t.a11y("#save")))).toBe("E1701");
    t.dispose();
  });

  it.skip("E1701 static form (querySelector, getByRole, container in test source) is a check-time lint: untestable at runtime", () => {});
});
