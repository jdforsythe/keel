// @vitest-environment happy-dom
// Spec: k.a11y, Conformance "`focusOrder()` lists focusable element ids in document order without disabled or hidden ones."
// Seed: 1337.
// Assumed: `focusOrder()` is a method of the `render` handle returning `string[]`; a hidden element is one with the `hidden` attribute.
import { element } from "@keel/runtime-dom/ops";
import { render } from "@keel/testing";
import { Box, Button, Input } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";
import { page } from "./ui-fixtures.ts";

describe("k.a11y: focusOrder()", () => {
  it("`focusOrder()` lists focusable element ids in document order without disabled or hidden ones", () => {
    const t = render(
      page(() =>
        Box({
          id: "fo.root",
          children: () => [
            Button({ id: "fo.a", children: "A" }),
            Input({ id: "fo.b", label: "B" }),
            Button({ id: "fo.off", children: "Off", disabled: true }),
            element("button", (el) => {
              el.id = "fo.hid";
              el.hidden = true;
              el.textContent = "Hidden";
            }),
            Button({ id: "fo.c", children: "C" }),
          ],
        }),
      ),
      { props: {}, ctx: simCtx() },
    );
    expect(t.focusOrder()).toEqual(["fo.a", "fo.b", "fo.c"]);
    t.dispose();
  });

  it("the order is the document order of the buttons for any count (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), (n) => {
        const ids = Array.from({ length: n }, (_, i) => `fo.b${i}`);
        const t = render(
          page(() => Box({ id: "fo.r", children: () => ids.map((id) => Button({ id, children: id })) })),
          { props: {}, ctx: simCtx() },
        );
        expect(t.focusOrder()).toEqual(ids);
        t.dispose();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("an enabled and a disabled button of any mix: only the enabled ones, in order (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 0, maxLength: 8 }), (flags) => {
        const t = render(
          page(() =>
            Box({
              id: "fo.r",
              children: () => flags.map((off, i) => Button({ id: `fo.m${i}`, children: "x", disabled: off })),
            }),
          ),
          { props: {}, ctx: simCtx() },
        );
        const want = flags.flatMap((off, i) => (off ? [] : [`fo.m${i}`]));
        expect(t.focusOrder()).toEqual(want);
        t.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
