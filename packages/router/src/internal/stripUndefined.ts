import type { Rec } from "./Rec.ts";

/** Drop keys whose value is `undefined` (an absent optional), so schemas see them as absent. */
export function stripUndefined(v: Rec): Rec {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
}
