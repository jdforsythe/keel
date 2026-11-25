// @vitest-environment happy-dom
// Spec: k.a11y, clause "A `renderRoute` page whose text is 4.4:1 against a `bg` set in another component fails with E1804 naming the text's element id; at 4.6:1 it passes."
// Seed: 1337.
// Assumed (spec names no seam): the tokens reach `renderRoute` as `artifacts: { tokens }`, as `a11y.json` reaches `render`.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { renderRoute } from "@keel/testing";
import { Box, Text, defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

const hex = (n: number): string => `#${n.toString(16).padStart(2, "0").repeat(3)}`;
const lum = (n: number): number => {
  const c = n / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const ratioOf = (n: number): number => 1.05 / (lum(n) + 0.05); // gray n against white
const grayAt = (target: number): number => {
  let best = 0;
  for (let n = 0; n < 256; n++) if (Math.abs(ratioOf(n) - target) < Math.abs(ratioOf(best) - target)) best = n;
  return best;
};

// The shell component sets the `bg`; the page component, another one, holds the text.
const ctContract = contract("ct", { "ct.shell": { layout: true }, "ct.page": { path: "/ct" } });
const routesFor = () =>
  manifest(ctContract, {
    "ct.shell": {
      component: (props) =>
        Box({ id: "ct.box", bg: "bg", children: () => (props.children === undefined ? "" : props.children()) }),
    },
    "ct.page": {
      component: () => Text({ id: "ct.msg", fg: "fg", children: "hello" }),
      layout: "ct.shell",
      title: () => "Contrast",
    },
  });

const open = (gray: number) =>
  renderRoute("ct.page", {
    routes: routesFor(),
    ctx: simCtx(),
    artifacts: { tokens: defineTokens({ color: { fg: hex(gray), bg: "#ffffff" } }) },
  });

describe("k.a11y: render contrast across components (E1804)", () => {
  it("A `renderRoute` page whose text is 4.4:1 against a `bg` set in another component fails with E1804 naming the text's element id", async () => {
    const g = grayAt(4.4);
    expect(ratioOf(g)).toBeLessThan(4.5);
    const e = await thrown(() => open(g));
    expect(codeOf(e)).toBe("E1804");
    expect(messageOf(e)).toContain("ct.msg");
  });

  it("at 4.6:1 it passes", async () => {
    const g = grayAt(4.6);
    expect(ratioOf(g)).toBeGreaterThanOrEqual(4.5);
    const h = await open(g);
    expect(h.find("ct.msg").text).toBe("hello");
    h.dispose();
  });

  it("for any gray, the render fails with E1804 exactly when the ratio is below 4.5 (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 255 }), async (g) => {
        fc.pre(Math.abs(ratioOf(g) - 4.5) > 0.01);
        const e = await thrown(async () => (await open(g)).dispose());
        if (ratioOf(g) < 4.5) {
          expect(codeOf(e)).toBe("E1804");
          expect(messageOf(e)).toContain("ct.msg");
        } else expect(e).toBeUndefined();
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("with no painted ancestor the background is #FFFFFF", async () => {
    const ctContract2 = contract("ct", { "ct.bare": { path: "/bare" } });
    const routes = manifest(ctContract2, {
      "ct.bare": { component: () => Text({ id: "ct.bare", fg: "fg", children: "x" }) },
    });
    const g = grayAt(4.4);
    const e = await thrown(() =>
      renderRoute("ct.bare", {
        routes,
        ctx: simCtx(),
        artifacts: { tokens: defineTokens({ color: { fg: hex(g), bg: "#000000" } }) },
      }),
    );
    expect(codeOf(e)).toBe("E1804");
    expect(messageOf(e)).toContain("ct.bare");
  });
});
