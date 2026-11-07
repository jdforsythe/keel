import type { Topology } from "../types/Topology.ts";

const MANIFEST = /^modules\/([^/]+)\/routes\.ts$/;

/**
 * The routes manifests a project's own `vite build` evaluates into `routes.json` (rfc:0059): those of the first
 * `client` deployable by name, else every `modules/<m>/routes.ts`; only the ones among `paths` (root-relative), in
 * module id order, the order the Vite plugin merges them in. `artifactHashes`, `routeLiterals` and `buildRoutes` share it.
 */
export function projectManifests(topology: Topology | undefined, paths: readonly string[]): string[] {
  const present = new Map<string, string>();
  for (const p of paths) {
    const id = MANIFEST.exec(p)?.[1];
    if (id !== undefined) present.set(id, p);
  }
  const names = topology === undefined ? [] : Object.keys(topology).sort();
  const client = names.map((n) => topology?.[n]).find((d) => d?.adapter === "client");
  const ids = client === undefined ? [...present.keys()] : [...new Set(client.modules)];
  return ids.sort().flatMap((id) => {
    const p = present.get(id);
    return p === undefined ? [] : [p];
  });
}
