import { attachActions } from "./internal/attachActions.ts";
import { compileRoutes } from "./internal/compileRoutes.ts";
import { hrefIn } from "./internal/hrefIn.ts";
import { tables } from "./internal/tables.ts";
import type { Href } from "./types/Href.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteActions } from "./types/RouteActions.ts";
import type { RouteDef } from "./types/RouteDef.ts";
import type { RouteFit } from "./types/RouteFit.ts";
import type { RouteTitles } from "./types/RouteTitles.ts";

type Rec = Readonly<Record<string, unknown>>;

/**
 * Declare routes (k.router Manifest). Validates only these entries (throws an Error whose `code` is E1502-E1507) and
 * compiles the manifest's own table; manifests never share validation or tables. `routes.href(id, params?, search?)`
 * links within this manifest only (RFC 0041). `routes.actions({ [id]: { POST, ... } })`, a statement after the
 * manifest, attaches each route's actions (RFC 0063; E1505, E1507). At compile time each loader's and action's
 * `params`/`search` must accept `Infer` of the entry's schemas (`RouteFit`, `ActionsFit`), and a `title`'s `data` is
 * the loader's `output` value (`RouteTitles`).
 */
export function manifest<
  M extends Readonly<Record<string, RouteDef<never>>>,
  O extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
>(routes: M & RouteFit<M> & RouteTitles<O>): Manifest<M> {
  const table = compileRoutes(routes);
  const href = (id: string, params: Rec = {}, search: Rec = {}): Href => hrefIn(table, id, params, search);
  const actions = (byId: Readonly<Record<string, RouteActions | undefined>>): void => attachActions(table, byId);
  const m: Manifest<M> = Object.freeze({ kind: "keel.manifest", routes, href, actions });
  tables.set(m, table);
  return m;
}
