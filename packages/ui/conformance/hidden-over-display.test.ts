// @vitest-environment happy-dom
// Spec: k.ui, clause "A `Part` with `hidden` and `direction=\"column\"` is not displayed: the CSS holds `[hidden]{display:none!important}` before the atomic rules."
// k.ui, Conformance "An element with `hidden` is not displayed whatever its style props." (Style props paragraph)
// Seed: 1337 (property over the four `direction` values).
// Live on the main line. "Not displayed" in a browser follows from the rule and `!important`; the computed `display` is Chromium's and is not asserted here.
import { Part } from "@keel/ui/aria";
import { compileStyles } from "@keel/ui/css";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, norm, tokens } from "./fixtures.ts";

const HIDDEN = "[hidden]{display:none!important}";
const directions = ["row", "column", "row-reverse", "column-reverse"] as const;

describe("k.ui: hidden stays hidden whatever the style props", () => {
  it('A `Part` with `hidden` and `direction="column"` carries the hidden attribute and the column class', () => {
    const el = Part({ id: "h.part", role: "generic", hidden: true, direction: "column", children: () => "x" });
    expect(el instanceof HTMLElement).toBe(true);
    if (!(el instanceof HTMLElement)) return;
    expect(el.hasAttribute("hidden")).toBe(true);
    expect(el.classList.contains("k-direction-column")).toBe(true);
  });

  it("the CSS holds `[hidden]{display:none!important}` before the atomic rules", () => {
    const { classes, css } = compileStyles({ tokens, usages: [{ props: { direction: "column" } }] });
    const n = norm(css);
    const hidden = n.indexOf(HIDDEN);
    expect(hidden).toBeGreaterThanOrEqual(0);
    for (const c of classes.flat()) {
      const atomic = n.indexOf(`.${c}{`);
      expect(atomic).toBeGreaterThan(hidden);
    }
  });

  it("the hidden rule is `!important`, and no atomic rule is", () => {
    const { css } = compileStyles({ tokens, usages: [{ props: { direction: "column", p: "2" } }] });
    const atomic = norm(css)
      .split("}")
      .filter((r) => r.includes(".k-"));
    expect(atomic.length).toBeGreaterThan(0);
    expect(atomic.some((r) => r.includes("!important"))).toBe(false);
  });

  it("the hidden rule precedes the atomic rule of any `direction` (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...directions), fc.constantFrom("0", "1", "2", "3"), (direction, p) => {
        const { classes, css } = compileStyles({ tokens, usages: [{ props: { direction, p } }] });
        const n = norm(css);
        const hidden = n.indexOf(HIDDEN);
        expect(hidden).toBeGreaterThanOrEqual(0);
        for (const c of classes.flat()) expect(n.indexOf(`.${c}{`)).toBeGreaterThan(hidden);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
