import type { RouteTable } from "../types/RouteTable.ts";
import type { Bound } from "./Bound.ts";
import type { Compiled } from "./Compiled.ts";
import type { Registered } from "./Registered.ts";
import { carriedFits } from "./carriedFits.ts";
import { codedError } from "./codedError.ts";
import { locate } from "./locate.ts";
import { patternClash } from "./patternClash.ts";
import { prefixCollision } from "./prefixCollision.ts";
import { tables } from "./tables.ts";

/**
 * The union of route tables (k.routes Union), nested tables flattened, in argument order. Throws an Error with `code`:
 * E1502 one module twice, or two modules sharing a path pattern at any method; E1509 a k.prefix collision over the
 * union; E1506 a `layout` that names no entry of the union, an entry that is no layout, or closes a cycle across
 * modules (`chainOf`); E1508 a guarded page on a chain joined across modules that lacks a
 * params field of its redirect route, or carries one that does not fit (`carriedFits`). A value that is no route table, a copy of one among them (k.identity), throws E1515.
 */
export function unionTables(parts: readonly RouteTable[]): Compiled & { readonly contracts: RouteTable["contracts"] } {
  const bindings = new Map<string, Bound>();
  const table = new Map<string, Registered>();
  const contracts: RouteTable["contracts"][number][] = [];
  for (const [i, t] of parts.entries()) {
    const c = tables.get(t);
    if (c === undefined) throw codedError("E1515", `routeTable: argument ${i + 1} is no manifest or route table`);
    for (const k of t.contracts) {
      if (contracts.some((o) => o.module === k.module))
        throw codedError("E1502", `${k.module}: module ${k.module} is in the route table twice`);
      contracts.push(k);
    }
    for (const [id, b] of c.bindings) bindings.set(id, b);
    for (const [id, r] of c.table) {
      const other = table.get(id);
      if (other !== undefined) throw codedError("E1502", `${id}: route id of ${r.def.module} and ${other.def.module}`);
      table.set(id, r);
    }
  }
  const defs = [...table.values()].map((r) => r.def);
  const clash = patternClash(defs);
  if (clash !== null) throw codedError("E1502", clash);
  const collision = prefixCollision(defs);
  if (collision !== null) throw codedError("E1509", collision);
  const { located } = locate(table);
  carriedFits(located, new Map([...table].map(([id, r]) => [id, r.def])));
  return { bindings, table, located, contracts };
}
