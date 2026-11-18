import type { RouteDef } from "@keel/router";

type Table = { readonly routes: Readonly<Record<string, RouteDef>> };

/**
 * `() => import(path)` of a module whose default export is a route table (`manifest`), or whose `routes` export is one
 * (a `routes.ts`), for `resumeDocument`.
 */
export type RoutesImport = () => Promise<{ readonly default: Table } | { readonly routes: Table }>;
