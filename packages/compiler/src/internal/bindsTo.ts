import type { Analysis } from "./Analysis.ts";
import type { Span } from "./Span.ts";

/** True when a read of `name` at `pos` resolves to the declaration whose scope is exactly `scope`. */
export function bindsTo(a: Analysis, name: string, pos: number, scope: Span): boolean {
  let best: Span | undefined;
  for (const s of a.decls.get(name) ?? []) {
    if (s.start > pos || pos >= s.end) continue;
    if (best === undefined || s.start > best.start || (s.start === best.start && s.end < best.end)) best = s;
  }
  return best !== undefined && best.start === scope.start && best.end === scope.end;
}
