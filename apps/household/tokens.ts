import { defineTokens } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";

/**
 * The Keel brand (docs/BRAND.md) with two spacing changes and two looks: headings have no margin, a control keeps
 * 4px from its label and its error, `panel` is the white hairline card that holds a form or a tool, and `notice` is a
 * mono message whose color and border the use names (`fg="error" border="error"`, or `verified`).
 */
export const tokens = defineTokens({
  ...brandTokens,
  base: {
    ...brandTokens.base,
    heading: { ...brandTokens.base.heading, m: "0" },
    control: { ...brandTokens.base.control, my: "1" },
  },
  look: {
    ...brandTokens.look,
    panel: { direction: "column", gap: "3", p: { base: "3", md: "4" }, bg: "card", border: "hairline" },
    notice: { px: "3", py: "2", bg: "card", font: "mono", fontSize: "sm" },
  },
});
