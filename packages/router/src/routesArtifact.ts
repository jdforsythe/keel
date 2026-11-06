import { jsonSchemaOf } from "./internal/jsonSchemaOf.ts";
import type { Manifest } from "./types/Manifest.ts";
import type { RouteDef } from "./types/RouteDef.ts";
import type { RoutesArtifact } from "./types/RoutesArtifact.ts";
import type { Verb } from "./types/Verb.ts";

const VERBS: readonly Verb[] = ["DELETE", "PATCH", "POST", "PUT"];

/**
 * The `routes.json` content for a manifest (k.compiler Artifacts): per route id, sorted, `{ actions, guard,
 * layout, module, params, path, search }`; schemas as JSON Schema; layouts have `path: null`; `module` is
 * the route id's first dotted segment.
 */
export function routesArtifact(m: Manifest<Readonly<Record<string, RouteDef>>>): RoutesArtifact {
  return Object.fromEntries(
    Object.keys(m.routes)
      .sort()
      .flatMap((id) => {
        const def = m.routes[id];
        if (def === undefined) return [];
        const entry = {
          actions: VERBS.filter((v) => def.actions?.[v] !== undefined),
          guard: def.guard ?? null,
          layout: def.layout ?? null,
          module: id.split(".")[0] ?? id,
          params: def.params === undefined ? null : jsonSchemaOf(def.params.node),
          path: def.path ?? null,
          search: def.search === undefined ? null : jsonSchemaOf(def.search.node),
        };
        return [[id, entry]];
      }),
  );
}
