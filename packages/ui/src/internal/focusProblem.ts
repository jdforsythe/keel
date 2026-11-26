import { contrast } from "../css/contrast.ts";
import { schemesOf } from "../css/schemesOf.ts";
import type { Tokens } from "../types/Tokens.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A color token's value per scheme (`light`, and `dark` when it has one), or undefined for a name it lacks. */
const valuesOf = (tokens: Tokens, name: string): { light: string; dark: string } | undefined => {
  const v = tokens.color?.[name];
  if (v === undefined) return undefined;
  return typeof v === "string" ? { light: v, dark: v } : v;
};

/**
 * Why `base.focus` fails (k.a11y Order and focus: under 3:1 against `base.page`'s `bg` in any of the app's schemes, k.schemes), or null.
 * Colors that are not `#rgb`/`#rrggbb`, or a page with no `bg`, are not judged here.
 */
export function focusProblem(tokens: Tokens): string | null {
  const focus = tokens.base?.focus;
  const bg = tokens.base?.page?.bg;
  if (focus === undefined || typeof bg !== "string") return null;
  const f = valuesOf(tokens, focus);
  const b = valuesOf(tokens, bg);
  if (f === undefined || b === undefined) return null;
  for (const scheme of schemesOf(tokens)) {
    const fg = f[scheme];
    const back = b[scheme];
    if (!HEX.test(fg) || !HEX.test(back)) continue;
    const ratio = contrast(fg, back);
    if (ratio < 3)
      return `base.focus ${focus} is ${ratio.toFixed(2)}:1 against base.page bg ${bg} in the ${scheme} scheme; it needs 3:1`;
  }
  return null;
}
