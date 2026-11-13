// @vitest-environment happy-dom
// k.a11y Contrast at render: per scheme and breakpoint, large and bold text at 3:1, disabled and hidden text exempt.
import { element } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Button, Text, defineTokens } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
// #767676 on white is 4.54:1; #949494 is 3.03:1; #aaaaaa is 2.32:1.
const tokens = defineTokens({
  color: {
    ok: "#767676",
    mid: "#949494",
    low: "#aaaaaa",
    darkOnly: { light: "#111111", dark: "#aaaaaa" },
    paper: "#ffffff",
  },
  fontSize: { md: "16px", lg: "24px", big: "18.66px" },
  weight: { regular: "400", bold: "700" },
  breakpoint: { md: "768px" },
});
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

describe("render contrast (E1804)", () => {
  it("passes at 4.5:1 and fails below it on the default white", () => {
    expect(check(() => Text({ id: "t", fg: "ok", children: "x" }))).toBe("");
    expect(check(() => Text({ id: "t", fg: "mid", children: "x" }))).toBe("E1804");
  });

  it("judges each scheme: a dark-only failure fails", () => {
    expect(check(() => Text({ id: "t", fg: "darkOnly", children: "x" }))).toBe("E1804");
  });

  it("judges each breakpoint: a color set at md only fails at md", () => {
    expect(check(() => Text({ id: "t", fg: { base: "ok", md: "low" }, children: "x" }))).toBe("E1804");
    expect(check(() => Text({ id: "t", fg: { base: "low", md: "ok" }, children: "x" }))).toBe("E1804");
    expect(check(() => Text({ id: "t", fg: { base: "ok", md: "ok" }, children: "x" }))).toBe("");
  });

  it("large text needs 3:1: 24px, or 18.66px at weight 700", () => {
    expect(check(() => Text({ id: "t", fg: "mid", fontSize: "lg", children: "x" }))).toBe("");
    expect(check(() => Text({ id: "t", fg: "mid", fontSize: "big", weight: "bold", children: "x" }))).toBe("");
    expect(check(() => Text({ id: "t", fg: "mid", fontSize: "big", children: "x" }))).toBe("E1804");
    expect(check(() => Text({ id: "t", fg: "low", fontSize: "lg", children: "x" }))).toBe("E1804");
  });

  it("inherits fg from an ancestor, and disabled or hidden text is exempt", () => {
    expect(check(() => Box({ fg: "mid", children: () => Text({ id: "t", children: "x" }) }))).toBe("E1804");
    expect(check(() => Button({ id: "b", fg: "low", disabled: true, children: "Off" }))).toBe("");
    expect(
      check(() =>
        element("div", (el) => {
          el.hidden = true;
          el.append(Text({ id: "t", fg: "low", children: "x" }));
        }),
      ),
    ).toBe("");
  });

  it("the nearest painted ancestor is the background (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), (depth) => {
        let view = (): Node => Text({ id: "t", fg: "paper", children: "x" });
        for (let i = 0; i < depth; i++) {
          const inner = view;
          view = () => Box({ children: () => inner() });
        }
        const painted = () => Box({ bg: "ok", children: () => view() });
        expect(check(view)).toBe("E1804");
        expect(check(painted)).toBe("");
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});
