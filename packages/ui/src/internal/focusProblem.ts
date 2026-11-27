import { contrast } from "../css/contrast.ts";
import type { Tokens } from "../types/Tokens.ts";
import { colorSyntax } from "./colorSyntax.ts";
import { combine } from "./combine.ts";

const opaque = (v: string | undefined): v is string => v !== undefined && colorSyntax(v)?.alpha === null;

/**
 * Why `base.focus` fails, as E1807 words it after `base.focus: ` (k.a11y Order and focus: under 3:1 against `base.page`'s `bg` in any of the app's screen
 * combinations, k.themes Combinations), or null. A page with no `bg`, a name the tokens lack, or a value no opaque
 * color form reads is not judged here.
 */
export function focusProblem(tokens: Tokens): string | null {
  const focus = tokens.base?.focus;
  const bg = tokens.base?.page?.bg;
  if (focus === undefined || typeof bg !== "string") return null;
  if (tokens.color?.[focus] === undefined || tokens.color?.[bg] === undefined) return null;
  for (const c of combine(tokens)) {
    if (c.printing) continue;
    const fg = c.tokens.color?.[focus];
    const back = c.tokens.color?.[bg];
    if (typeof fg !== "string" || typeof back !== "string" || !opaque(fg) || !opaque(back)) continue;
    const ratio = contrast(fg, back);
    if (ratio < 3) return `under 3:1 on base.page's bg in ${c.name}`;
  }
  return null;
}
