import type { Topology } from "../types/Topology.ts";
import { manifestIds } from "./manifestIds.ts";
import { stdModuleDir } from "./stdModuleDir.ts";

/**
 * The ids `projectManifests` selects under `root` that resolve to no module: no file of `modules/<id>/` among
 * `paths` (root-relative) and no stdlib package of that module id (`stdModuleDir`). Their bindings are not read, so
 * `routeLiterals` names each unread (W1005) rather than dropping it. A stdlib module without `./routes` is not
 * one (with `./contract`, `keel check` reports E1586).
 */
export function unreadModules(topology: Topology | undefined, paths: readonly string[], root: string): string[] {
  const { ids, present } = manifestIds(topology, paths, true);
  return ids.filter(
    (id) =>
      !present.has(id) && !paths.some((p) => p.startsWith(`modules/${id}/`)) && stdModuleDir(root, id) === undefined,
  );
}
