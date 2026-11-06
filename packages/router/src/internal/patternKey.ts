import type { Segment } from "./Segment.ts";

/** The pattern with param names erased: two routes with equal keys collide (E1502). */
export function patternKey(segments: readonly Segment[]): string {
  return `/${segments.map((s) => (s.kind === "static" ? s.text : ":")).join("/")}`;
}
