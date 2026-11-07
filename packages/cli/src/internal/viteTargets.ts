import { parseTopology } from "@keel/compiler";

/**
 * The `vite build` runs of `keel build` (k.server Build, RFC 0048), in order: the project's own build (`undefined`:
 * no `KEEL_DEPLOYABLE`) unless every deployable is `node`, then one per `node` deployable by name, whose client build
 * the Vite plugin writes to `dist/<name>/` (after the project's own, which may empty `dist/`). `topology.ts` is the
 * only input; without one, the project's own build alone.
 */
export function viteTargets(topologySource: string | undefined): (string | undefined)[] {
  if (topologySource === undefined) return [undefined];
  const topology = parseTopology(topologySource).topology;
  const names = Object.keys(topology).sort();
  const node = names.filter((n) => topology[n]?.adapter === "node");
  return node.length === names.length && names.length > 0 ? node : [undefined, ...node];
}
