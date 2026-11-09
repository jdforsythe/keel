import type { SourceFile } from "@keel/cli";
import { parseTopology } from "@keel/compiler";

/**
 * The modules of the deployable serving `routeId` (std.sessions Commands): the first `topology.ts` deployable, by
 * name, whose modules include the route id's module prefix (up to its first `.`), each kept when its
 * `modules/<id>/routes.ts` exists. Undefined when there is no topology, no such deployable, or no routes file.
 */
export function servingModules(files: readonly SourceFile[], routeId: string): string[] | undefined {
  const topo = files.find((f) => f.path === "topology.ts");
  if (topo === undefined) return undefined;
  const mod = routeId.split(".")[0] ?? "";
  const deployables = Object.entries(parseTopology(topo.source).topology).sort(([a], [b]) => (a < b ? -1 : 1));
  const serving = deployables.find(([, d]) => d.modules.includes(mod));
  if (serving === undefined) return undefined;
  const have = new Set(files.map((f) => f.path));
  const mods = serving[1].modules.filter((m) => have.has(`modules/${m}/routes.ts`));
  return mods.includes(mod) ? mods : undefined;
}
