import type { RouteDef } from "../types/RouteDef.ts";
import type { Located } from "./Located.ts";
import { chainOf } from "./chainOf.ts";
import { compilePath } from "./compilePath.ts";

/** The routable entries of a manifest with their chains resolved (E1506 on unknown layouts or cycles). */
export function compileTable(routes: Readonly<Record<string, RouteDef>>): readonly Located[] {
  const out: Located[] = [];
  for (const [id, def] of Object.entries(routes)) {
    const chain = chainOf(id, def, routes);
    if (def.path !== undefined) out.push({ id, def, segments: compilePath(id, def.path), chain });
  }
  return out;
}
