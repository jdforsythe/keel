import type { RouteDef } from "../types/RouteDef.ts";
import type { Level } from "./Level.ts";
import { codedError } from "./codedError.ts";
import { routeTable } from "./routeTable.ts";

/**
 * The chain of route `id`: its layouts outermost first, then the route. Layout names resolve in `local` (the
 * router's manifest) and then in the process route table. Unknown name or cycle: E1506.
 */
export function chainOf(id: string, def: RouteDef, local: Readonly<Record<string, RouteDef>>): readonly Level[] {
  const out: Level[] = [{ id, def }];
  const seen = new Set<string>([id]);
  for (let name = def.layout; name !== undefined; ) {
    if (seen.has(name)) throw codedError("E1506", `${id}: layout cycle through "${name}"`);
    seen.add(name);
    const next = Object.hasOwn(local, name) ? local[name] : routeTable.get(name)?.def;
    if (next === undefined) throw codedError("E1506", `${id}: unknown layout "${name}"`);
    out.unshift({ id: name, def: next });
    name = next.layout;
  }
  return out;
}
