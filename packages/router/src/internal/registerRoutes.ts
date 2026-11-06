import type { RouteDef } from "../types/RouteDef.ts";
import type { Registered } from "./Registered.ts";
import { codedError } from "./codedError.ts";
import { compilePath } from "./compilePath.ts";
import { fieldsOf } from "./fieldsOf.ts";
import { patternKey } from "./patternKey.ts";
import { routeTable } from "./routeTable.ts";

const VERBS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Validate one manifest's entries (E1502-E1506 where decidable locally) and add them to the process route
 * table. Layout names that are not in this manifest resolve later, at `createRouter`, against the union.
 * Re-declaring an id replaces its entry (module re-evaluation under HMR or per-test manifests); two
 * modules declaring one id is a `keel check` concern, as ids are module-prefixed.
 */
export function registerRoutes(routes: Readonly<Record<string, RouteDef>>): void {
  const compiled: Registered[] = [];
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
    if (def.layout !== undefined) {
      const target = Object.hasOwn(routes, def.layout) ? routes[def.layout] : routeTable.get(def.layout)?.def;
      if (target?.path !== undefined)
        throw codedError("E1506", `${id}: layout "${def.layout}" has a path; a layout has none`);
    }
    compiled.push({ id, def, segments });
  }
  for (const [id] of Object.entries(routes)) {
    const seen = new Set<string>();
    for (let at: string | undefined = id; at !== undefined && Object.hasOwn(routes, at); at = routes[at]?.layout) {
      if (seen.has(at)) throw codedError("E1506", `${id}: layout cycle through "${at}"`);
      seen.add(at);
    }
  }
  const keys = new Map<string, string>();
  for (const r of routeTable.values())
    if (r.segments !== null && !Object.hasOwn(routes, r.id)) keys.set(patternKey(r.segments), r.id);
  for (const r of compiled) {
    if (r.segments === null) continue;
    const key = patternKey(r.segments);
    const other = keys.get(key);
    if (other !== undefined) throw codedError("E1502", `${r.id}: path pattern "${key}" is also ${other}`);
    keys.set(key, r.id);
  }
  for (const r of compiled) routeTable.set(r.id, r);
}
