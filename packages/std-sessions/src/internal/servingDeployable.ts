import type { SourceFile } from "@keel/cli";
import { parseTopology } from "@keel/compiler";

/**
 * The deployable serving `routeId` (std.sessions Commands): the first `topology.ts` deployable, by name, whose modules
 * include the route id's module prefix (up to its first `.`), with its adapter and every module it places in
 * `topology.ts` order. Undefined when there is no topology or no such deployable.
 */
export function servingDeployable(
  files: readonly SourceFile[],
  routeId: string,
): { readonly name: string; readonly adapter: string; readonly modules: readonly string[] } | undefined {
  const topo = files.find((f) => f.path === "topology.ts");
  if (topo === undefined) return undefined;
  const mod = routeId.split(".")[0] ?? "";
  const deployables = Object.entries(parseTopology(topo.source).topology).sort(([a], [b]) => (a < b ? -1 : 1));
  const serving = deployables.find(([, d]) => d.modules.includes(mod));
  if (serving === undefined) return undefined;
  return { name: serving[0], adapter: serving[1].adapter, modules: serving[1].modules };
}
