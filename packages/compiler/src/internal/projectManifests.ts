import { stdRoutes } from "../std/stdRoutes.ts";
import type { Topology } from "../types/Topology.ts";

const MANIFEST = /^modules\/([^/]+)\/routes\.ts$/;

/**
 * The routes manifests a project's own `vite build` evaluates into `routes.json`: those of the first `client`
 * deployable by name, else every `modules/<m>/routes.ts` among `paths` (root-relative) and, with `root`, every
 * module the topology places; in module id order, the order the Vite plugin merges them in. With `root`, a placed
 * stdlib module contributes its package's `./routes` file (`stdRoutes`, an absolute path). `artifactHashes`,
 * `routeLiterals` and `buildRoutes` share it.
 */
export function projectManifests(topology: Topology | undefined, paths: readonly string[], root?: string): string[] {
  const present = new Map<string, string>();
  for (const p of paths) {
    const id = MANIFEST.exec(p)?.[1];
    if (id !== undefined) present.set(id, p);
  }
  const names = topology === undefined ? [] : Object.keys(topology).sort();
  const client = names.map((n) => topology?.[n]).find((d) => d?.adapter === "client");
  const placed = root === undefined ? [] : names.flatMap((n) => topology?.[n]?.modules ?? []);
  const ids = client === undefined ? [...present.keys(), ...placed] : client.modules;
  return [...new Set(ids)].sort().flatMap((id) => {
    const p = present.get(id) ?? (root === undefined ? undefined : stdRoutes(root, id)?.[0]);
    return p === undefined ? [] : [p];
  });
}
