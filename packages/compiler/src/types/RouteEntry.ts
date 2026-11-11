import type { JsonValue } from "@keel/schema";

/** One `routes.json` entry (k.router Artifacts); same shape as `routesArtifact` from `@keel/router`; `api: true` on an API route only. */
export type RouteEntry = {
  readonly actions: readonly string[];
  readonly api?: true;
  readonly guard: string | null;
  readonly layout: string | null;
  readonly module: string;
  readonly params: JsonValue;
  readonly path: string | null;
  readonly search: JsonValue;
};
