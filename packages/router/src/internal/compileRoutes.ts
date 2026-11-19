import type { RouteDef } from "../types/RouteDef.ts";
import type { Registered } from "./Registered.ts";
import type { Table } from "./Table.ts";
import { chainOf } from "./chainOf.ts";
import { codedError } from "./codedError.ts";
import { compilePath } from "./compilePath.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { isStub } from "./isStub.ts";
import { patternKey } from "./patternKey.ts";
import { prefixCollision } from "./prefixCollision.ts";

/**
 * Validate one manifest and compile its table. Throws an Error with `code`: E1502 two routes with one path
 * pattern, E1510 an entry that is no page, layout or API route (k.api; `api` other than `true` included), E1508 a guard without `redirect` on a page or
 * layout (a stub guard, `serverOnly`, is not read), E1503 path/params mismatch or malformed path, E1504 required search field, E1505 an `actions` key on
 * an entry (they attach with `routes.actions`), E1506 unknown layout, layout with a path, or layout cycle,
 * E1507 a loader declaring a `params` or `search` schema that is not this route's own value, E1509 a
 * k.prefix collision (`prefixCollision`). Looks at
 * nothing outside `routes`.
 */
export function compileRoutes(routes: Readonly<Record<string, RouteDef>>): Table {
  const table = new Map<string, Registered>();
  const patterns = new Map<string, string>();
  for (const [id, def] of Object.entries(routes)) {
    if (
      "api" in def
        ? def.api !== true || !def.path || ["component", "errorElement", "title", "layout"].some((k) => k in def)
        : !def.component
    )
      throw codedError("E1510", `${id}: needs component, or api: true with a path and no view`);
    if (!def.api && def.guard && !isStub(def.guard) && !def.guard.redirect)
      throw codedError("E1508", `${id}: guard without redirect`);
    if (Object.hasOwn(def, "actions"))
      throw codedError("E1505", `${id}: move actions to routes.actions({ "${id}": {...} }) after the manifest`);
    const segments = def.path === undefined ? null : compilePath(id, def.path);
    const names = (segments ?? []).flatMap((s) => (s.kind === "param" ? [s.name] : []));
    const fields = def.params === undefined ? [] : fieldsOf(def.params.node).map(([k]) => k);
    for (const n of names) if (!fields.includes(n)) throw codedError("E1503", `${id}: ":${n}" has no params field`);
    for (const f of fields) if (!names.includes(f)) throw codedError("E1503", `${id}: params field "${f}" not in path`);
    if (def.search !== undefined)
      for (const [k, node] of fieldsOf(def.search.node))
        if (node.kind !== "optional") throw codedError("E1504", `${id}: search field "${k}" must be optional`);
    for (const k of ["params", "search"] as const)
      if (def.loader?.[k] !== undefined && def.loader[k] !== def[k])
        throw codedError("E1507", `${id}: loader ${k} schema is not this route's ${k}`);
    chainOf(id, def, routes);
    if (segments !== null) {
      const key = patternKey(segments);
      const other = patterns.get(key);
      if (other !== undefined) throw codedError("E1502", `${id}: path pattern "${key}" is also ${other}`);
      patterns.set(key, id);
    }
    table.set(id, { id, def, segments });
  }
  const collision = prefixCollision(table.values());
  if (collision !== null) throw codedError("E1509", collision);
  return table;
}
