// Spec: std.headless, Conformance "A Disclosure's button click shows the panel and sets `aria-expanded="true"`; a second click hides it."
// Seed: 1337.
// @vitest-environment happy-dom
// Assumptions: "shows the panel" is the part `<id>.panel` without `hidden`, read by id; `aria-expanded` is `find(id).state.expanded`.
import { Disclosure } from "@keel/std-headless";
import { render } from "@keel/testing";
import { Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, el, page, shown, simCtx } from "./fixtures.ts";

const mount = () =>
  render(
    page((c) =>
      Disclosure(
        {
          id: "dsc",
          summary: () => "Shipping details",
          children: () => Text({ id: "dsc.body", children: "Ships in two days." }),
        },
        undefined,
        c,
      ),
    ),
    { props: {}, ctx: simCtx() },
  );

describe("std.headless: Disclosure", () => {
  test.skip('A Disclosure\'s button click shows the panel and sets `aria-expanded="true"`; a second click hides it.', async () => {
    const t = mount();
    expect(t.find("dsc.button").role).toBe("button");
    expect(t.find("dsc.button").state.expanded).toBe(false);
    expect(shown("dsc.panel")).toBe(false);
    await t.fire("dsc.button", { type: "click" });
    expect(t.find("dsc.button").state.expanded).toBe(true);
    expect(shown("dsc.panel")).toBe(true);
    expect(el("dsc.button")?.getAttribute("aria-controls")).toBe("dsc.panel");
    await t.fire("dsc.button", { type: "click" });
    expect(t.find("dsc.button").state.expanded).toBe(false);
    expect(shown("dsc.panel")).toBe(false);
    t.dispose();
  });

  test.skip("after any number of clicks the panel is shown exactly when `aria-expanded` is true (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 7 }), async (n) => {
        const t = mount();
        for (let i = 0; i < n; i++) await t.fire("dsc.button", { type: "click" });
        expect(t.find("dsc.button").state.expanded).toBe(n % 2 === 1);
        expect(shown("dsc.panel")).toBe(n % 2 === 1);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
