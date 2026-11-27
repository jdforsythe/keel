import type { ContrastRow } from "../types/ContrastRow.ts";
import type { Tokens } from "../types/Tokens.ts";
import { contrast } from "./contrast.ts";
import { schemesOf } from "./schemesOf.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Every ordered pair of distinct color tokens in each of the app's schemes (k.schemes) with its WCAG contrast ratio rounded to two decimals
 * (k.a11y): light rows first, then dark, each in token order (`fg` outer, `bg` inner). A single-value color counts in
 * both schemes; a pair whose value in that scheme is not `#rgb` or `#rrggbb` has no ratio and is left out.
 */
export function contrastTable(tokens: Tokens): ContrastRow[] {
  const colors = Object.entries(tokens.color ?? {});
  const rows: ContrastRow[] = [];
  for (const scheme of schemesOf(tokens))
    for (const [fg, f] of colors)
      for (const [bg, b] of colors) {
        const a = typeof f === "string" ? f : f[scheme];
        const c = typeof b === "string" ? b : b[scheme];
        if (fg !== bg && HEX.test(a) && HEX.test(c))
          rows.push({ scheme, fg, bg, ratio: Math.round(contrast(a, c) * 100) / 100 });
      }
  return rows;
}
