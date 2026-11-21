import { stdRoutes } from "../std/stdRoutes.ts";
import type { Topology } from "../types/Topology.ts";
import { manifestIds } from "./manifestIds.ts";

/**
 * The routes manifests a project's own `vite build` evaluates into `routes.json`: those of the first `client`
 * deployable by name, else every `modules/<m>/routes.ts` among `paths` (root-relative) and, with `root`, every
 * module the topology places; in module id order, the order the Vite plugin merges them in. With `root`, a placed
 * stdlib module contributes its package's `./routes` file (`stdRoutes`, an absolute path). `artifactHashes`,
 * `routeLiterals` and `buildRoutes` share it; a selected id that resolves to no module is `unreadModules`'.
 */
export function projectManifests(topology: Topology | undefined, paths: readonly string[], root?: string): string[] {
  const { ids, present } = manifestIds(topology, paths, root !== undefined);
  return ids.flatMap((id) => {
    const p = present.get(id) ?? (root === undefined ? undefined : stdRoutes(root, id)?.[0]);
    return p === undefined ? [] : [p];
  });
}
