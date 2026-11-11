import { parseTopology } from "@keel/compiler";

/**
 * The `vite build` runs of `keel build` (k.server Build, k.hosting Artifact), in order: the project's own build
 * (`undefined`: no `KEEL_DEPLOYABLE`) when there is no topology or a deployable is `static`; then one per `client`
 * deployable by name, which the Vite plugin writes to `dist/<name>/`; then one per `node` deployable by name, whose
 * client build the plugin writes to `dist/<name>/`, with the build of each `client` it hosts copied in (so after
 * that client's). `topology.ts` is the only input.
 */
export function viteTargets(topologySource: string | undefined): (string | undefined)[] {
  if (topologySource === undefined) return [undefined];
  const topology = parseTopology(topologySource).topology;
  const names = Object.keys(topology).sort();
  const of = (adapter: string): string[] => names.filter((n) => topology[n]?.adapter === adapter);
  const own = names.length === 0 || of("static").length > 0 ? [undefined] : [];
  return [...own, ...of("client"), ...of("node")];
}
