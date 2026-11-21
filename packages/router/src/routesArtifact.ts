import { compileRoutes } from "./internal/compileRoutes.ts";
import { jsonSchemaOf } from "./internal/jsonSchemaOf.ts";
import type { RouteTable } from "./types/RouteTable.ts";
import type { RoutesArtifact } from "./types/RoutesArtifact.ts";
import type { Verb } from "./types/Verb.ts";

const VERBS: readonly Verb[] = ["DELETE", "PATCH", "POST", "PUT"];

/**
 * The `routes.json` content for a route table (k.compiler Artifacts): per route id, sorted, `{ actions, api?, guard,
 * layout, method?, module, params, path, search }`. `actions` lists a page's bound verbs or an API write entry's
 * `method`; an API entry has `api: true`, its `method`, and its `query` under `search`; `guard` is the guard's
 * `redirect`; layouts have `path: null`; schemas are JSON Schema.
 */
export function routesArtifact(routes: RouteTable): RoutesArtifact {
  const { table } = compileRoutes(routes);
  return Object.fromEntries(
    [...table.keys()].sort().flatMap((id) => {
      const def = table.get(id)?.def;
      if (def === undefined) return [];
      const search = def.kind === "api" ? def.query : def.search;
      const entry = {
        actions: VERBS.filter((v) => def.actions[v] !== undefined),
        ...(def.kind === "api" ? { api: true as const } : {}),
        // The guard's `redirect`, or `null` for a guard without one.
        guard: def.guard?.redirect ?? null,
        layout: def.layout ?? null,
        ...(def.method === undefined ? {} : { method: def.method }),
        module: def.module,
        params: def.params === undefined ? null : jsonSchemaOf(def.params.node),
        path: def.path ?? null,
        search: search === undefined ? null : jsonSchemaOf(search.node),
      };
      return [[id, entry]];
    }),
  );
}
