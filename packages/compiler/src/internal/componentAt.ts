import type { Analysis } from "./Analysis.ts";
import type { FnInfo } from "./FnInfo.ts";

/** The innermost function around `pos` whose name is capitalized (a component), if any. */
export function componentAt(a: Analysis, pos: number): FnInfo | undefined {
  let best: FnInfo | undefined;
  for (const f of a.functions) {
    if (f.start > pos || pos >= f.end || f.name === null || !/^[A-Z]/.test(f.name)) continue;
    if (best === undefined || f.end - f.start < best.end - best.start) best = f;
  }
  return best;
}
