import { compileRoutes } from "./internal/compileRoutes.ts";
import { latest } from "./internal/latest.ts";
import { tables } from "./internal/tables.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteDef } from "./types/RouteDef.ts";

/**
 * Declare routes (k.router Manifest). Validates only these entries (throws an Error whose `code` is
 * E1502-E1506) and compiles the manifest's own table; manifests never share validation or tables. Each id
 * becomes resolvable by the free `href(id)`, newest declaration first.
 */
export function manifest<M extends Readonly<Record<string, RouteDef>>>(routes: M): Manifest<M> {
  const table = compileRoutes(routes);
  const m: Manifest<M> = Object.freeze({ kind: "keel.manifest", routes });
  tables.set(m, table);
  for (const id of table.keys()) latest.set(id, table);
  return m;
}
