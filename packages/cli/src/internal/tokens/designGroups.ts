import type { Assembled } from "./Assembled.ts";
import { GROUP_ORDER } from "./GROUP_ORDER.ts";

/** The groups of `a` that `tokens.ts` spreads from `designTokens`, in the order they are written: its token groups, `look`, then `themes`. */
export function designGroups(a: Assembled): string[] {
  return [
    ...GROUP_ORDER.filter((g) => (a.groups.get(g)?.size ?? 0) > 0),
    ...(a.looks.size > 0 ? ["look"] : []),
    ...(a.themes.size > 0 ? ["themes"] : []),
  ];
}
