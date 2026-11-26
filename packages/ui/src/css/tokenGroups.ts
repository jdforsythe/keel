import { vocabulary } from "../internal/vocabulary.ts";
import type { TokenGroup } from "../types/TokenGroup.ts";

/**
 * Each token prop and the token groups its value is looked up in, in order (`w` and `h`: `size`, then `space`). A
 * keyword prop (`direction`, `align`, `justify`, `wrap`, `textAlign`) is not among them: its type closes it.
 */
export const tokenGroups: Readonly<Record<string, readonly TokenGroup[]>> = Object.fromEntries(
  Object.entries(vocabulary).flatMap(([prop, entry]) => (entry.groups.length === 0 ? [] : [[prop, entry.groups]])),
);
