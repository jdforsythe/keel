import type { RouteDef } from "../types/RouteDef.ts";
import type { Level } from "./Level.ts";
import { codedError } from "./codedError.ts";

/** The chain of route `id` in `routes`: its layouts outermost first, then the route. Unknown name or cycle: E1506. */
export function chainOf(id: string, def: RouteDef, routes: Readonly<Record<string, RouteDef>>): readonly Level[] {
  const out: Level[] = [{ id, def }];
  const seen = new Set<string>([id]);
  for (let name = def.layout; name !== undefined; ) {
    if (seen.has(name)) throw codedError("E1506", `${id}: layout cycle through "${name}"`);
    seen.add(name);
    const next = Object.hasOwn(routes, name) ? routes[name] : undefined;
    if (next === undefined) throw codedError("E1506", `${id}: unknown layout "${name}"`);
    if (next.path !== undefined) throw codedError("E1506", `${id}: layout "${name}" has a path; a layout has none`);
    out.unshift({ id: name, def: next });
    name = next.layout;
  }
  return out;
}
