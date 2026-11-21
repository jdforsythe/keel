import type { JsonValue } from "@keel/schema";

/**
 * One `routes.json` entry (k.compiler Artifacts); same shape as `routesArtifact` from `@keel/router`. An API entry has
 * `api: true` and its `method`, its `query` under `search`, and `actions` its `method` when it is a write; a page's
 * `actions` are its bound verbs; a layout's `path` is `null`.
 */
export type RouteEntry = {
  readonly actions: readonly string[];
  readonly api?: true;
  readonly guard: string | null;
  readonly layout: string | null;
  readonly method?: string;
  readonly module: string;
  readonly params: JsonValue;
  readonly path: string | null;
  readonly search: JsonValue;
};
