import type { Ready } from "./Ready.ts";

/** The states event `event` leads to from state `state` of a chart's shape. */
export function targets(shape: Ready["shape"], state: string, event: string | undefined): string[] {
  const on = shape.states.find((s) => s.name === state)?.on ?? [];
  return on.filter((o) => o.event.name === event).flatMap((o) => o.targets.flatMap((t) => (t.to ? [t.to.name] : [])));
}
