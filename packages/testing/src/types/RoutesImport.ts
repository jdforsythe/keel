import type { RouteTable } from "@keel/router";

/**
 * `() => import(path)` of a module whose default export is a route table (a manifest or `routeTable`), or whose
 * `routes` export is one (a `routes.ts`), for `resumeDocument` and `renderRoute` with `app`.
 */
export type RoutesImport<T extends RouteTable = RouteTable> = () => Promise<
  { readonly default: T } | { readonly routes: T }
>;
