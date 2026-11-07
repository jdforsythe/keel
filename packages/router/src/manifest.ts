import { compileRoutes } from "./internal/compileRoutes.ts";
import { hrefIn } from "./internal/hrefIn.ts";
import { tables } from "./internal/tables.ts";
import type { Href } from "./types/Href.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteDef } from "./types/RouteDef.ts";
import type { RouteFit } from "./types/RouteFit.ts";

type Rec = Readonly<Record<string, unknown>>;

/**
 * Declare routes (k.router Manifest). Validates only these entries (throws an Error whose `code` is E1502-E1507) and
 * compiles the manifest's own table; manifests never share validation or tables. `routes.href(id, params?, search?)`
 * links within this manifest only (RFC 0041). At compile time each loader's and action's `params`/`search` must accept
 * `Infer` of the entry's schemas (`RouteFit`): a shape they do not fit does not compile.
 */
export function manifest<M extends Readonly<Record<string, RouteDef>>>(routes: M & RouteFit<M>): Manifest<M> {
  const table = compileRoutes(routes);
  const href = (id: string, params: Rec = {}, search: Rec = {}): Href => hrefIn(table, id, params, search);
  const m: Manifest<M> = Object.freeze({ kind: "keel.manifest", routes, href });
  tables.set(m, table);
  return m;
}
