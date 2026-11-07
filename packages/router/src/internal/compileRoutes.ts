import type { RouteDef } from "../types/RouteDef.ts";
import type { Registered } from "./Registered.ts";
import type { Table } from "./Table.ts";
import { chainOf } from "./chainOf.ts";
import { codedError } from "./codedError.ts";
import { compilePath } from "./compilePath.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { patternKey } from "./patternKey.ts";

const VERBS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Validate one manifest and compile its table. Throws an Error with `code`: E1502 two routes with one path
 * pattern, E1503 path/params mismatch or malformed path, E1504 required search field, E1505 actions key not
 * a verb, E1506 unknown layout, layout with a path, or layout cycle, E1507 a loader or action declaring a `params`
 * or `search` schema that is not this route's own value (RFC 0027). Looks at nothing outside `routes`.
 */
export function compileRoutes(routes: Readonly<Record<string, RouteDef>>): Table {
  const table = new Map<string, Registered>();
  const patterns = new Map<string, string>();
  for (const [id, def] of Object.entries(routes)) {
    for (const verb of Object.keys(def.actions ?? {}))
      if (!VERBS.includes(verb)) throw codedError("E1505", `${id}: actions key "${verb}" is not POST/PUT/PATCH/DELETE`);
    const segments = def.path === undefined ? null : compilePath(id, def.path);
    const names = (segments ?? []).flatMap((s) => (s.kind === "param" ? [s.name] : []));
    const fields = def.params === undefined ? [] : fieldsOf(def.params.node).map(([k]) => k);
    for (const n of names) if (!fields.includes(n)) throw codedError("E1503", `${id}: ":${n}" has no params field`);
    for (const f of fields) if (!names.includes(f)) throw codedError("E1503", `${id}: params field "${f}" not in path`);
    if (def.search !== undefined)
      for (const [k, node] of fieldsOf(def.search.node))
        if (node.kind !== "optional") throw codedError("E1504", `${id}: search field "${k}" must be optional`);
    if (def.loader?.params !== undefined && def.loader.params !== def.params)
      throw codedError("E1507", `${id}: loader params schema is not this route's params`);
    if (def.loader?.search !== undefined && def.loader.search !== def.search)
      throw codedError("E1507", `${id}: loader search schema is not this route's search`);
    for (const [verb, act] of Object.entries(def.actions ?? {}))
      if (act?.params !== undefined && act.params !== def.params)
        throw codedError("E1507", `${id}: ${verb} action params schema is not this route's params`);
    chainOf(id, def, routes);
    if (segments !== null) {
      const key = patternKey(segments);
      const other = patterns.get(key);
      if (other !== undefined) throw codedError("E1502", `${id}: path pattern "${key}" is also ${other}`);
      patterns.set(key, id);
    }
    table.set(id, { id, def, segments });
  }
  return table;
}
