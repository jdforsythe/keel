// @vitest-environment happy-dom
// k.gamut Judging at render: an overlay outside sRGB is composited within each form it ships in, sRGB and P3, the lower
// ratio standing and its form named.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Text } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";
import { describe, expect, it } from "vitest";

// oklch(60% 0.3 150 / 0.8) over #FFFFFF composites to rgb(51 177 94) in sRGB (2.77:1 with #FFFFFF) and to display-p3
// channels 51, 181, 79 of 255 in P3 (2.74:1); color(display-p3 0 0.66 0 / 0.95) to rgb(13 171 17) (3.07:1) and
// display-p3 13, 173, 13 (3.09:1).
const tokensWith = (scrim: string) =>
  defineTokens({
    color: { card: "#FFFFFF", on: "#FFFFFF" },
    overlay: { scrim: { value: scrim, over: ["card"] } },
    fontSize: { lg: "24px" },
  });
const page = (view: () => Node) => Object.assign(view, { Props: s.object({}) });
const helpOf = (scrim: string): string => {
  try {
    render(
      page(() =>
        Box({
          bg: "card",
          children: Box({ bg: "scrim", children: Text({ id: "t", fg: "on", fontSize: "lg", children: "x" }) }),
        }),
      ),
      { props: {}, artifacts: { tokens: tokensWith(scrim) } },
    ).dispose();
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

describe("render contrast on an overlay in each gamut form (E1804)", () => {
  it("fails large text at the P3 composite, the lower of the two, and names its form", () => {
    const help = helpOf("oklch(60% 0.3 150 / 0.8)");
    expect(help).toContain("E1804");
    expect(help).toContain("2.74:1");
    expect(help).toContain("light (P3)");
  });

  it("passes an overlay whose composites in both forms reach the need", () => {
    expect(helpOf("color(display-p3 0 0.66 0 / 0.95)")).toBe("");
    expect(helpOf("rgb(0 0 0 / 0.6)")).toBe("");
  });
});
