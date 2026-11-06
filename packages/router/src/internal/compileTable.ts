import type { RouteDef } from "../types/RouteDef.ts";
import type { Located } from "./Located.ts";
import type { Table } from "./Table.ts";
import { chainOf } from "./chainOf.ts";

/** The routable entries of a compiled table, with their chains, for matching. */
export function compileTable(table: Table, routes: Readonly<Record<string, RouteDef>>): readonly Located[] {
  const out: Located[] = [];
  for (const { id, def, segments } of table.values())
    if (segments !== null) out.push({ id, def, segments, chain: chainOf(id, def, routes) });
  return out;
}
