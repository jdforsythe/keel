import type { RouteDef } from "@keel/router";
import type { Level } from "./Level.ts";
import type { Located } from "./Located.ts";
import type { Segment } from "./Segment.ts";
import { codedError } from "./codedError.ts";
import { moduleOf } from "./moduleOf.ts";

const segmentsOf = (path: string): readonly Segment[] =>
  path === "/"
    ? []
    : path
        .slice(1)
        .split("/")
        .map(
          (text): Segment => (text.startsWith(":") ? { kind: "param", name: text.slice(1) } : { kind: "static", text }),
        );

function chainOf(id: string, def: RouteDef, routes: Readonly<Record<string, RouteDef>>): readonly Level[] {
  const out: Level[] = [{ id, def }];
  const seen = new Set<string>([id]);
  for (let name = def.layout; name !== undefined; ) {
    const next = Object.hasOwn(routes, name) ? routes[name] : undefined;
    if (seen.has(name) || next === undefined) throw codedError("E1506", `${id}: unknown layout or cycle at "${name}"`);
    seen.add(name);
    out.unshift({ id: name, def: next });
    name = next.layout;
  }
  return out;
}

/**
 * The routable entries of a manifest (already validated by `manifest()`, k.router): compiled path
 * segments and the chain, layouts outermost first. A copy of the router's internal matcher table, which
 * `@keel/router` does not export.
 */
export function compileTable(routes: Readonly<Record<string, RouteDef>>): readonly Located[] {
  const out: Located[] = [];
  for (const [id, def] of Object.entries(routes))
    if (def.path !== undefined)
      out.push({ id, module: moduleOf(id), def, segments: segmentsOf(def.path), chain: chainOf(id, def, routes) });
  return out;
}
