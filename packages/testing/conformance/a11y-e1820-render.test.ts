// @vitest-environment happy-dom
// Spec: k.a11y, Conformance "A `renderRoute` page with tokens whose `Box` takes a computed `direction` `row-reverse` over two `Button`s fails with E1820 naming the `Box`'s id; over one `Button`, or with `row`, it passes, and after `keel test` with that passing run `keel ledger` gives the route's `#2.4.3` and `#1.3.2` rung `example`."
// Spec: k.a11y, Order and focus "At render, with tokens, an element whose atomic classes give a reversed `direction` at any breakpoint over two or more elements of its focus order is E1820 too, naming its element id."
// Seed: 1337. Assumed (spec names no seam): the tokens reach `renderRoute` as `artifacts: { tokens }`, as in a11y-render-contrast.test.ts.
// The `keel ledger` half (#2.4.3, #1.3.2) is packages/cli/conformance/a11y-ledger-e1820-0191.test.ts.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { renderRoute } from "@keel/testing";
import { Box, Button, defineTokens } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

const tokens = defineTokens({ color: { fg: "#111111", bg: "#ffffff" } });
const rc = contract("rv", { "rv.page": { path: "/rv" } });
// `direction` reaches the Box as a run-time argument, so no static check could see it.
type Direction = "row" | "row-reverse" | "column" | "column-reverse";
const open = (direction: Direction, buttons: number) =>
  renderRoute("rv.page", {
    routes: manifest(rc, {
      "rv.page": {
        component: () =>
          Box({
            id: "rv.box",
            direction,
            children: () => Array.from({ length: buttons }, (_, i) => Button({ id: `rv.b${i}`, children: `B${i}` })),
          }),
        title: () => "Reverse",
      },
    }),
    ctx: simCtx(),
    artifacts: { tokens },
  });

describe("k.a11y: E1820 at render", () => {
  it("a `renderRoute` page with tokens whose `Box` takes a computed `direction` `row-reverse` over two `Button`s fails with E1820 naming the `Box`'s id", async () => {
    const e = await thrown(() => open("row-reverse", 2));
    expect(codeOf(e)).toBe("E1820");
    expect(messageOf(e)).toContain("rv.box");
  });

  it("over one `Button` it passes", async () => {
    const h = await open("row-reverse", 1);
    h.dispose();
  });

  it("with `direction` `row` over two `Button`s it passes", async () => {
    const h = await open("row", 2);
    h.dispose();
  });

  it("for any direction and any button count, the render fails with E1820 exactly when the direction is reversed over two or more (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("row", "row-reverse", "column", "column-reverse"),
        fc.integer({ min: 0, max: 4 }),
        async (direction, buttons) => {
          const e = await thrown(async () => (await open(direction, buttons)).dispose());
          if (direction.endsWith("-reverse") && buttons >= 2) {
            expect(codeOf(e)).toBe("E1820");
            expect(messageOf(e)).toContain("rv.box");
          } else expect(e).toBeUndefined();
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });
});
