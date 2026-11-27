// @vitest-environment happy-dom
// k.values Contrast at render: an overlay outside the sRGB gamut is composited once mapped and once clipped, the lower
// ratio standing.
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Box, Text } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";
import { describe, expect, it } from "vitest";

// color(display-p3 0 0.66 0 / 0.95) over #FFFFFF is rgb(13 171 16) mapped (3.07:1 with #FFFFFF) and rgb(13 176 13)
// clipped (2.90:1).
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
  it("fails large text at the clipped composite, which mapping alone passes", () => {
    const help = helpOf("color(display-p3 0 0.66 0 / 0.95)");
    expect(help).toContain("E1804");
    expect(help).toContain("2.90:1");
  });

  it("passes an overlay whose composites both reach the need", () => {
    expect(helpOf("rgb(0 0 0 / 0.6)")).toBe("");
  });
});
