// @vitest-environment happy-dom
// k.a11y Order and focus at render (E1820) and k.testing a11y state: a reversed `direction` over two or more
// focusable elements fails the render check; `rowindex` and `rowcount` state; a `th scope="row"` is a `rowheader`.
// Seed 1337.
import { element } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Button } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { stateOf } from "../src/internal/stateOf.ts";

const tokens = defineTokens({ color: { ink: "#111111" }, breakpoint: { md: "768px" } });
const page = (view: () => Node) => Object.assign(view, { Props: s.object({}) });
const codeOf = (fn: () => void): string => {
  try {
    fn();
    return "";
  } catch (e) {
    return String(Reflect.get(e instanceof Error ? e : {}, "code"));
  }
};
const check = (view: () => Node): string =>
  codeOf(() => render(page(view), { props: {}, artifacts: { tokens } }).dispose());
type Direction = "row" | "column" | "row-reverse" | "column-reverse";
const buttons = (n: number) => () => Array.from({ length: n }, (_, i) => Button({ id: `b${i}`, children: `B${i}` }));

describe("reversed focus order at render (E1820)", () => {
  it("a computed row-reverse or column-reverse over two buttons fails, naming the box", () => {
    for (const direction of ["row-reverse", "column-reverse"] as const) {
      let message = "";
      try {
        render(
          page(() => Box({ id: "bar", direction, children: buttons(2) })),
          {
            props: {},
            artifacts: { tokens },
          },
        ).dispose();
      } catch (e) {
        message = e instanceof Error ? e.message : "";
      }
      expect(message).toContain('id="bar"');
    }
    expect(check(() => Box({ id: "bar", direction: "row-reverse", children: buttons(2) }))).toBe("E1820");
  });

  it("over one button, or a row, it passes; a reversal at md only fails, one undone at md fails at the base", () => {
    expect(check(() => Box({ id: "bar", direction: "row-reverse", children: buttons(1) }))).toBe("");
    expect(check(() => Box({ id: "bar", direction: "row", children: buttons(3) }))).toBe("");
    expect(check(() => Box({ id: "bar", direction: { base: "row", md: "row-reverse" }, children: buttons(2) }))).toBe(
      "E1820",
    );
    expect(check(() => Box({ id: "bar", direction: { base: "row-reverse", md: "row" }, children: buttons(2) }))).toBe(
      "E1820",
    );
  });

  it("a disabled button does not count, and without tokens the check does not run", () => {
    const view = () =>
      Box({
        id: "bar",
        direction: "row-reverse",
        children: () => [Button({ id: "a", children: "A" }), Button({ id: "b", disabled: true, children: "B" })],
      });
    expect(check(view)).toBe("");
    const two = () => Box({ id: "bar", direction: "row-reverse", children: buttons(2) });
    expect(codeOf(() => render(page(two), { props: {} }).dispose())).toBe("");
  });

  it("property: the check fails exactly when the direction reverses over two or more buttons", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Direction>("row", "column", "row-reverse", "column-reverse"),
        fc.integer({ min: 0, max: 3 }),
        (direction, n) => {
          const got = check(() => Box({ id: "bar", direction, children: buttons(n) }));
          expect(got).toBe(direction.endsWith("-reverse") && n >= 2 ? "E1820" : "");
        },
      ),
      { seed: 1337, numRuns: 40 },
    );
  });
});

describe("table state", () => {
  it("rowindex and rowcount are the integer aria values; a th with scope row is a rowheader", () => {
    const t = render(
      page(() =>
        element("table", (table) => {
          table.id = "grid";
          table.setAttribute("aria-rowcount", "10");
          const row = document.createElement("tr");
          row.id = "row2";
          row.setAttribute("aria-rowindex", "2");
          const th = document.createElement("th");
          th.id = "head";
          th.setAttribute("scope", "row");
          th.textContent = "Ada";
          const td = document.createElement("td");
          td.id = "cell";
          td.textContent = "x";
          row.append(th, td);
          const body = document.createElement("tbody");
          body.append(row);
          table.append(body);
        }),
      ),
      { props: {} },
    );
    expect(t.find("grid").state.rowcount).toBe(10);
    expect(t.find("row2").state.rowindex).toBe(2);
    expect(t.find("cell").state.rowindex).toBeUndefined();
    expect(t.find("head").role).toBe("rowheader");
    t.dispose();
  });

  it("an aria-rowindex that is not an integer gives no key", () => {
    for (const v of ["two", "2.5", ""]) {
      const tr = document.createElement("tr");
      tr.setAttribute("aria-rowindex", v);
      expect(stateOf(tr, "row").rowindex).toBeUndefined();
    }
  });
});
