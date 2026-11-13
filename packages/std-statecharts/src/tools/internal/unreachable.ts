import type { Shape } from "../../internal/Shape.ts";

/**
 * E2752 of a chart's shape: the states no chain of `on` targets reaches from `initial`, every guard taken as possibly
 * true, with where each was written. None when `initial` names no state (that is E2751).
 */
export function unreachable<P>(shape: Shape<P>): { readonly name: string; readonly at: P }[] {
  const names = shape.states.map((st) => st.name);
  if (!names.includes(shape.initial.name)) return [];
  const reached = new Set<string>();
  const queue = [shape.initial.name];
  for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
    if (reached.has(n)) continue;
    reached.add(n);
    for (const on of shape.states.find((st) => st.name === n)?.on ?? [])
      for (const t of on.targets) if (t.to !== undefined && names.includes(t.to.name)) queue.push(t.to.name);
  }
  return shape.states.filter((st) => !reached.has(st.name));
}
