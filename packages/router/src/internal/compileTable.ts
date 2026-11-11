import type { RouteDef } from "../types/RouteDef.ts";
import type { Located } from "./Located.ts";
import type { Table } from "./Table.ts";
import { apiComplete } from "./apiComplete.ts";
import { chainOf } from "./chainOf.ts";
import { sealed } from "./sealed.ts";

/** The routable entries of a compiled table, with their chains, for matching, API routes included. Throws E1510 (`apiComplete`); seals every entry (`sealed`). */
export function compileTable(table: Table, routes: Readonly<Record<string, RouteDef>>): readonly Located[] {
  apiComplete(table);
  const out: Located[] = [];
  for (const { id, def, segments } of table.values()) {
    sealed.add(def);
    if (segments !== null) out.push({ id, def, segments, chain: chainOf(id, def, routes) });
  }
  return out;
}
