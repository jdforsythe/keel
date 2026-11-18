import type { RouteDef } from "@keel/router";

/** `() => import(path)` of a module whose default export is a route table (`manifest`), for `resumeDocument`. */
export type RoutesImport = () => Promise<{ readonly default: { readonly routes: Readonly<Record<string, RouteDef>> } }>;
